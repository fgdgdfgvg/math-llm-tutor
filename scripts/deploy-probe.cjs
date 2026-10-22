#!/usr/bin/env node
/**
 * 部署加固探针：在真实进程上验证"上线后才暴露、单测覆盖不到"的那批行为。
 *
 *   node scripts/deploy-probe.cjs            # 默认端口 3121+
 *   node scripts/deploy-probe.cjs --verbose  # 打印每个检查的响应体
 *
 * 覆盖项（均为实测过的真实缺陷回归）：
 *   1. 限流来源不可伪造 —— 默认不信任 X-Forwarded-For，伪造该头无法刷新配额桶
 *   2. 受信代理下不可伪造 —— TRUST_PROXY=1 时取的是"最后一跳追加的真实 IP"，
 *      客户端自行塞进 XFF 的值不会成为限流键
 *   3. 安全响应头存在且不再暴露 X-Powered-By
 *   4. CORS 拒绝返回 403（而不是被归一化成 500，污染 5xx 监控）
 *   5. 生产环境默认不下发 Swagger；显式 ENABLE_SWAGGER=true 才开放
 *   6. /health/live 恒快且不查依赖；/health/ready 反映关键依赖
 *
 * 退出码：0 全部通过；1 有失败。
 */
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BACKEND = path.join(ROOT, 'nestjs-backend');
const BASE_PORT = 3121;
const VERBOSE = process.argv.includes('--verbose');

// 生产场景专用 JWT_SECRET（≥32 字符）。CI 的 auth-integration 环境里
// JWT_SECRET 占位符只有 30 字符，会被 validateServerEnv 的长度硬校验（<32）
// 拒绝启动，导致"生产"场景的后端永远起不来、探针超时失败。
// 这里显式注入一个探测专用占位符，仅用于验证"生产加固行为"，不含任何真实密钥。
const PROBE_JWT_SECRET = 'deploy-probe-jwt-secret-not-for-production-0123456789';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok });
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`);
}

/** 起一个后端实例，等待 /health/live 可用 */
async function startBackend(label, port, env) {
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: BACKEND,
    env: { ...process.env, PORT: String(port), REDIS_URL: '', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (d) => (log += d.toString()));
  child.stderr.on('data', (d) => (log += d.toString()));

  for (let i = 1; i <= 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health/live`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) return { child, log: () => log };
    } catch {
      /* 尚未监听 */
    }
    await sleep(1500);
  }
  child.kill();
  throw new Error(`[${label}] 后端在 60s 内未启动：\n${log.slice(-1500)}`);
}

async function post(port, pathname, headers) {
  const res = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: '{}',
  });
  const text = await res.text();
  if (VERBOSE) console.log(`      ${pathname} → ${res.status} ${text.slice(0, 160)}`);
  return { status: res.status, headers: res.headers, text };
}

async function get(port, pathname, headers = {}) {
  const res = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  if (VERBOSE) console.log(`      ${pathname} → ${res.status} ${text.slice(0, 160)}`);
  return { status: res.status, headers: res.headers, text };
}

/** 打 LLM 限流桶（/agents/solve 命中 /solve 规则），返回状态序列 */
async function burst(port, n, headerFor) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    out.push((await post(port, '/agents/solve', headerFor(i))).status);
  }
  return out;
}

