#!/usr/bin/env node
'use strict';
/**
 * 一键系统自检 (self-check)
 *
 * 一条命令确认「整站是否真的可用」，用于每次改完代码后的回归：
 *   0. 环境探测      Node 版本 / 关键文件 / Docker 守护进程 / 运行模式选择
 *   1. 启动依赖服务  MongoDB、Redis、SymPy（+ 后端）；Docker 模式或本机进程模式
 *   2. 后端健康      /health 里 mongodb / sympy / neo4j 的真实状态
 *   3. 题库就绪      questions 集合题量、知识点覆盖（空库自动播种是否生效）
 *   4. 五类题目      极限 / 导数 / 积分 / 方程 / 微分方程（真实求解，不是占位文本）
 *   5. 学习闭环      注册 → 错题归档 → 错题本分组 → 练习上报 → 清理临时账号
 *   6. 汇总          逐项结果 + 退出码（0 = 系统可用，1 = 有致命问题）
 *
 * 用法：
 *   node self-check.cjs                    # 自动选择 Docker 或本机模式
 *   node self-check.cjs --mode docker      # 强制 docker compose（守护进程没起会自动拉起）
 *   node self-check.cjs --mode local       # 强制本机进程（本地 MongoDB + sympy-service/venv）
 *   node self-check.cjs --no-start         # 不启动任何服务，只体检已在运行的服务
 *   node self-check.cjs --full             # 额外跑 probe-routes / e2e-verify
 *   node self-check.cjs --with-frontend    # 额外验证前端页面可访问
 *   node self-check.cjs --keep             # 保留自检临时账号与数据（默认清理）
 *   node self-check.cjs --stop             # 停止本脚本此前启动的本机进程后退出
 *   node self-check.cjs --build            # 本机模式下强制重新构建后端
 *   node self-check.cjs --timeout=300      # 等待服务就绪的最长秒数（默认 240）
 */
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { createRequire } = require('module');

// ───────────────────────────── 基础设置 ─────────────────────────────
const ROOT = __dirname;
const BACKEND_DIR = path.join(ROOT, 'nestjs-backend');
const SYMPY_DIR = path.join(ROOT, 'sympy-service');
const FRONTEND_DIR = path.join(ROOT, 'uniapp-frontend');
// vite/uni 默认把 dev server 绑到 ::1（仅 IPv6），必须显式 --host 127.0.0.1，
// 否则用 127.0.0.1 探测永远连不上（旧脚本前端检查失败的根因）。
const FRONTEND_DEV_URL = 'http://127.0.0.1:5173/';
const FRONTEND_DEV_HOST_ARGS = ['--host', '127.0.0.1', '--port', '5173'];
const FRONTEND_DEV_URLS = [FRONTEND_DEV_URL, 'http://localhost:5173/'];
const RUNTIME_DIR = path.join(ROOT, '.self-check');
const PID_FILE = path.join(RUNTIME_DIR, 'pids.json');
const REPORT_FILE = path.join(RUNTIME_DIR, 'report.json');

const backendRequire = createRequire(path.join(BACKEND_DIR, 'package.json'));

const argv = process.argv.slice(2);
const readFlag = (name, fallback) => {
  const index = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (index === -1) return fallback;
  const token = argv[index];
  if (token.includes('=')) return token.slice(token.indexOf('=') + 1);
  // 支持 `--mode local` 与 `--mode=local` 两种写法
  const next = argv[index + 1];
  return next && !next.startsWith('--') ? next : true;
};

const opts = {
  mode: String(readFlag('mode', 'auto')),
  noStart: Boolean(readFlag('no-start', false)),
  stop: Boolean(readFlag('stop', false)),
  keep: Boolean(readFlag('keep', false)),
  full: Boolean(readFlag('full', false)),
  withFrontend: Boolean(readFlag('with-frontend', false)),
  build: Boolean(readFlag('build', false)),
  timeout: Number(readFlag('timeout', 240)) || 240,
  port: Number(readFlag('port', 3000)) || 3000,
};
const BASE_URL = `http://127.0.0.1:${opts.port}`;

const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (text) => (COLOR ? `\x1b[${code}m${text}\x1b[0m` : String(text));
const bold = paint('1');
const dim = paint('2');
const green = paint('32');
const red = paint('31');
const yellow = paint('33');
const cyan = paint('36');

const startedAt = Date.now();
const results = []; // { phase, name, ok, fatal, detail, hint }
const runtime = { mode: 'local', compose: ['docker', 'compose'], startedLocal: {}, envFile: {} };
let currentPhase = '环境探测';

const section = (title) => {
  currentPhase = title;
  console.log(`\n${cyan('▶')} ${bold(title)}`);
};
const out = (line) => console.log(`  ${line}`);

function record(name, ok, { detail = '', hint = '', fatal = true, warnOnly = false } = {}) {
  results.push({ phase: currentPhase, name, ok, fatal: fatal && !warnOnly, detail, hint });
  if (ok) {
    out(`${green('✓')} ${name}${detail ? '  ' + dim(detail) : ''}`);
  } else if (warnOnly) {
    out(`${yellow('!')} ${name}${detail ? '  ' + dim(detail) : ''}`);
  } else {
    out(`${red('✗')} ${name}${detail ? '  ' + dim(detail) : ''}`);
    if (hint) out(`  ${yellow('↳')} ${dim(hint)}`);
  }
  return ok;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Abort extends Error {}

function run(cmd, args, { cwd = ROOT, timeout = 60_000, env, shell = false } = {}) {
  const result = spawnSync(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout,
    shell,
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    code: result.status === null ? (result.error ? -1 : -2) : result.status,
    out: (result.stdout || '').trim(),
    err: (result.stderr || '').trim(),
    error: result.error,
  };
}

const runShell = (command, cwd = ROOT, timeout = 600_000) => run(command, [], { cwd, timeout, shell: true });

// ───────────────────────────── 网络工具 ─────────────────────────────
function tcpOpen(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

async function httpOnce(method, url, { token, body, timeoutMs = 20_000, connectionClose = false } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  // 重试时强制关闭连接，避开 keep-alive 连接被服务端回收导致的偶发 ECONNRESET
  if (connectionClose) headers.connection = 'close';
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* 非 JSON 响应 */
    }
    return { status: res.status, json, text };
  } catch (error) {
    return { status: 0, json: null, text: String(error?.message || error) };
  }
}

/** 网络层偶发失败（status=0）自动重试一次，避免把抖动误报成系统故障 */
async function http(method, url, options = {}) {
  const first = await httpOnce(method, url, options);
  if (first.status !== 0) return first;
  await sleep(700);
  const second = await httpOnce(method, url, { ...options, connectionClose: true });
  if (second.status !== 0 && !options.quiet) {
    out(dim(`（${method} ${url.replace(BASE_URL, '')} 首次连接失败，重试成功）`));
  }
  return second;
}

