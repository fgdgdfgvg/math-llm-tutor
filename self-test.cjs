/**
 * 全面自测脚本 (self-test)
 * 覆盖：认证生命周期 / 路由可达性 / 微积分求解正确性 / 错题本 / 学习进度
 * 用法：node self-test.cjs
 */
const http = require('http');

const BASE = 'http://localhost:3000';
let pass = 0, fail = 0;
const failures = [];

function req(method, path, { token, body } = {}) {
  return new Promise((resolve) => {
    const url = new URL(BASE + path);
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
    const r = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(data); } catch {}
          resolve({ status: res.statusCode, json, raw: data });
        });
      }
    );
    r.on('error', (e) => resolve({ status: 0, json: null, raw: String(e.message) }));
    r.setTimeout(90000, () => { r.destroy(); resolve({ status: -1, json: null, raw: 'timeout' }); });
    if (payload) r.write(payload);
    r.end();
  });
}

function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; failures.push(name); console.log(`  ❌ ${name}${detail ? ' :: ' + detail : ''}`); }
}

function jwt(t) {
  try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64').toString()); } catch { return null; }
}

(async () => {
  const user = 'selftest_' + Date.now().toString(36);
  const pwd = 'Test123456';

  console.log('\n=== 1. 认证生命周期 ===');
  const reg = await req('POST', '/user/register', { body: { username: user, password: pwd } });
  check('注册成功', reg.status === 201 || reg.status === 200, `status=${reg.status} ${reg.raw.slice(0, 200)}`);
  check('注册响应不含 mongoose 内部字段',
    !/(\$__|activePaths|\$isNew|_doc)/.test(reg.raw),
    reg.raw.slice(0, 200));

  const login = await req('POST', '/user/login', { body: { username: user, password: pwd } });
  const token = login.json?.data?.accessToken || login.json?.data?.token || login.json?.data?.access_token;
  check('登录成功并返回 token', !!token, login.raw.slice(0, 200));

  if (token) {
    const p = jwt(token);
    const days = (p.exp - p.iat) / 86400;
    check(`token 有效期跟随 JWT_EXPIRATION (7d)，实际 ${days} 天`, days > 6.9 && days < 7.1, JSON.stringify(p));
  }

  const profile = await req('GET', '/user/profile', { token });
  check('携带 token 可读 /user/profile', profile.status === 200 && !!profile.json?.data, `status=${profile.status}`);

  console.log('\n=== 2. 无效/过期 token 应返回 401（前端据此登出）===');
  const badToken = token ? token.slice(0, -4) + 'aaaa' : 'invalid.token.here';
  const bad = await req('GET', '/user/profile', { token: badToken });
  check('无效 token → 401 而非 403', bad.status === 401, `status=${bad.status} ${bad.raw.slice(0, 120)}`);
  const noTok = await req('GET', '/user/profile');
  check('无 token → 401', noTok.status === 401, `status=${noTok.status}`);

  console.log('\n=== 3. 微积分求解正确性（真实 SymPy 链路）===');
  const cases = [
    ['计算极限：lim(x→0) sin(x)/x', (a) => /(^|[^0-9.])1([^0-9.]|$)/.test(a)],
    ['求导：x^3', (a) => /3\s*\*?\*?\s*x\s*\*?\*?\s*2|3x\^?2/i.test(a)],
    ['计算积分：x^2', (a) => /x\s*\*\*\s*3\s*\/\s*3|x\^3\/3|x\*\*3\/3/i.test(a)],
    ['解方程：2x + 4 = 0', (a) => /-2/.test(a)],
  ];
  for (const [problem, ok] of cases) {
    const r = await req('POST', '/agents/solve', { token, body: { problem } });
    const ans = r.json?.data?.finalAnswer ?? r.json?.data?.solution?.finalAnswer ?? '';
    const steps = r.json?.data?.solution?.steps ?? r.json?.data?.steps ?? [];
    const clean = !/[\u4e00-\u9fff]/.test(String(ans)) && !/执行中|需要配置/.test(JSON.stringify(r.json?.data ?? {}));
    check(`「${problem}」→ ${String(ans).slice(0, 40)}`, ok(String(ans)), `status=${r.status}`);
    check(`   答案无中文污染且无占位文本`, clean, `answer=${String(ans).slice(0, 60)}`);
  }

  console.log('\n=== 4. 错题本与举一反三 ===');
  const mk = await req('GET', '/questions/mistakes', { token });
  check('GET /questions/mistakes 不返回 500', mk.status === 200 || mk.status === 404, `status=${mk.status} ${mk.raw.slice(0, 150)}`);
  const byCat = await req('GET', '/questions/mistakes/by-category', { token });
  check('错题按知识点分组可访问', byCat.status === 200, `status=${byCat.status}`);
  const sim = await req('GET', '/questions/similar?category=' + encodeURIComponent('极限计算'), { token });
  const simList = sim.json?.data?.questions || sim.json?.data || [];
  const simOk = Array.isArray(simList) && simList.length > 0;
  check(`举一反三(极限计算) 返回同类题目 ${Array.isArray(simList) ? simList.length : '?'} 道`, simOk, `status=${sim.status}`);
  if (simOk) {
    check('   返回题目知识点匹配', simList.every((q) => String(q.knowledgePoint || q.category || '').includes('极限')),
      JSON.stringify(simList.slice(0, 2).map((q) => q.knowledgePoint || q.category)));
  }

  console.log('\n=== 5. 学习进度（真实数据源）===');
  const rec = await req('POST', '/student/knowledge/practice', {
    token,
    body: { conceptId: '极限计算', isCorrect: false, problemId: 'selftest-probe', timeSpent: 30 },
  });
  check('练习上报可写入', rec.status === 200 || rec.status === 201, `status=${rec.status} ${rec.raw.slice(0, 150)}`);
  const stats = await req('GET', '/student/knowledge/summary', { token });
  check('学习摘要可读取', stats.status === 200, `status=${stats.status} ${stats.raw.slice(0, 150)}`);
  const prog = await req('GET', '/student/knowledge/progress', { token });
  check('学习进度可读取', prog.status === 200, `status=${prog.status} ${prog.raw.slice(0, 150)}`);

  console.log('\n=== 6. 公开接口（无需 token）===');
  const h = await req('GET', '/health');
  check('/health 公开可访问', h.status === 200, `status=${h.status}`);
  const q = await req('GET', '/questions/random');
  check('/questions/random 公开出题', q.status === 200, `status=${q.status}`);

  console.log('\n=== 7. 题库与诊断接口 ===');
  const kp = await req('GET', '/questions/knowledge-points', { token });
  check('题库知识点列表可访问', kp.status === 200, `status=${kp.status}`);
  const qstats = await req('GET', '/questions/stats', { token });
  check('题库统计可访问', qstats.status === 200, `status=${qstats.status}`);
  const special = await req('GET', '/questions/practice/special', { token });
  check('专项练习可访问', special.status === 200, `status=${special.status}`);
  const diag = await req('POST', '/agents/diagnose', {
    token,
    body: { problem: '求导：x^3', studentAnswer: 'x^2', solution: { finalAnswer: '3*x**2' } },
  });
  check('POST /agents/diagnose 可用且给出诊断', diag.status === 200 || diag.status === 201, `status=${diag.status} ${diag.raw.slice(0, 150)}`);
  const fb = await req('POST', '/agents/feedback', {
    token,
    body: { problem: '求导：x^3', studentAnswer: 'x^2', solution: { finalAnswer: '3*x**2' } },
  });
  check('POST /agents/feedback 可用且给出反馈', fb.status === 200 || fb.status === 201, `status=${fb.status} ${fb.raw.slice(0, 150)}`);

  console.log(`\n========================================`);
  console.log(`通过 ${pass} / ${pass + fail}`);
  if (failures.length) console.log('失败项:\n  - ' + failures.join('\n  - '));
  console.log(`========================================`);
  process.exit(fail ? 1 : 0);
})();
