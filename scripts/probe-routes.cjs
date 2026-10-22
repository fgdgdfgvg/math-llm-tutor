const http = require('http');
const BASE = process.env.API_URL || 'http://localhost:3000';
function req(method, path, { token, body } = {}) {
  return new Promise((resolve) => {
    const url = new URL(BASE + path);
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
    const r = http.request({ hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { let j = null; try { j = JSON.parse(d); } catch {} resolve({ status: res.statusCode, raw: d.slice(0, 120), json: j }); });
    });
    r.on('error', e => resolve({ status: 0, raw: e.message, json: null }));
    r.setTimeout(20000, () => { r.destroy(); resolve({ status: -1, raw: 'timeout', json: null }); });
    if (payload) r.write(payload); r.end();
  });
}
(async () => {
  const u = 'probe_' + Date.now().toString(36);
  await req('POST', '/user/register', { body: { username: u, password: 'Test123456' } });
  const lg = await req('POST', '/user/login', { body: { username: u, password: 'Test123456' } });
  const token = lg.json?.data?.access_token || lg.json?.data?.accessToken;
  console.log('token:', token ? 'ok' : 'FAILED ' + lg.raw);

  const probes = [
    ['GET', '/health'],
    ['GET', '/questions/random'],
    ['GET', '/questions/mistakes'],
    ['GET', '/questions/mistakes/by-category'],
    ['GET', '/questions/similar?category=极限计算'],
    ['GET', '/questions/knowledge-points'],
    ['GET', '/questions/stats'],
    ['GET', '/questions/practice/special'],
    ['GET', '/student/knowledge/all'],
    ['GET', '/student/knowledge/summary'],
    ['GET', '/student/knowledge/progress'],
    ['GET', '/learning/progress'],
    ['GET', '/knowledge/graph'],
    ['GET', '/knowledge/search?q=极限'],
    ['GET', '/knowledge/common-mistakes'],
    ['GET', '/knowledge/concepts'],
    ['GET', '/interactive-learning/cognitive-state'],
    ['GET', '/interactive-learning/graph/dynamic'],
    ['POST', '/formula-renderer/render', { latex: 'x^2' }],
    ['POST', '/ai-solver/solve', { problem: 'x^2' }],
    ['POST', '/multimodal/speech/recognize', {}],
  ];
  for (const [m, p, body] of probes) {
    const r = await req(m, p, { token, body });
    const flag = r.status === 404 || r.status === 500 || r.status === 0 ? '❌' : (r.status === 401 || r.status === 403 ? '🔒' : '✅');
    console.log(`${flag} ${m} ${p} -> ${r.status}  ${r.raw.replace(/\s+/g, ' ').slice(0, 100)}`);
  }
})();