const unwrap = (payload) => (payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload);

async function waitFor(label, probe, timeoutSec = opts.timeout, intervalMs = 2000) {
  const deadline = Date.now() + timeoutSec * 1000;
  let last = '';
  process.stdout.write(`  ${dim(`等待 ${label} 就绪…`)}`);
  while (Date.now() < deadline) {
    const verdict = await probe();
    if (verdict === true) {
      process.stdout.write(`\r  ${green('✓')} ${label} 已就绪${' '.repeat(20)}\n`);
      return true;
    }
    if (typeof verdict === 'string') last = verdict;
    process.stdout.write(`\r  ${dim(`等待 ${label} 就绪… ${Math.round((Date.now() - (deadline - timeoutSec * 1000)) / 1000)}s ${last ? '(' + last + ')' : ''}`)}${' '.repeat(10)}`);
    await sleep(intervalMs);
  }
  process.stdout.write(`\r  ${red('✗')} ${label} 等待超时（${timeoutSec}s）${last ? '：' + last : ''}${' '.repeat(10)}\n`);
  return false;
}

const waitForHttp = (url, timeoutSec, { expect = (s) => s === 200, timeoutMs = 8000 } = {}) =>
  waitFor(url, async () => {
    const res = await http('GET', url, { timeoutMs, quiet: true });
    return expect(res.status) ? true : `HTTP ${res.status}`;
  }, timeoutSec);

// ───────────────────────────── 运行环境探测 ─────────────────────────────
function readEnvFile(file) {
  try {
    const map = {};
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !line.trim().startsWith('#')) map[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return map;
  } catch {
    return {};
  }
}

function parseMongoUri(uri) {
  try {
    const url = new URL(uri);
    return {
      host: url.hostname || '127.0.0.1',
      port: Number(url.port || 27017),
      auth: Boolean(url.username),
    };
  } catch {
    return { host: '127.0.0.1', port: 27017, auth: false };
  }
}

/** 递归取 src 下最新的 .ts 修改时间，用来判断 dist 是否为最新构建 */
function newestSourceMtime(dir) {
  let newest = 0;
  const walk = (current) => {
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ts')) {
        try {
          newest = Math.max(newest, fs.statSync(full).mtimeMs);
        } catch {
          /* ignore */
        }
      }
    }
  };
  walk(dir);
  return newest;
}

