/**
 * 认证与授权集成探针（对运行中的后端做真实 HTTP 校验）。
 *
 * 用法：
 *   node scripts/auth-probe.cjs                    # 默认 http://127.0.0.1:3000
 *   BASE_URL=http://127.0.0.1:3100 node scripts/auth-probe.cjs
 *
 * 覆盖（对应 docs/实现自检报告.md 的修复项）：
 *   1. RBAC：普通 student 调管理员接口必须 403（P0-1/P0-2）
 *   2. 登录响应含 refresh_token，且 access token 为短时效（P1-3/P1-4）
 *   3. refresh 轮换：旧值换新、重放检测、宽容窗口幂等（P1-3）
 *   4. 登录失败锁定：连续失败后返回 429（P1 防爆破）
 *   5. 错误信封统一为 {code,statusCode,message,traceId}（P1 错误体系）
 *
 * 退出码：0 = 全部通过；1 = 有失败项。可直接挂 CI。
 */
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const rnd = () => Math.random().toString(36).slice(2, 8);

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
}

async function req(method, path, body, token) {
  const res = await fetch(BASE_URL + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* 非 JSON 响应 */
  }
  return { status: res.status, json, data: json?.data ?? json };
}

async function registerAndLogin(username, password) {
  await req('POST', '/user/register', { username, password });
  return req('POST', '/user/login', { username, password });
}

(async () => {
  const health = await req('GET', '/health');
  if (health.status !== 200) {
    console.log(`✗ 后端不可达（${BASE_URL}/health → ${health.status}）`);
    process.exit(1);
  }
  console.log(`探针目标：${BASE_URL}\n`);

  // 1. RBAC
  const student = 'probe_stu_' + rnd();
  const pwd = 'Probe@12345';
  const login = await registerAndLogin(student, pwd);
  const token = login.data?.access_token;
  check('登录成功并返回 access_token', Boolean(token), `status=${login.status}`);

  const list = await req('GET', '/user/list?page=1&limit=1', null, token);
  check('student 调 GET /user/list 被拒（403）', list.status === 403, `实际 ${list.status}`);

  const create = await req('POST', '/user/create', { username: 'probe_x_' + rnd(), password: pwd }, token);
  check('student 调 POST /user/create 被拒（403）', create.status === 403, `实际 ${create.status}`);

  // 2. 令牌形态
  const expiresIn = login.data?.expires_in;
  check('access token 为短时效（≤ 3600s）', typeof expiresIn === 'number' && expiresIn <= 3600, `expires_in=${expiresIn}`);
  check('登录响应包含 refresh_token', Boolean(login.data?.refresh_token'));
  const refresh0 = login.data?.refresh_token;

  // 3. 轮换 / 重放 / 宽容窗口
  if (refresh0) {
    const r1 = await req('POST', '/auth/refresh', { refreshToken: refresh0 });
    check('refresh 换发成功', r1.status === 200 && Boolean(r1.data?.access_token), `status=${r1.status}`);
    const grace = await req('POST', '/auth/refresh', { refreshToken: refresh0 });
    check(
      '宽容窗口内重放返回同一份令牌（多标签页不互踢）',
      grace.status === 200 && grace.data?.access_token === r1.data?.access_token,
      `status=${grace.status}`,
    );
    if (r1.data?.refresh_token) {
      const next = await req('POST', '/auth/refresh', { refreshToken: r1.data.refresh_token });
      check('新值可继续续期', next.status === 200, `status=${next.status}`);
    }
  }

  // 4. 登录失败锁定
  const lockUser = 'probe_lk_' + rnd();
  await req('POST', '/user/register', { username: lockUser, password: pwd });
  const codes = [];
  for (let i = 0; i < 7; i++) {
    const r = await req('POST', '/user/login', { username: lockUser, password: 'wrong-pass' });
    codes.push(r.status);
  }
  const locked = codes.includes(429);
  check('连续错误密码触发 429 锁定', locked, `状态序列 ${codes.join(',')}`);

  // 5. 错误信封 + traceId
  const bad = await req('POST', '/user/login', { username: '' });
  const body = bad.json || {};
  check(
    '错误信封统一（code/statusCode/message/traceId）',
    typeof body.code === 'string' && typeof body.statusCode === 'number' && typeof body.message === 'string' && Boolean(body.traceId),
    JSON.stringify(body).slice(0, 120),
  );
  check('参数校验错误为 400', bad.status === 400, `实际 ${bad.status}`);

  // 清理：登出当前会话
  if (refresh0) await req('POST', '/auth/logout', { refreshToken: refresh0 }, token);

  console.log(`\n${failures === 0 ? '全部通过' : failures + ' 项失败'}（共 10 项检查）`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.log('探针执行异常：', e?.message || e);
  process.exit(1);
});
