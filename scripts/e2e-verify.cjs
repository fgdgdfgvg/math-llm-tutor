/* 临时端到端验证脚本：注册→登录→profile→解题→错题记录→按知识点出同类题 */
const API = process.env.API_URL || 'http://localhost:3000';

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

const unwrap = (r) => (r.body && typeof r.body === 'object' && 'data' in r.body ? r.body.data : r.body);

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
};

(async () => {
  const username = `e2e_${Date.now().toString(36)}`;
  const password = 'test123456';

  console.log('=== 1. 用户注册 ===');
  const reg = await req('POST', '/user/register', { username, password });
  const regUser = unwrap(reg);
  check('注册成功', reg.status < 300, `status=${reg.status}`);
  check(
    '注册响应是干净的用户对象（无 mongoose 内部字段/密码）',
    !!regUser && typeof regUser === 'object' && regUser.username === username && !('$__' in regUser) && !('password' in regUser),
    JSON.stringify(regUser),
  );

  console.log('\n=== 2. 用户登录 ===');
  const login = await req('POST', '/user/login', { username, password });
  const loginData = unwrap(login);
  const token = loginData?.access_token;
  check('登录返回 JWT', !!token, token ? `${token.slice(0, 20)}...` : 'no token');

  console.log('\n=== 3. 用户档案（前端刷新后恢复记录用） ===');
  const profile = await req('GET', '/user/profile', null, token);
  const profileData = unwrap(profile);
  check(
    'profile 能取到 username',
    !!profileData?.username || !!profileData?.user?.username,
    JSON.stringify(profileData).slice(0, 120),
  );

  console.log('\n=== 4. 微积分题目求解（极限） ===');
  const solveLimit = await req('POST', '/agents/solve', { problem: '求极限 lim(x→0) sin(x)/x' });
  const limitData = unwrap(solveLimit);
  check('极限题返回正确结果 1', String(limitData?.finalAnswer).includes('1'), `finalAnswer=${limitData?.finalAnswer}`);
  const steps = limitData?.solutionSteps || [];
  check('返回了可解析的解题步骤', steps.length > 0, `${steps.length} 步`);
  let parsedOk = false;
  let parsedTitle = '';
  try {
    const first = JSON.parse(steps[0]);
    parsedTitle = first.stepTitle || first.description || '';
    parsedOk = !!parsedTitle;
  } catch { /* 非 JSON 步骤 */ }
  check('步骤含可展示的标题字段', parsedOk, parsedTitle);

  console.log('\n=== 5. 微积分题目求解（导数） ===');
  const solveDeriv = await req('POST', '/agents/solve', { problem: "求导数 d/dx (x^3 + 2x)" });
  const derivData = unwrap(solveDeriv);
  const derivAnswer = String(derivData?.finalAnswer ?? '');
  check(
    '导数题结果含 3x²+2',
    /3\s*\*\*\s*2|3\s*x\s*\*\*\s*2|3x\^2|3\*x\*\*2|3\s*x\^2/.test(derivAnswer.replace(/\s/g, '')) || derivAnswer.replace(/\s/g, '').includes('3*x**2+2'),
    `finalAnswer=${derivAnswer}`,
  );

  console.log('\n=== 6. 错题记录写入与读取 ===');
  const create = await req('POST', '/questions/mistakes', {
    questionId: 'E2E-LIMIT-001',
    questionContent: '计算极限 lim(x→0) sin(x)/x',
    userAnswer: '0',
    correctAnswer: '1',
    solutionSteps: ['使用重要极限 sin(x)/x → 1'],
    knowledgePoint: '极限计算',
    subConcepts: ['重要极限'],
    difficulty: '基础',
  }, token);
  check('错题写入成功', create.status < 300, `status=${create.status}`);

  const list = await req('GET', '/questions/mistakes?page=1&limit=50', null, token);
  const listData = unwrap(list);
  const mistakes = Array.isArray(listData) ? listData : (listData?.mistakes || []);
  check('错题本能读到刚才的错题', mistakes.some(m => m.questionId === 'E2E-LIMIT-001'), `共 ${mistakes.length} 条`);
  check('错题带知识点归档', mistakes.some(m => m.knowledgePoint === '极限计算'), mistakes.map(m => m.knowledgePoint).join(', '));

  console.log('\n=== 7. 举一反三：按知识点出同类题 ===');
  const similar = await req('GET', `/questions/similar?category=${encodeURIComponent('极限计算')}&limit=10`, null, token);
  const similarData = unwrap(similar);
  const similarList = Array.isArray(similarData) ? similarData : [];
  check('按知识点取到同类题', similarList.length > 0, `${similarList.length} 道`);
  const allMatch = similarList.length > 0 && similarList.every(q =>
    (q.knowledgePoint || '').includes('极限计算') ||
    (q.subConcepts || []).some(s => s.includes('极限')) ||
    (q.content || '').includes('极限'),
  );
  check('同类题确实命中该知识点（没有乱出题）', allMatch, similarList.slice(0, 3).map(q => q.knowledgePoint).join(' | '));

  console.log('\n=== 8. 答案解析与反馈接口 ===');
  const diagnose = await req('POST', '/agents/diagnose', {
    problem: '计算极限 lim(x→0) sin(x)/x',
    studentAnswer: '0',
    solution: limitData ?? null,
  }, token);
  check('diagnose 返回结果', diagnose.status < 300 && !!unwrap(diagnose), `status=${diagnose.status}`);

  const feedback = await req('POST', '/agents/feedback', {
    problem: '计算极限 lim(x→0) sin(x)/x',
    studentAnswer: '0',
    solution: limitData ?? null,
    diagnosis: unwrap(diagnose),
  }, token);
  const fb = unwrap(feedback);
  check('feedback 返回结果', feedback.status < 300 && !!fb, `status=${feedback.status}`);

  const failed = results.filter(r => !r.ok);
  console.log(`\n===== 结果：${results.length - failed.length}/${results.length} 通过 =====`);
  if (failed.length) {
    console.log('失败项：');
    failed.forEach(f => console.log(` - ${f.name}: ${f.detail}`));
    process.exitCode = 1;
  }
})().catch(err => {
  console.error('❌ 脚本异常:', err);
  process.exitCode = 1;
});
