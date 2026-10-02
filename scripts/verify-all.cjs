/**
 * 统一验证门禁：一次跑完"能不能交付"的全部静态与单元检查。
 *
 * 用法：node scripts/verify-all.cjs          （或 npm run verify）
 * 内容：
 *   1. 后端类型检查   tsc -p tsconfig.build.json --noEmit
 *   2. 后端单元测试   jest（15 套件）
 *   3. 前端类型检查   vue-tsc --noEmit
 *   4. 密钥扫描       scripts/secret-scan.cjs --scan
 *   5. 日志卫生扫描   scripts/log-hygiene-scan.cjs
 *
 * 不包含需要外部依赖（MongoDB/Redis/SymPy/Neo4j）的集成自检——
 * 那部分用 `node self-check.cjs --mode local --full`（会先重新构建 dist）。
 * 退出码：0 = 全绿；1 = 有失败。
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BACKEND = path.join(ROOT, 'nestjs-backend');
const FRONTEND = path.join(ROOT, 'uniapp-frontend');
const NODE = process.execPath;

function run(label, command, args, cwd, timeoutMs = 900_000) {
  const started = Date.now();
  process.stdout.write(`\n▶ ${label}\n`);
  const res = spawnSync(command, args, { cwd, timeout: timeoutMs, encoding: 'utf8', shell: false });
  const out = `${res.stdout || ''}${res.stderr || ''}`.trim();
  const ok = res.status === 0;
  const tail = out.split('\n').filter((l) => l.trim()).slice(-6).join('\n');
  console.log(tail || '(无输出)');
  console.log(`${ok ? '✓' : '✗'} ${label}（${((Date.now() - started) / 1000).toFixed(1)}s）`);
  return ok;
}

function exists(p) {
  return fs.existsSync(p);
}

const results = [];

results.push([
  '后端类型检查',
  exists(path.join(BACKEND, 'node_modules/typescript/bin/tsc'))
    ? run('后端类型检查', NODE, [path.join(BACKEND, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.build.json', '--noEmit'], BACKEND)
    : run('后端类型检查', 'npx', ['tsc', '-p', 'tsconfig.build.json', '--noEmit'], BACKEND),
]);

results.push([
  '后端单元测试',
  run('后端单元测试', NODE, [path.join(BACKEND, 'node_modules/jest/bin/jest.js'), '--silent'], BACKEND),
]);

results.push([
  '前端类型检查',
  exists(path.join(FRONTEND, 'node_modules/vue-tsc/bin/vue-tsc.js'))
    ? run('前端类型检查', NODE, [path.join(FRONTEND, 'node_modules/vue-tsc/bin/vue-tsc.js'), '--noEmit', '-p', 'tsconfig.json'], FRONTEND)
    : run('前端类型检查', 'npx', ['vue-tsc', '--noEmit', '-p', 'tsconfig.json'], FRONTEND),
]);

results.push(['密钥扫描', run('密钥扫描', NODE, [path.join(ROOT, 'scripts/secret-scan.cjs'), '--scan'], ROOT)]);
results.push(['日志卫生扫描', run('日志卫生扫描', NODE, [path.join(ROOT, 'scripts/log-hygiene-scan.cjs')], ROOT)]);

const failed = results.filter(([, ok]) => !ok).map(([name]) => name);
console.log('\n' + '═'.repeat(52));
if (failed.length === 0) {
  console.log(`✓ 全部通过（${results.length} 项）：可以提交 / 部署`);
  process.exit(0);
}
console.log(`✗ 失败 ${failed.length} 项：${failed.join('、')}`);
process.exit(1);
