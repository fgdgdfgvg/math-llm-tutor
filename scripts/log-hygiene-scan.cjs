/**
 * 日志卫生扫描：禁止把 error 对象整体传给 logger。
 *
 * 背景：axios 的 error 对象带有 config.headers.Authorization 等敏感字段，
 * `logger.error(msg, error)` 会把完整请求头写进磁盘日志（本项目曾因此泄露真实密钥，
 * 见 docs/系统代码审阅与改进方案.md）。正确写法：
 *   logger.error(msg, describeErrorForLog(error))   // 结构化摘要
 *   logger.error(msg, error.message)                 // 仅消息
 *
 * 用法：node scripts/log-hygiene-scan.cjs   （发现违规时退出码 1，可挂 CI）
 * 实现说明：用"定位 logger.xxx( 后在有限窗口内查裸 error 实参"的两步匹配，
 * 避免对大文件做嵌套量词正则（曾被回溯拖死）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['nestjs-backend/src'];
const EXTS = ['.ts'];
const SKIP = [/\.spec\.ts$/, /redact\.ts$/, /log-hygiene-scan/];
const WINDOW = 400; // logger 调用开始位置向后看的字符数（足够覆盖常规调用）

const LOGGER_CALL = /logger\.(?:error|warn|log|debug|verbose)\s*\(/g;
// 裸的 error/err/e 作为实参（前面是逗号或左括号，后面是逗号/右括号/换行）
const BARE_ERROR_ARG = /[,(]\s*(?:error|err|e)\s*[,)]/;

/** 从 openParenIndex（'(' 的位置）起按括号配平扫描，返回调用体的结束下标（含 ')'） */
function findCallEnd(text, openParenIndex) {
  let depth = 0;
  for (let i = openParenIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return Math.min(text.length, openParenIndex + WINDOW);
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      yield* walk(full);
    } else if (EXTS.includes(path.extname(entry.name))) {
      if (!SKIP.some((re) => re.test(full))) yield full;
    }
  }
}

function stripStrings(text) {
  // 简单替换字符串字面量，减少误报（模板串可能跨行，做保守处理）
  return text.replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, '""');
}

const violations = [];
for (const dir of SCAN_DIRS) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const file of walk(abs)) {
    const raw = fs.readFileSync(file, 'utf8');
    const text = stripStrings(raw);
    LOGGER_CALL.lastIndex = 0;
    let m;
    while ((m = LOGGER_CALL.exec(text))) {
      const openParen = m.index + m[0].length - 1;
      const end = findCallEnd(text, openParen);
      const callBody = text.slice(m.index, end);
      const hit = BARE_ERROR_ARG.exec(callBody);
      if (!hit) continue;
      // 误报豁免：实参来自脱敏工具或只是模板串里的内容
      const before = callBody.slice(0, hit.index);
      if (/describeErrorForLog|redactSecrets|describeHttpError/.test(before)) continue;
      const lineNo = text.slice(0, m.index).split('\n').length;
      violations.push({ file, line: lineNo, text: (raw.split('\n')[lineNo - 1] || '').trim() });
    }
  }
}

if (violations.length === 0) {
  console.log('✓ 日志卫生扫描通过：未发现整体打印 error 对象的调用点');
  process.exit(0);
}
console.log(`✗ 发现 ${violations.length} 处疑似整体打印 error 对象的日志调用：`);
for (const v of violations) {
  console.log(`  ${path.relative(ROOT, v.file)}:${v.line}  ${v.text.slice(0, 120)}`);
}
console.log('请改用 describeErrorForLog(error)（common/utils/redact.ts）或 error.message。');
process.exit(1);