function detectDocker() {
  const version = run('docker', ['--version'], { timeout: 20_000 });
  if (version.code !== 0) return { cli: false, daemon: false };
  const info = run('docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: 25_000 });
  let compose = ['docker', 'compose'];
  if (run('docker', ['compose', 'version'], { timeout: 20_000 }).code !== 0) {
    compose = run('docker-compose', ['version'], { timeout: 20_000 }).code === 0 ? ['docker-compose'] : null;
  }
  return { cli: true, daemon: info.code === 0, serverVersion: info.out, compose };
}

function dockerDesktopPath() {
  const candidates = [
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Docker', 'Docker', 'Docker Desktop.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Docker', 'Docker Desktop.exe'),
    '/Applications/Docker.app',
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

async function ensureDockerDaemon() {
  const exe = dockerDesktopPath();
  if (!exe) {
    out(`${red('✗')} 找不到 Docker Desktop，无法自动启动守护进程`);
    return false;
  }
  out(`${yellow('!')} Docker 守护进程没在运行，正在启动 ${dim(path.basename(exe))}（首次启动通常 1-2 分钟）`);
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', exe], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn('open', ['-a', 'Docker'], { detached: true, stdio: 'ignore' }).unref();
  }
  return waitFor('Docker 守护进程', () => run('docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: 20_000 }).code === 0, opts.timeout, 5000);
}

// ───────────────────────────── 本机进程管理 ─────────────────────────────
function loadPids() {
  try {
    return JSON.parse(fs.readFileSync(PID_FILE, 'utf8'));
  } catch {
    return {};
  }
}
function savePids(pids) {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  fs.writeFileSync(PID_FILE, JSON.stringify(pids, null, 2));
}
function killPid(pid) {
  if (!pid) return false;
  if (process.platform === 'win32') {
    return run('taskkill', ['/PID', String(pid), '/T', '/F'], { timeout: 20_000 }).code === 0;
  }
  try {
    process.kill(pid, 'SIGTERM');
    return true;
  } catch {
    return false;
  }
}

function startDetached(name, command, args, { cwd, env = {}, shell = false } = {}) {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  const logPath = path.join(RUNTIME_DIR, `${name}.log`);
  fs.appendFileSync(logPath, `\n===== ${new Date().toISOString()} 启动 =====\n`);
  const stdio = ['ignore', fs.openSync(logPath, 'a'), fs.openSync(logPath, 'a')];
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    detached: true,
    shell,
    stdio,
  });
  child.unref();
  const pids = loadPids();
  pids[name] = child.pid;
  savePids(pids);
  out(`${dim(`已启动 ${name}（pid=${child.pid}，日志 .self-check/${name}.log）`)}`);
  return child.pid;
}

async function stopStarted() {
  const pids = loadPids();
  const entries = Object.entries(pids);
  if (!entries.length) {
    console.log('没有记录到本脚本启动的进程。');
    return;
  }
  for (const [name, pid] of entries) {
    const ok = killPid(pid);
    console.log(`${ok ? green('✓') : yellow('!')} 停止 ${name}（pid=${pid}）`);
  }
  try {
    fs.unlinkSync(PID_FILE);
  } catch {
    /* ignore */
  }
  console.log(dim('（Docker 容器用 `docker compose down` 停止）'));
}

// ───────────────────────────── 阶段 0：环境探测 ─────────────────────────────
async function phaseEnvironment() {
  section('0/8 环境探测');
  runtime.envFile = readEnvFile(path.join(BACKEND_DIR, '.env'));

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  record(`Node ${process.versions.node}`, nodeMajor >= 18, {
    detail: nodeMajor >= 18 ? '全局 fetch / AbortSignal.timeout 可用' : '需要 Node 18+',
    hint: '升级 Node 到 18 或以上',
  });

  const files = [
    ['nestjs-backend/dist/main.js', path.join(BACKEND_DIR, 'dist', 'main.js'), '先在本机模式运行一次（会自动构建）'],
    ['datasets/math.json', path.join(ROOT, 'datasets', 'math.json'), '题库种子文件缺失，空库会没有题目'],
    ['sympy-service/main.py', path.join(SYMPY_DIR, 'main.py'), '符号计算服务源码缺失'],
  ];
  for (const [label, file, hint] of files) {
    record(`文件 ${label}`, fs.existsSync(file), { detail: fs.existsSync(file) ? '' : '缺失', hint, fatal: false });
  }

  const docker = detectDocker();
  runtime.docker = docker;

  if (opts.mode === 'docker') {
    if (!docker.cli) throw new Abort('本机没有安装 docker CLI，无法使用 --mode docker');
    if (!docker.daemon && !opts.noStart && !(await ensureDockerDaemon())) {
      throw new Abort('Docker 守护进程未能启动；可改用 --mode local 走本机进程模式');
    }
    runtime.mode = 'docker';
    runtime.compose = docker.compose || ['docker', 'compose'];
  } else if (opts.mode === 'local') {
    runtime.mode = 'local';
  } else if (docker.daemon) {
    runtime.mode = 'docker';
    runtime.compose = docker.compose || ['docker', 'compose'];
  } else {
    runtime.mode = 'local';
  }

  record(`运行模式：${runtime.mode === 'docker' ? 'Docker 容器' : '本机进程'}`, true, {
    detail: runtime.mode === 'docker'
      ? `Docker ${docker.serverVersion || 'daemon'} / ${runtime.compose.join(' ')}`
      : docker.cli
        ? 'Docker 守护进程未运行，改用本地 MongoDB + sympy-service/venv + node dist/main.js'
        : '本机未安装 docker CLI，使用本地进程',
    fatal: false,
  });

  if (runtime.mode === 'local') {
    const mongoUri = runtime.envFile.MONGODB_URI || 'mongodb://127.0.0.1:27017/math_llm_tutor';
    const mongo = parseMongoUri(mongoUri);
    runtime.mongo = mongo;
    runtime.mongoUri = mongoUri;
  } else {
    const hostPort = Number(process.env.MONGO_HOST_PORT || 27018);
    runtime.mongo = { host: '127.0.0.1', port: hostPort, auth: true };
    runtime.mongoUri = `mongodb://${process.env.MONGO_ROOT_USER || 'root'}:${process.env.MONGO_ROOT_PASSWORD || '123456'}@127.0.0.1:${hostPort}/math_llm_tutor?authSource=admin`;
  }
}

// ───────────────────────────── 阶段 1：启动依赖服务 ─────────────────────────────
const COMPOSE_HEALTHY = {
  math_tutor_mongodb: 'MongoDB',
  math_tutor_redis: 'Redis',
  math_tutor_sympy: 'SymPy 符号计算服务',
};
const COMPOSE_ALL = { ...COMPOSE_HEALTHY, math_tutor_backend: 'NestJS 后端' };

function containerHealth(name) {
  const res = run('docker', ['inspect', '--format', '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}', name], { timeout: 20_000 });
  if (res.code !== 0) return 'missing';
  return res.out || 'unknown';
}

async function ensureContainers(containerMap) {
  const names = Object.keys(containerMap);
  return waitFor(
    names.join(' / '),
    async () => {
      const bad = names.filter((n) => containerHealth(n) !== 'healthy');
      if (!bad.length) return true;
      return bad
        .map((n) => {
          const status = containerHealth(n);
          if (status === 'missing') return `${n} 不存在`;
          return `${n} ${status}`;
        })
        .join(', ');
    },
    opts.timeout,
    4000,
  );
}

async function phaseStartDependencies() {
  section('2/8 启动依赖服务');

  if (runtime.mode === 'docker') {
    const compose = runtime.compose;
    const composeArgs = (rest) => [...compose.slice(1), ...rest];

    const up = (services, timeout) =>
      run(compose[0], composeArgs(['up', '-d', ...services]), { timeout, env: process.env });

    if (opts.noStart) {
      out(dim('--no-start：只检查容器现状，不启动'));
    } else {
      const deps = up(['mongodb', 'redis', 'sympy-service'], 900_000);
      if (deps.code !== 0) {
        out(`${yellow('!')} docker compose up 输出：${dim((deps.err || deps.out).split('\n').slice(-4).join(' | '))}`);
      }
    }
    const depsReady = await ensureContainers(COMPOSE_HEALTHY);
    record('容器化的 MongoDB / Redis / SymPy 全部 healthy', depsReady, {
      detail: Object.keys(COMPOSE_HEALTHY).map((n) => `${n}=${containerHealth(n)}`).join(' '),
      hint: '查看 `docker compose logs <服务名>`；SymPy 容器启动较慢，可加大 --timeout',
    });
    if (!depsReady) throw new Abort('依赖容器未就绪，后续检查没有意义');

    if (!opts.noStart) {
      // 镜像比源码旧时，先提醒再构建：避免自检报告的是上一个版本的容器行为
      const imageId = run('docker', ['inspect', '--format', '{{.Image}}', 'math_tutor_backend'], { timeout: 20_000 }).out;
      const created = imageId
        ? run('docker', ['inspect', '--format', '{{.Created}}', imageId], { timeout: 20_000 }).out
        : '';
      const imageTime = created ? Date.parse(created) : 0;
      const sourceTime = newestSourceMtime(path.join(BACKEND_DIR, 'src'));
      const staleImage = Boolean(imageTime) && sourceTime > imageTime;

      const backendUp = run(
        compose[0],
        composeArgs(['up', '-d', ...(staleImage && opts.build ? ['--build'] : []), 'backend']),
        { timeout: 1_200_000 },
      );
      if (backendUp.code !== 0) {
        out(`${yellow('!')} backend 启动失败：${dim((backendUp.err || backendUp.out).split('\n').slice(-4).join(' | '))}`);
      }

      // 镜像比源码旧时要么现在重建，要么明确提醒：否则自检报告的是上一版的容器行为
      if (staleImage) {
        const rebuiltAt = run('docker', ['inspect', '--format', '{{.Created}}', 'math_tutor_backend'], { timeout: 20_000 }).out;
        const rebuiltTime = rebuiltAt ? Date.parse(rebuiltAt) : 0;
        if (rebuiltTime > imageTime) {
          record('后端镜像已按 --build 重建', true, { detail: `新镜像 ${new Date(rebuiltTime).toLocaleString()}`, fatal: false });
        } else {
          record('后端镜像落后于源码', false, {
            detail: `镜像构建于 ${new Date(imageTime).toLocaleString()}，源码更新`,
            hint: '加 --build 重新构建（本次自检验证的是旧镜像）',
            fatal: false,
          });
        }
      }
    }
    // --no-start 时不长时间等待，没人应答就直接报错
    const backendHealthy = await waitForHttp(`${BASE_URL}/health`, opts.noStart ? 10 : opts.timeout);
    record('容器化后端 /health 返回 200', backendHealthy, {
      detail: `container=${containerHealth('math_tutor_backend')}`,
      hint: opts.noStart
        ? `${BASE_URL} 没有后端在监听（--no-start 不会启动服务）`
        : 'docker compose logs backend；常见原因是 LEAN_WORKSPACE_DIR 不可写或 MongoDB 凭据错误',
    });
    if (!backendHealthy) throw new Abort('后端未就绪，无法继续');

    if (opts.withFrontend && !opts.noStart) {
      out(dim('启动前端容器（--with-frontend）…'));
      const frontend = run(compose[0], composeArgs(['up', '-d', 'frontend']), { timeout: 900_000 });
      if (frontend.code !== 0) {
        out(`${yellow('!')} 前端容器启动失败：${dim((frontend.err || frontend.out).split('\n').slice(-4).join(' | '))}`);
      }
    }
    return;
  }

  // ── 本机进程模式 ──
  const mongo = runtime.mongo;

  if (await tcpOpen(mongo.host, mongo.port)) {
    record(`MongoDB ${mongo.host}:${mongo.port} 可连接`, true, { detail: runtime.envFile.MONGODB_URI || '' , fatal: false });
  } else {
    const service = run('sc', ['query', 'MongoDB'], { timeout: 15_000 });
    const installed = service.code === 0;
    if (installed && !opts.noStart) {
      run('net', ['start', 'MongoDB'], { timeout: 60_000 });
      await waitFor('MongoDB 服务', () => tcpOpen(mongo.host, mongo.port), 60, 2000);
    }
    const up = await tcpOpen(mongo.host, mongo.port);
    record(`MongoDB ${mongo.host}:${mongo.port} 可连接`, up, {
      detail: up ? '' : installed ? '服务已安装但未监听' : '未检测到 MongoDB 服务',
      hint: '启动本地 MongoDB（Windows 服务名 MongoDB），或执行 `docker compose up -d mongodb` 后加 --mode docker',
    });
    if (!up) throw new Abort('MongoDB 不可用，无法继续');
  }

  const venvPython = path.join(SYMPY_DIR, 'venv', 'Scripts', 'python.exe');
  const venvPythonUnix = path.join(SYMPY_DIR, 'venv', 'bin', 'python');
  const sympyUp = await tcpOpen('127.0.0.1', 8000);
  if (sympyUp) {
    record('SymPy 服务 127.0.0.1:8000 可连接', true);
  } else if (!opts.noStart) {
    const python = fs.existsSync(venvPython) ? venvPython : fs.existsSync(venvPythonUnix) ? venvPythonUnix : null;
    if (python) {
      startDetached('sympy', python, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000'], { cwd: SYMPY_DIR });
      const ok = await waitFor('SymPy 服务', () => tcpOpen('127.0.0.1', 8000), Math.min(opts.timeout, 120), 2000);
      record('SymPy 服务（sympy-service/venv）已启动', ok, {
        detail: ok ? '' : 'venv 启动失败',
        hint: `查看 .self-check/sympy.log，或改用 --mode docker`,
        fatal: false,
      });
    } else {
      record('SymPy 服务可用', false, {
        detail: 'sympy-service/venv 不存在，本机也没有可用的 python',
        hint: '执行 `docker compose up -d sympy-service` 后用 --mode docker 自检（后端会走本地计算引擎降级，但不推荐）',
        fatal: false,
      });
    }
  } else {
    record('SymPy 服务可用', false, { detail: '--no-start 且服务未运行', fatal: false });
  }

  const backendUp = await http('GET', `${BASE_URL}/health`, { timeoutMs: 5000 });
  if (backendUp.status === 200) {
    record(`后端 ${BASE_URL} 已在运行`, true, { detail: '复用已在运行的后端（如需验证最新代码，请先停掉它再自检）', fatal: false });
    if (opts.withFrontend && !opts.noStart) await ensureLocalFrontend();
    return;
  }

  if (opts.noStart) {
    throw new Abort(`--no-start 且 ${BASE_URL} 没有后端在运行`);
  }

  const distMain = path.join(BACKEND_DIR, 'dist', 'main.js');
  const stale = !fs.existsSync(distMain) || newestSourceMtime(path.join(BACKEND_DIR, 'src')) > fs.statSync(distMain).mtimeMs;
  if (stale) {
    record('构建产物落后于源码', false, {
      detail: fs.existsSync(distMain) ? 'dist 比 src 旧，需要重新构建' : 'dist 不存在',
      hint: '下面会自动执行 npm run build；如不需要可加 --no-start 自行接管',
      fatal: false,
    });
  }
  if (stale || opts.build) {
    out(dim('构建后端（npm run build）…'));
    const build = runShell('npm run build', BACKEND_DIR, 900_000);
    record('后端构建成功', build.code === 0, {
      detail: build.code === 0 ? '' : (build.err || build.out).split('\n').slice(-3).join(' | '),
      hint: '在 nestjs-backend 目录执行 npm run build 查看完整报错',
    });
    if (build.code !== 0) throw new Abort('后端构建失败');
  }

  startDetached('backend', process.execPath, ['dist/main.js'], {
    cwd: BACKEND_DIR,
    env: {
      ...runtime.envFile, // .env 里的配置优先于当前 shell
      PORT: String(opts.port),
      NODE_ENV: runtime.envFile.NODE_ENV || 'development',
    },
  });
  const ready = await waitForHttp(`${BASE_URL}/health`, opts.timeout);
  record('后端已启动并通过 /health', ready, {
    detail: 'pid 记录在 .self-check/pids.json',
    hint: 'tail -50 .self-check/backend.log',
  });
  if (!ready) throw new Abort('后端未能启动');

  // --with-frontend：本机模式同样把 H5 dev server 拉起来（首次编译较慢），
  // 否则第 7 阶段的前端可用性检查在 Docker 未运行时永远失败（只能人工去起）。
  if (opts.withFrontend && !opts.noStart) await ensureLocalFrontend();
}

/**
 * 本机模式下按需启动前端 H5 dev server（--with-frontend）。
 * 已在运行则复用；启动失败只提示不阻塞（自检末尾会如实汇报）。
 */
async function probeFrontendDev() {
  for (const url of FRONTEND_DEV_URLS) {
    const res = await http('GET', url, { timeoutMs: 5000 });
    if (res.status === 200 && /<div id="app"|<html/i.test(res.text)) return url;
  }
  return null;
}

async function ensureLocalFrontend() {
  const alreadyUp = await probeFrontendDev();
  if (alreadyUp) {
    record('前端 dev server（:5173）已在运行', true, {
      detail: `复用已在运行的前端（${alreadyUp}）`,
      fatal: false,
    });
    return;
  }
  out(dim('启动前端 H5 dev server（--with-frontend，首次编译约 30~90s）…'));
  startDetached('frontend', `npm run dev:h5 -- ${FRONTEND_DEV_HOST_ARGS.join(' ')}`, [], {
    cwd: FRONTEND_DIR,
    shell: true,
  });
  const frontendReady = Boolean(
    await waitFor(
      '前端 dev server',
      async () => Boolean(await probeFrontendDev()),
      Math.min(opts.timeout, 180),
      3000,
    ),
  );
  record('前端 dev server 已启动（:5173）', frontendReady, {
    detail: frontendReady ? '' : '启动超时',
    hint: 'tail -50 .self-check/frontend.log，或在 uniapp-frontend 手动执行 npm run dev:h5',
    fatal: false,
  });
}

// ───────────────────────────── 阶段 1：单元自检（静态） ─────────────────────────────
/**
 * 静态单元自检：不依赖任何服务，几秒内跑完。
 * 这里放的是“改错公式/改错规则不会立刻被发现”的那类回归：
 *   - 后端 jest：数学表达式引擎、答案等价判定、注册提权回归
 *   - 前端 utils/math 自检：ε-δ / 凹凸性 / 黎曼和 / 级数 / 知识图谱路径
 *   - SymPy 服务自检：双侧极限 / +C / 未求值检测 / sin2x 语义
 */
async function phaseUnitSuites() {
  section('1/8 单元自检（静态，不需要任何服务）');

  const backendCwd = path.join(ROOT, 'nestjs-backend');
  const backend = runShell('npm test -- --silent', backendCwd, 300_000);
  record('后端单元测试（jest）', backend.code === 0, {
    detail: extractJestSummary(`${backend.out}\n${backend.err}`),
    hint: 'cd nestjs-backend && npm test',
  });

  const frontendCwd = path.join(ROOT, 'uniapp-frontend');
  const frontendCheck = path.join(frontendCwd, 'scripts', 'math-utils.selfcheck.cjs');
  if (fs.existsSync(frontendCheck)) {
    const math = run('node', [path.join('scripts', 'math-utils.selfcheck.cjs')], {
      cwd: frontendCwd,
      timeout: 120_000,
    });
    record('前端数学工具自检（ε-δ / 凹凸性 / 黎曼和 / 级数 / 图谱）', math.code === 0, {
      detail: extractCheckSummary(`${math.out}\n${math.err}`),
      hint: 'cd uniapp-frontend && npm run test:math',
    });
  }

  const sympyCwd = path.join(ROOT, 'sympy-service');
  const sympyCheck = path.join(sympyCwd, 'selfcheck.py');
  if (fs.existsSync(sympyCheck)) {
    const python = findPython();
    if (!python) {
      record('SymPy 服务自检', false, {
        detail: '未找到可用的 Python 解释器',
        hint: '安装 Python 或创建 sympy-service/venv 后重试',
        fatal: false,
      });
    } else {
      const sympy = run(python, ['selfcheck.py'], { cwd: sympyCwd, timeout: 180_000 });
      record('SymPy 服务自检（双侧极限 / 积分 +C / sin2x 语义）', sympy.code === 0, {
        detail: extractCheckSummary(`${sympy.out}\n${sympy.err}`),
        hint: 'cd sympy-service && python selfcheck.py',
      });
    }
  }
}

/** 从 jest 输出里提取一行摘要 */
function extractJestSummary(output) {
  const line = String(output || '')
    .split(/\r?\n/)
    .filter((l) => /Tests:\s+\d/.test(l) || /Test Suites:/.test(l))
    .join('  ');
  return line.trim().slice(0, 160) || '无输出';
}

/** 从自检脚本输出里提取 "通过 N 项，失败 M 项" */
function extractCheckSummary(output) {
  const match = String(output || '').match(/通过\s*\d+\s*项，失败\s*\d+\s*项/);
  return match ? match[0] : '无摘要输出';
}

/** 找一个可用的 Python：优先 sympy-service 的 venv */
function findPython() {
  const candidates = [
    path.join(ROOT, 'sympy-service', 'venv', 'bin', 'python'),
    path.join(ROOT, 'sympy-service', 'venv', 'Scripts', 'python.exe'),
    path.join(ROOT, 'python-sympy-service', 'venv', 'Scripts', 'python.exe'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  for (const name of ['python3', 'python']) {
    const probe = run(name, ['--version'], { timeout: 15_000 });
    if (probe.code === 0) return name;
  }
  return null;
}

// ───────────────────────────── 阶段 2：后端与依赖健康 ─────────────────────────────
async function phaseHealth() {
  section('3/8 后端与依赖健康');
  const health = await http('GET', `${BASE_URL}/health`, { timeoutMs: 15_000 });
  const data = unwrap(health.json) || {};
  const services = data.services || {};

  record(`GET /health → ${health.status}`, health.status === 200, {
    detail: `overall=${data.status || 'unknown'}`,
    hint: '检查 .self-check/backend.log',
  });
  if (health.status !== 200) throw new Abort('/health 不可用');

  for (const key of ['mongodb', 'sympy', 'neo4j']) {
    const svc = services[key] || {};
    const state = svc.status || 'unknown';
    const healthy = state === 'healthy';
    // neo4j 允许内存降级；sympy 失败不致命（本地计算引擎仍能解五类题），但要显眼提示
    const warnOnly = key !== 'mongodb';
    record(`${key}: ${state}`, healthy || warnOnly, {
      detail: svc.message || '',
      hint:
        key === 'mongodb'
          ? 'MongoDB 连不上：检查 MONGODB_URI / 容器凭据'
          : key === 'sympy'
            ? 'SymPy 不可用时求解质量下降，建议 `docker compose up -d sympy-service`'
            : 'Neo4j 未配置会走内存降级（知识图谱重启后重置）',
      warnOnly,
    });
  }

  const detailed = await http('GET', `${BASE_URL}/health/detailed`, { timeoutMs: 20_000 });
  const stats = unwrap(detailed.json)?.databaseStats || {};
  if (stats.questionCount !== undefined) {
    record('数据库统计可读', true, { detail: `用户 ${stats.userCount} / 题目 ${stats.questionCount} / 错题 ${stats.mistakeCount}`, fatal: false });
  }
}

// ───────────────────────────── 阶段 3：题库就绪 ─────────────────────────────
async function phaseQuestionBank() {
  section('4/8 题库就绪');
  const res = await http('GET', `${BASE_URL}/questions/stats`, { timeoutMs: 20_000 });
  const stats = unwrap(res.json) || {};
  const total = Number(stats.total || 0);
  const points = Object.keys(stats.byKnowledgePoint || {});

  record(`题库题量 ${total} 道`, total > 0, {
    detail: points.length ? `${points.length} 个知识点 / 难度分布 ${JSON.stringify(stats.byDifficulty || {}).slice(0, 80)}` : '',
    hint: '题库为空：确认 SEED_QUESTIONS=true 且 datasets/ 已挂载（Docker），或检查 QuestionSeedService 启动日志',
  });
  record(`知识点覆盖（前 3：${points.slice(0, 3).join('、') || '无'}）`, points.length >= 3, {
    detail: `${points.length} 个知识点`,
    hint: '知识点太少会导致“点哪个知识点都出同一批题”，检查 math.json 导入',
  });

  const random = await http('GET', `${BASE_URL}/questions/random`, { timeoutMs: 20_000 });
  const question = unwrap(random.json);
  record('随机出题接口返回真实题目', random.status === 200 && Boolean(question?.content || question?.questionContent), {
    detail: String(question?.content || question?.questionContent || '').slice(0, 40),
  });

  return points;
}

// ───────────────────────────── 阶段 4：五类题目求解 ─────────────────────────────
function runSuite(label, file, { args = [], env = {}, timeout = 900_000 } = {}) {
  out(dim(`执行 ${file}`));
  const res = run(process.execPath, [file, ...args], { env: { API_URL: BASE_URL, ...env }, timeout });
  const text = `${res.out}\n${res.err}`.trim();
  for (const line of text.split('\n')) {
    if (line.trim()) out(`${dim('│')} ${line.replace(/^\s+/, '')}`);
  }
  const okCount = (text.match(/[✓✅]/g) || []).length;
  const badCount = (text.match(/[✗❌]/g) || []).length;
  return { ok: res.code === 0 && badCount === 0, detail: `通过标记 ${okCount} / 失败标记 ${badCount} / exit=${res.code}`, text };
}

/** 后端对 LLM 类接口有频率限制（默认 5 分钟 20 次），连续自检会撞上 429 */
const RATE_LIMIT_RE = /429|请求过于频繁|rate limit/i;
function parseRetryAfter(text) {
  // 同一个套件里可能有多个 429 响应，取最大的等待时间
  const values = [...text.matchAll(/请在\s*(\d+)\s*秒后重试/g), ...text.matchAll(/"retryAfter"\s*:\s*(\d+)/g)].map(
    (m) => Number(m[1]),
  );
  return values.length ? Math.max(...values) : null;
}

/**
 * 跑到一半被限流就等过窗口再试一次：连续自检很容易撞上
 * RateLimitGuard 的「LLM 接口 5 分钟 20 次」，那是环境限流，不是求解链路故障。
 * 等待总量有上限，仍然被限流则标记 rateLimited 交由调用方决定是警告还是算失败。
 */
async function runSuiteWithRetry(label, file, { tolerant = false } = {}) {
  let res = runSuite(label, file);
  let waited = 0;

  while (!res.ok && RATE_LIMIT_RE.test(res.text) && waited < 400) {
    const after = parseRetryAfter(res.text);
    const waitSec = Math.min(after ? after + 5 : 90, 400 - waited, Math.max(opts.timeout, 330));
    out(`${yellow('!')} 被后端限流（LLM 接口默认 5 分钟 20 次），等待 ${waitSec}s 后重试`);
    const deadline = Date.now() + waitSec * 1000;
    while (Date.now() < deadline) {
      const left = Math.ceil((deadline - Date.now()) / 1000);
      process.stdout.write(`\r  ${dim(`限流等待中… 剩余 ${left}s`)}${' '.repeat(12)}`);
      await sleep(Math.min(5000, Math.max(500, deadline - Date.now())));
    }
    process.stdout.write(`\r  ${green('✓')} 限流窗口已结束，重新执行 ${file}${' '.repeat(20)}\n`);
    waited += waitSec;
    res = runSuite(label, file);
    res.rateLimitedRetry = waited;
  }

  res.rateLimited = !res.ok && RATE_LIMIT_RE.test(res.text);
  if (res.rateLimited && tolerant) {
    record(`${label} 套件被限流，本次未完整验证`, false, {
      detail: res.detail,
      hint: '调大 RATE_LIMIT_LLM_MAX_REQUESTS / RATE_LIMIT_LLM_WINDOW_MS，或等 5 分钟后再跑',
      warnOnly: true,
    });
  }
  return res;
}

async function phaseSolving() {
  section('5/8 五类题目求解（极限 / 导数 / 积分 / 方程 / 微分方程）');
  const suite = await runSuiteWithRetry('smoke', 'smoke-test.js');
  const limited = suite.rateLimited;
  record('五类题目全部返回正确结果', suite.ok, {
    detail: suite.rateLimitedRetry ? `${suite.detail}（限流等待 ${suite.rateLimitedRetry}s 后重试）` : suite.detail,
    hint: limited
      ? '仍在限流：调大 RATE_LIMIT_LLM_MAX_REQUESTS / RATE_LIMIT_LLM_WINDOW_MS，或等 5 分钟后再跑'
      : '逐个看上面的 ✗ 行；本地计算引擎在 nestjs-backend/src/modules/agents/local-computation',
  });
  if (!suite.ok) {
    record('求解链路可用', false, { detail: '存在失败用例', hint: '求解失败时后面的闭环检查意义不大' });
    throw new Abort('求解回归未通过');
  }
}

// ───────────────────────────── 阶段 5：学习闭环（错题本） ─────────────────────────────
function credentiallessMongoUri(uri) {
  try {
    const url = new URL(uri);
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    return uri;
  }
}

/** 连不上带鉴权的 URI 时（本地 MongoDB 常常没事配鉴权）自动降级重试 */
async function connectMongo() {
  const { MongoClient } = backendRequire('mongodb');
  const candidates = [runtime.mongoUri, credentiallessMongoUri(runtime.mongoUri)];
  let lastError;
  for (const uri of candidates) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 6000 });
    try {
      await client.connect();
      await client.db().command({ ping: 1 });
      return client;
    } catch (error) {
      lastError = error;
      await client.close().catch(() => {});
    }
  }
  throw lastError || new Error('MongoDB 连接失败');
}

const PER_USER_COLLECTIONS = [
  'mistakes',
  'studentknowledges',
  'studentprofiles',
  'learningrecords',
  'learninginsights',
  'learningbehaviors',
  'dialoguesessions',
  'problems',
];

/** 按用户名查询条件删除账号及其学习数据，返回清理明细 */
async function purgeAccounts(userQuery, extraIds = []) {
  const client = await connectMongo();
  const db = client.db();
  const users = await db.collection('users').find(userQuery).project({ username: 1 }).toArray();
  if (!users.length) {
    await client.close();
    return { deletedUser: 0, names: [], purged: [] };
  }
  const names = users.map((u) => u.username);
  const ids = [...names, ...users.map((u) => String(u._id)), ...extraIds].filter(Boolean);
  const purged = [];
  for (const name of PER_USER_COLLECTIONS) {
    if (!(await db.listCollections({ name }).hasNext())) continue;
    const res = await db.collection(name).deleteMany({ $or: [{ userId: { $in: ids } }, { username: { $in: names } }] });
    if (res.deletedCount) purged.push(`${name}×${res.deletedCount}`);
  }
  const deleted = await db.collection('users').deleteMany(userQuery);
  await client.close();
  return { deletedUser: deleted.deletedCount, names, purged };
}

const cleanupTempUser = (username, extraIds = []) => purgeAccounts({ username }, extraIds);

async function phaseLearningLoop(knowledgePoints) {
  section('6/8 学习闭环（注册 → 错题归档 → 错题本 → 练习上报）');
  const username = `selfcheck_${Date.now().toString(36)}`;
  const password = 'SelfCheck123456';

  const reg = await http('POST', `${BASE_URL}/user/register`, { body: { username, password }, timeoutMs: 30_000 });
  const regOk = reg.status === 201 || reg.status === 200;
  record('用户注册（写入 MongoDB）', regOk, {
    detail: `status=${reg.status} ${JSON.stringify(unwrap(reg.json) || reg.text).slice(0, 100)}`,
    hint: '注册失败说明用户功能不可用',
  });

  const login = await http('POST', `${BASE_URL}/user/login`, { body: { username, password }, timeoutMs: 30_000 });
  const loginData = unwrap(login.json) || {};
  const token = loginData.access_token || loginData.accessToken || loginData.token;
  record('登录返回 JWT', Boolean(token), {
    detail: token ? `${String(token).slice(0, 18)}…` : JSON.stringify(loginData || login.text).slice(0, 120),
    hint: '登录失败后续闭环无法进行',
  });

  const profile = await http('GET', `${BASE_URL}/user/profile`, { token });
  record('携带 JWT 能读到 /user/profile', profile.status === 200, {
    detail: `status=${profile.status} user=${unwrap(profile.json)?.username || unwrap(profile.json)?.user?.username || ''}`,
  });

  let closedLoopOk = Boolean(token);
  let knowledgePoint = knowledgePoints.includes('极限计算') ? '极限计算' : knowledgePoints[0];

  if (token) {
    const similar = await http('GET', `${BASE_URL}/questions/similar?category=${encodeURIComponent(knowledgePoint)}&limit=3`, { timeoutMs: 20_000 });
    const list = (() => {
      const payload = unwrap(similar.json);
      if (Array.isArray(payload)) return payload;
      return payload?.questions || [];
    })();
    const matches = list.filter((q) => {
      const kp = String(q.knowledgePoint || q.category || '');
      const text = `${q.content || q.questionContent || ''} ${(q.subConcepts || []).join(' ')}`;
      return kp.includes(knowledgePoint) || text.includes(knowledgePoint.slice(0, 2));
    });
    record(`举一反三「${knowledgePoint}」返回同类题且不乱出题`, list.length > 0 && matches.length === list.length, {
      detail: `${list.length} 道，命中知识点 ${matches.length} 道`,
      hint: '若返回的是别的知识点（例如点积分出极限题），检查 questions.service 的知识点解析',
    });

    const question = list[0];
    const mistakeBody = {
      questionId: String(question?.questionId || question?._id || `selfcheck-${Date.now()}`),
      questionContent: String(question?.content || question?.questionContent || `${knowledgePoint} 自检题`),
      userAnswer: '__selfcheck_wrong__',
      correctAnswer: String(question?.correctAnswer || question?.answer || '1'),
      solutionSteps: Array.isArray(question?.solutionSteps) ? question.solutionSteps.map(String) : ['自检占位步骤'],
      knowledgePoint: String(question?.knowledgePoint || knowledgePoint),
      subConcepts: Array.isArray(question?.subConcepts) ? question.subConcepts.map(String) : [knowledgePoint],
      difficulty: String(question?.difficulty || '基础'),
    };

    const created = await http('POST', `${BASE_URL}/questions/mistakes`, { token, body: mistakeBody, timeoutMs: 20_000 });
    record('答错后错题写入成功（201）', created.status === 201 || created.status === 200, {
      detail: `status=${created.status} ${JSON.stringify(unwrap(created.json)).slice(0, 80)}`,
      hint: '400 通常是 body 里混入了未声明的字段（全局 forbidNonWhitelisted 会直接拒绝）',
    });

    const mistakeList = await http('GET', `${BASE_URL}/questions/mistakes?page=1&limit=50`, { token, timeoutMs: 20_000 });
    const payload = unwrap(mistakeList.json);
    const mistakes = Array.isArray(payload) ? payload : payload?.mistakes || [];
    const hit = mistakes.find((m) => String(m.questionId) === mistakeBody.questionId);
    record('错题本能读到刚写入的错题', Boolean(hit), {
      detail: `共 ${mistakes.length} 条，知识点=${hit?.knowledgePoint || '未匹配'}`,
      hint: '错题本读不到时，前端会退化成“无视知识点乱出题”',
    });

    const grouped = await http('GET', `${BASE_URL}/questions/mistakes/by-category`, { token, timeoutMs: 20_000 });
    const groupedText = JSON.stringify(unwrap(grouped.json) || {});
    record('错题按知识点分组（by-category）', grouped.status === 200 && groupedText.includes(knowledgePoint), {
      detail: `status=${grouped.status} 命中「${knowledgePoint}」=${groupedText.includes(knowledgePoint)}`,
    });

    const practice = await http('POST', `${BASE_URL}/student/knowledge/practice`, {
      token,
      body: { conceptId: knowledgePoint, isCorrect: false, problemId: mistakeBody.questionId, timeSpent: 30 },
      timeoutMs: 20_000,
    });
    record('练习结果上报（掌握度数据源）', practice.status === 200 || practice.status === 201, {
      detail: `status=${practice.status}`,
    });

    const summary = await http('GET', `${BASE_URL}/student/knowledge/summary`, { token, timeoutMs: 20_000 });
    record('学习摘要可读取（真实数据）', summary.status === 200 && Boolean(unwrap(summary.json)), {
      detail: `status=${summary.status} ${JSON.stringify(unwrap(summary.json)).slice(0, 80)}`,
    });

    const progress = await http('GET', `${BASE_URL}/learning/progress`, { token, timeoutMs: 20_000 });
    record('学习进度接口可用', progress.status === 200, { detail: `status=${progress.status}`, fatal: false });

    closedLoopOk = closedLoopOk && created.status < 300 && Boolean(hit);
  }

  if (opts.keep) {
    out(`${yellow('!')} --keep：保留自检账号 ${username} / ${password}`);
  } else {
    try {
      const { purged, deletedUser } = await cleanupTempUser(username, [unwrap(reg.json)?.id, unwrap(reg.json)?._id, unwrap(login.json)?.user?.id]);
      record(`清理自检数据（账号 ${username}）`, deletedUser > 0, {
        detail: `删除账号 ${deletedUser} 个，清理用户数据 ${purged.join('、') || '无'}`,
        hint: '清理失败可执行 `node reset-test-data.cjs` 恢复演示数据',
        fatal: false,
      });
      const relogin = await http('POST', `${BASE_URL}/user/login`, { body: { username, password }, timeoutMs: 20_000 });
      record('自检账号已从数据库移除', relogin.status !== 200 && relogin.status !== 201, {
        detail: `重新登录返回 ${relogin.status}`,
        fatal: false,
      });
    } catch (error) {
      record('清理自检数据', false, {
        detail: String(error.message).slice(0, 120),
        hint: `数据库清理失败（URI=${runtime.mongoUri}），可手动执行 node reset-test-data.cjs`,
        fatal: false,
      });
    }
  }

  if (!closedLoopOk) throw new Abort('学习闭环未打通');
}

// ───────────────────────────── 阶段 6：可选项与汇总 ─────────────────────────────
async function phaseExtras() {
  if (!opts.full && !opts.withFrontend) return;
  section('7/8 附加检查');
  if (opts.full) {
    const probe = await runSuiteWithRetry('probe', 'probe-routes.cjs', { tolerant: true });
    if (!probe.rateLimited) record('路由探测（21 条接口，无 404/500）', probe.ok, { detail: probe.detail });
    const e2e = await runSuiteWithRetry('e2e', 'e2e-verify.cjs', { tolerant: true });
    if (!e2e.rateLimited) {
      record('端到端脚本 e2e-verify', e2e.ok, {
        detail: e2e.detail,
        hint: 'e2e 会注册临时账号，可用 node reset-test-data.cjs 清理',
      });
    }
  }
  if (opts.full && !opts.keep) {
    // probe-routes / e2e-verify 会自建临时账号，自检顺手清掉，保持演示库干净
    try {
      const { deletedUser, names, purged } = await purgeAccounts({ username: /^(probe_|e2e_|selftest_|assess_|graphtest_)/ });
      record('清理附加检查产生的临时账号', true, {
        detail: deletedUser ? `${deletedUser} 个（${names.slice(0, 4).join(', ')}），用户数据 ${purged.join('、') || '无'}` : '无遗留账号',
        fatal: false,
      });
    } catch (error) {
      record('清理附加检查产生的临时账号', false, {
        detail: String(error.message).slice(0, 100),
        hint: '可手动执行 node reset-test-data.cjs',
        fatal: false,
      });
    }
  }

  if (opts.withFrontend) {
    const candidates = ['http://127.0.0.1/', ...FRONTEND_DEV_URLS];
    let ok = false;
    for (const url of candidates) {
      const res = await http('GET', url, { timeoutMs: 10_000 });
      if (res.status === 200 && /<div id="app"|<html/i.test(res.text)) {
        record(`前端可访问 ${url}`, true, { detail: `${res.text.length} 字节 HTML` });
        ok = true;
        break;
      }
    }
    if (!ok) {
      record('前端页面可访问（:80 或 :5173）', false, {
        detail: candidates.map((u) => u).join(' / ') + ' 都没有响应',
        hint: 'Docker 前端：docker compose up -d frontend；开发：在 uniapp-frontend 执行 npm run dev:h5',
      });
    }
  }
}

function summarize() {
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  const failed = results.filter((r) => !r.ok && r.fatal);
  const warned = results.filter((r) => !r.ok && !r.fatal);
  const passed = results.filter((r) => r.ok);

  console.log(`\n${bold('════════════ 自检汇总 ════════════')}`);
  let lastPhase = '';
  for (const r of results) {
    if (r.phase !== lastPhase) {
      console.log(`\n ${bold(r.phase)}`);
      lastPhase = r.phase;
    }
    const mark = r.ok ? green('✓') : r.fatal ? red('✗') : yellow('!');
    console.log(`   ${mark} ${r.name}${r.detail ? dim('  — ' + r.detail) : ''}`);
  }

  console.log(`\n${bold('═════════════════════════════════')}`);
  console.log(`模式：${runtime.mode === 'docker' ? 'Docker 容器' : '本机进程'}  后端：${BASE_URL}  耗时 ${elapsed}s`);
  console.log(`通过 ${green(String(passed.length))} / 共 ${results.length} 项${warned.length ? `（${yellow(String(warned.length))} 项非致命警告）` : ''}`);

  if (failed.length) {
    console.log(`\n${red('系统存在致命问题：')}`);
    for (const r of failed) console.log(`  ${red('✗')} [${r.phase}] ${r.name}${r.hint ? dim('  ↳ ' + r.hint) : ''}`);
    console.log(`\n${red('自检未通过')}（退出码 1）`);
  } else {
    console.log(`\n${green('系统可用：依赖、题库、五类题目求解、用户与错题本闭环均正常。')}（退出码 0）`);
  }

  try {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    fs.writeFileSync(
      REPORT_FILE,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          mode: runtime.mode,
          baseUrl: BASE_URL,
          elapsedSeconds: Number(elapsed),
          passed: passed.length,
          total: results.length,
          fatalFailures: failed.map((r) => ({ phase: r.phase, name: r.name, hint: r.hint })),
          warnings: warned.map((r) => ({ phase: r.phase, name: r.name, detail: r.detail })),
          results,
        },
        null,
        2,
      ),
    );
    console.log(dim(`报告：${path.relative(ROOT, REPORT_FILE)}`));
  } catch {
    /* 报告写不出去不影响退出码 */
  }

  return failed.length ? 1 : 0;
}

// ───────────────────────────── 主流程 ─────────────────────────────
(async () => {
  console.log(bold('\n高等数学 LLM 教学系统 · 一键自检'));
  console.log(dim(`项目：${ROOT}\n时间：${new Date().toLocaleString()}  平台：${os.platform()} ${os.release()}`));

  if (opts.stop) {
    await stopStarted();
    process.exit(0);
  }

  let exitCode = 1;
  try {
    await phaseEnvironment();
    await phaseUnitSuites();
    await phaseStartDependencies();
    await phaseHealth();
    const points = await phaseQuestionBank();
    await phaseSolving();
    await phaseLearningLoop(points);
    await phaseExtras();
    exitCode = summarize();
  } catch (error) {
    if (error instanceof Abort) {
      console.log(`\n${red('自检中止：')} ${error.message}`);
    } else {
      console.log(`\n${red('自检异常：')} ${error.stack || error.message}`);
    }
    exitCode = summarize();
  }
  process.exit(exitCode);
})();