(async () => {
  console.log('部署加固探针\n');
  const started = [];

  try {
    // ───────────────────────────────────────── 1. 默认不信任 XFF
    {
      const port = BASE_PORT;
      const { child } = await startBackend('默认', port, { NODE_ENV: 'development' });
      started.push(child);
      console.log('【1】默认配置（TRUST_PROXY 未设置）—— 伪造 X-Forwarded-For 不应绕过限流');
      const seq = await burst(port, 25, (i) => ({ 'X-Forwarded-For': `10.0.0.${i}` }));
      const blocked = seq.filter((s) => s === 429).length;
      record('每次换一个伪造 IP 连打 25 次仍被限流', blocked > 0, `429 × ${blocked}（阈值 20）`);
      record(
        '响应中不含 X-Powered-By',
        !(await get(port, '/health/live')).headers.get('x-powered-by'),
      );
      const h = (await get(port, '/health/live')).headers;
      record(
        '安全响应头齐备（nosniff / DENY / no-referrer）',
        h.get('x-content-type-options') === 'nosniff' &&
          h.get('x-frame-options') === 'DENY' &&
          h.get('referrer-policy') === 'no-referrer',
        `nosniff=${h.get('x-content-type-options')} frameguard=${h.get('x-frame-options')} referrer=${h.get('referrer-policy')}`,
      );
      record(
        '开发环境不下发 HSTS（否则打断本机 http 调试）',
        !h.get('strict-transport-security'),
      );
      const live = await get(port, '/health/live');
      record(
        '存活探针不查依赖且毫秒级',
        live.status === 200 && /"status":"alive"/.test(live.text),
      );
      record(
        '开发环境仍开放 Swagger',
        [200, 301, 302].includes((await get(port, '/api/docs')).status),
      );
      child.kill();
      await sleep(600);
    }

    // ───────────────────────────────────────── 2. 受信代理下也拿不到伪造值
    {
      const port = BASE_PORT + 1;
      const { child } = await startBackend('可信代理', port, {
        NODE_ENV: 'development',
        TRUST_PROXY: '1',
      });
      started.push(child);
      console.log('\n【2】TRUST_PROXY=1（nginx 一跳）—— 限流键应为 nginx 追加的真实 IP');
      // 模拟 nginx：$proxy_add_x_forwarded_for 会把真实客户端 IP 追加到客户端自带的 XFF 之后
      const seq = await burst(port, 25, (i) => ({
        'X-Forwarded-For': `10.0.0.${i}, 203.0.113.9`,
      }));
      const blocked = seq.filter((s) => s === 429).length;
      record(
        '客户端伪造的前缀不影响限流分桶（真实 IP 仍被识别）',
        blocked > 0,
        `429 × ${blocked}（伪造段每次不同，若被采信则应为 0）`,
      );
      const seq2 = await burst(port, 25, () => ({ 'X-Forwarded-For': '198.51.100.7, 203.0.113.9' }));
      record(
        '同一真实 IP 从新伪造值再次请求仍被拒',
        seq2.filter((s) => s === 429).length > 0,
        `429 × ${seq2.filter((s) => s === 429).length}`,
      );
      child.kill();
      await sleep(600);
    }

    // ───────────────────────────────────────── 3. 生产环境基线
    {
      const port = BASE_PORT + 2;
      const { child } = await startBackend('生产', port, {
        NODE_ENV: 'production',
        CORS_ORIGIN: 'http://localhost:5173',
        TRUST_PROXY: '1',
        JWT_SECRET: PROBE_JWT_SECRET,
      });
      started.push(child);
      console.log('\n【3】生产环境 —— CORS 拒绝语义 / 文档收敛 / HSTS');

      const rejected = await get(port, '/health/live', { Origin: 'http://evil.example' });
      record(
        '不在白名单的来源被拒绝且状态为 403（不是 500）',
        rejected.status === 403,
        `HTTP ${rejected.status}`,
      );
      record(
        '拒绝响应不含堆栈（生产不泄露内部细节）',
        !/"stack"/.test(rejected.text),
        rejected.text.slice(0, 80),
      );

      const allowed = await get(port, '/health/live', { Origin: 'http://localhost:5173' });
      record(
        '白名单来源正常放行并回 ACAO',
        allowed.status === 200 && allowed.headers.get('access-control-allow-origin') === 'http://localhost:5173',
        `HTTP ${allowed.status} ACAO=${allowed.headers.get('access-control-allow-origin')}`,
      );
      record(
        '生产环境下发 HSTS',
        Boolean(allowed.headers.get('strict-transport-security')),
        allowed.headers.get('strict-transport-security') || '',
      );
      record(
        '生产环境默认不注册 Swagger（HTTP 404）',
        (await get(port, '/api/docs')).status === 404,
      );
      record(
        '就绪探针 /health/ready 反映 Mongo 可用（redis 未配置按单实例算就绪）',
        [200, 503].includes((await get(port, '/health/ready')).status),
        `HTTP ${(await get(port, '/health/ready')).status}`,
      );
      child.kill();
      await sleep(600);
    }

    // ───────────────────────────────────────── 4. 显式放开 Swagger
    {
      const port = BASE_PORT + 3;
      const { child } = await startBackend('Swagger 显式开放', port, {
        NODE_ENV: 'production',
        CORS_ORIGIN: 'http://localhost:5173',
        ENABLE_SWAGGER: 'true',
        JWT_SECRET: PROBE_JWT_SECRET,
      });
      started.push(child);
      console.log('\n【4】生产环境 + ENABLE_SWAGGER=true');
      record(
        '显式开启后 Swagger 可访问',
        [200, 301, 302].includes((await get(port, '/api/docs')).status),
      );
      child.kill();
      await sleep(600);
    }
  } catch (err) {
    record('探针执行', false, err.message);
  } finally {
    for (const c of started) {
      try {
        c.kill();
      } catch {
        /* 已退出 */
      }
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n' + '═'.repeat(52));
  if (failed.length === 0) {
    console.log(`✓ 全部通过（${results.length} 项）`);
    process.exit(0);
  }
  console.log(`✗ 失败 ${failed.length}/${results.length} 项：${failed.map((f) => f.name).join('；')}`);
  process.exit(1);
})();
