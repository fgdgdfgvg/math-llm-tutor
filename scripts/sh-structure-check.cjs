#!/usr/bin/env node
/**
 * start-all.sh 结构化校验。
 *
 * 为什么不用 `bash -n`：本机 bash 会转发到 wsl.exe，而 wsl.exe 在安全策略黑名单里，
 * 无法执行；因此改用结构断言（块关键字配平 / 花括号配平 / 双引号配平 + 关键修复点回归），
 * 覆盖本项目历史上真实出现过的 4 类脚本缺陷。
 *
 *   node scripts/sh-structure-check.cjs      退出码 0 = 通过
 */
const fs = require('fs');
const path = require('path');

const target = process.argv[2] || path.join(__dirname, '..', 'scripts', 'start-all.sh');
const src = fs.readFileSync(target, 'utf8');
const lines = src.split('\n');
let bad = 0;
const fail = (m) => {
  console.log('  ✗ ' + m);
  bad++;
};
console.log('校验文件: ' + target + '\n');

// 1) 块关键字配平
let depthIf = 0,
  depthFor = 0,
  depthWhile = 0;
lines.forEach((l) => {
  const code = l.replace(/#.*$/, '').trim();
  if (/^if\b/.test(code)) depthIf++;
  if (/^fi\b/.test(code)) depthIf--;
  if (/^for\b/.test(code)) depthFor++;
  if (/^done\b/.test(code)) depthFor--;
  if (/^while\b/.test(code)) depthWhile++;
});
console.log('块配平: if/fi=' + depthIf + ' for/done=' + depthFor + ' while=' + depthWhile);
if (depthIf !== 0) fail('if/fi 不配平（差 ' + depthIf + '）');
if (depthFor !== 0) fail('for/done 不配平');
if (depthWhile !== 0) fail('while 不配平');

// 2) 花括号配平（排除 ${...} 变量展开）
const braceSrc = src.replace(/\$\{[^}]*\}/g, '');
const open = (braceSrc.match(/\{/g) || []).length;
const close = (braceSrc.match(/\}/g) || []).length;
console.log('花括号配平: { =' + open + '  } =' + close);
if (open !== close) fail('花括号不配平');

// 3) 双引号成对（逐行直接计数，避免相邻引号被重叠匹配吃掉）
lines.forEach((l, i) => {
  const code = l.replace(/#.*$/, '');
  const q = (code.match(/"/g) || []).length;
  if (q % 2 !== 0) fail('第 ' + (i + 1) + ' 行双引号不成对: ' + l.trim().slice(0, 70));
});

// 4) docker compose 调用必须走兼容变量
const usesCompat = (src.match(/"\$DOCKER_COMPOSE"/g) || []).length;
const defines =
  /DOCKER_COMPOSE=""/.test(src) && /DOCKER_COMPOSE="docker compose"/.test(src) && /DOCKER_COMPOSE="docker-compose"/.test(src);
console.log('docker 兼容: 定义=' + defines + '  调用点=' + usesCompat);
if (!defines) fail('使用了 $DOCKER_COMPOSE 但缺少 v1/v2 兼容探测');
if (usesCompat === 0) fail('没有任何 $DOCKER_COMPOSE 调用点');
if (/^\s*docker-compose\s+up/m.test(src)) fail('仍存在裸 docker-compose 调用');

// 5) 关键修复点回归（防止后续改动把已修缺陷带回来）
const checks = [
  ['健康检查不再打 /api/health（后端无 api 全局前缀）', !/localhost:3000\/api\/health/.test(src)],
  ['启动横幅不含 root: 口令形态', !/MongoDB:.*root:/.test(src)],
  ['步骤编号统一为 /8', !/\[\d\/7\]/.test(src)],
  ['后端健康检查改用 /health/live', /localhost:3000\/health\/live/.test(src)],
];
console.log('\n关键修复点:');
checks.forEach(([n, ok]) => {
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + n);
  if (!ok) bad++;
});

console.log('\n结论: ' + (bad === 0 ? '结构校验通过' : bad + ' 项异常'));
process.exit(bad === 0 ? 0 : 1);
