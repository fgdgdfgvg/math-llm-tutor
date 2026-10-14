/**
 * A/B 消融评测（ablation eval）——多智能体流水线 vs 纯符号直解，可复现、产出原始数据。
 *
 * 动机：仓库早期文档声称"多智能体协作提升准确率"，但从未有过对照数据。
 * 本脚本在基准集符号可解子集上同时运行两条链路并同标准答案比对：
 *
 *   策略 A（baseline，纯符号直解）：
 *     题面 LaTeX → scripts/latex-to-sympy.cjs 转换 → 直接调用 SymPy 服务（:8000）求解。
 *     与 scripts/benchmark-eval.cjs 同一链路（本脚本内联等价实现，保证单文件可复现）。
 *
 *   策略 B（candidate，多智能体流水线）：
 *     题面原文 → POST {BACKEND_URL}/agents/solve（planner→solver→diagnostic→feedback
 *     编排，solver 内部走本地符号计算/规则兜底）→ 取 data.finalAnswer。
 *     这是线上前端实际调用的同一端点，不绕过任何一层。
 *
 * 公平性约束：
 *   - 两策略吃完全相同的题面原文（q.problem），同一子集、同一判定器；
 *   - 判定器一致：数值等价（分数/小数/根式/常数）优先，符号等价（simplify 差为 0）兜底；
 *   - 每题记录耗时，产出延迟对比；
 *   - 结果全量落盘 results/ablation-raw.json，逐题可核查。
 *
 * 用法：
 *   1) 起 SymPy 服务（:8000）与后端（默认 :3100，可用 BACKEND_URL 覆盖）
 *   2) node scripts/ablation-eval.cjs [--limit N] [--domain 极限与连续]
 *   3) 产物：results/ablation-raw.json + results/ablation-summary.md
 */
const fs = require('fs');
const path = require('path');
const { latexToSympy } = require('./latex-to-sympy.cjs');

const ROOT = path.resolve(__dirname, '..');
const BENCH = path.join(ROOT, 'datasets', 'benchmark-dataset.json');
const OUT_DIR = path.join(ROOT, 'results');
const SYMPY_URL = process.env.SYMPY_SERVICE_URL || 'http://127.0.0.1:8000';
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3100';
const REQ_TIMEOUT_MS = parseInt(process.env.ABLATION_TIMEOUT_MS || '150000', 10);
// 后端有全局限流（实测连续 ~20 次请求触发 429），策略 B 请求间默认间隔 1.2s，
// 命中 429 时按 Retry-After 语义指数退避重试（最多 4 次）。
const REQ_DELAY_MS = parseInt(process.env.ABLATION_DELAY_MS || '1200', 10);

// 策略 B 的 LLM 形态标注：后端是否配置了真实 AI key，直接决定多智能体是"真实 LLM 推理"
// 还是"降级为本地规则引擎"。重跑消融时用 ABLATION_LLM_MODE 显式标注，让结果可区分。
// 取值：'llm'（已配 key，真实 LLM）/ 'degraded'（未配 key，降级形态，默认）。
const LLM_MODE = process.env.ABLATION_LLM_MODE || 'degraded';

// ---- CLI 参数 ----
const args = process.argv.slice(2);
const opt = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit') opt.limit = parseInt(args[++i], 10);
  else if (args[i] === '--domain') opt.domain = args[i + 1];
}

// ---- 数值等价判定（与 benchmark-eval 同一实现）----
function normalize(s) { return String(s).replace(/\s+/g, ''); }
function toNum(s) {
  s = normalize(s).replace(/,/g, '');
  const frac = s.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
  if (frac) return parseFloat(frac[1]) / parseFloat(frac[2]);
  if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  const ep = s.match(/^e\^\{(-?[\d.]+)\}$/i) || s.match(/^e\^(-?[\d.]+)$/i);
  if (ep) return Math.exp(parseFloat(ep[1]));
  const sq = s.match(/^sqrt\((\d+(?:\.\d+)?)\)$/i);
  if (sq) return Math.sqrt(parseFloat(sq[1]));
  return null;
}
function numericEqual(a, b) {
  const na = toNum(a), nb = toNum(b);
  if (na !== null && nb !== null) {
    return Math.abs(na - nb) <= 1e-6 * Math.max(1, Math.abs(nb));
  }
  return normalize(a) === normalize(b);
}

// ---- 符号等价：expected(LaTeX) 与 actual(SymPy 串) 做差 simplify 判 0 ----
async function sympySimplify(expr) {
  const r = await fetch(`${SYMPY_URL}/simplify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expr }),
  });
  return r.json();
}
async function symbolicEqual(expectedLatex, actualSympy) {
  if (!expectedLatex || !actualSympy) return false;
  try {
    const e = latexToSympy(expectedLatex).replace(/\+\s*C\s*$/, '');
    const a = String(actualSympy).replace(/\+\s*C\s*$/, '');
    const diff = await sympySimplify(`(${e}) - (${a})`);
    if (diff.success === false) return false;
    return String(diff.result ?? '').replace(/\s+/g, '') === '0';
  } catch {
    return false;
  }
}

// 对策略 B 的 finalAnswer（任意文本）做统一判定：先数值、再尝试按 LaTeX 转 SymPy 后符号判定
async function judgeEquivalent(expected, actualText) {
  if (!actualText || typeof actualText !== 'string') return false;
  const cleaned = actualText.trim().replace(/^\$+|\$+$/g, '').trim();
  if (!cleaned) return false;
  if (numericEqual(cleaned, expected)) return true;
  try {
    const sym = latexToSympy(cleaned);
    if (sym && sym !== cleaned) return await symbolicEqual(expected, sym);
    // 纯数字/字母时 latexToSympy 原样返回，符号判定与数值判定等价，跳过
  } catch { /* 非 LaTeX 文本，判不等价 */ }
  return false;
}

// ---- 子集选择：与 benchmark-eval 同一口径，且限定 baseline 已接入求解器的三域 ----
const SYM_DOMAINS = new Set(['极限与连续', '导数与微分', '积分计算']);
function isSymbolicSolvable(q) {
  if (!SYM_DOMAINS.has(q.domain)) return false;
  if (q.type === 'proof' || q.type === 'multiple_choice') return false;
  if (/判断|讨论|证明|说明|是否|间断点|连续|收敛|发散/.test(q.problem)) return false;
  if (/^\[(应用题|计算题|填空题|证明题|简答题|解答题)\]/.test(q.problem)) return false;
  return true;
}

// ---- 题面表达式提取（与 benchmark-eval 同一启发式）----
function extractLimit(problem) {
  const m = problem.match(/\\lim_\{([a-z])\s*\\to\s*([^}]+)\}\s*([^$]+)/);
  if (!m) return null;
  const approach = m[2].trim().replace(/\\infty/g, 'oo').replace(/\+\\infty/g, 'oo').replace(/-\\infty/g, '-oo');
  const expr = m[3].trim().replace(/\\pi/g, 'pi');
  return { variable: m[1], approach, expr };
}
function extractDerivative(problem) {
  if (/切线|在\s*x\s*=/.test(problem)) return { unsupported: '需在某点求值或几何含义' };
  const orderN = problem.match(/二\s*阶|n\s*阶/);
  const y = problem.match(/y\s*=\s*([^]*?)\s*\$?\s*(?:的|求)/);
  if (y) return { variable: 'x', expr: y[1].trim(), order: orderN ? 2 : 1 };
  const d = problem.match(/\\frac\{d\}\{d([a-z])\}\s*\(?([^)$]+)\)?/);
  if (d) return { variable: d[1], expr: d[2].trim(), order: orderN ? 2 : 1 };
  return null;
}
function extractIntegral(problem) {
  const def = problem.match(/\\int_\{([^{}]+)\}\^\{([^{}]+)\}\s*([^$]+?)\s*d([a-z])/);
  if (def) return { lower: def[1], upper: def[2], expr: def[3].trim(), variable: def[4], definite: true };
  const def2 = problem.match(/\\int_([^\s^]+)\^([^\s]+)\s*([^$]+?)\s*d([a-z])/);
  if (def2) return { lower: def2[1], upper: def2[2], expr: def2[3].trim(), variable: def2[4], definite: true };
  const indef = problem.match(/\\int\s+([^$]+?)\s*d([a-z])/);
  if (indef) return { lower: null, upper: null, expr: indef[1].trim(), variable: indef[2], definite: false };
  return null;
}

// ---- SymPy 服务调用 ----
async function sympyCall(endpoint, payload) {
  const r = await fetch(`${SYMPY_URL}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return r.json();
}

// ---- 策略 A：纯符号直解（baseline）----
async function solveBaseline(q) {
  const t0 = Date.now();
  try {
    let res;
    if (q.domain === '极限与连续') {
      const p = extractLimit(q.problem);
      if (!p) return { status: 'unsupported', error: '无法提取极限表达式', ms: Date.now() - t0 };
      res = await sympyCall('limit', { expr: latexToSympy(p.expr), variable: p.variable, approach: p.approach });
    } else if (q.domain === '导数与微分') {
      const p = extractDerivative(q.problem);
      if (!p) return { status: 'unsupported', error: '无法提取求导表达式', ms: Date.now() - t0 };
      if (p.unsupported) return { status: 'unsupported', error: p.unsupported, ms: Date.now() - t0 };
      res = await sympyCall('derivative', { expr: latexToSympy(p.expr), variable: p.variable, order: p.order });
    } else if (q.domain === '积分计算') {
      const p = extractIntegral(q.problem);
      if (!p) return { status: 'unsupported', error: '无法提取积分表达式', ms: Date.now() - t0 };
      res = await sympyCall('integral', {
        expr: latexToSympy(p.expr), variable: p.variable,
        lower: p.lower ? latexToSympy(p.lower) : null,
        upper: p.upper ? latexToSympy(p.upper) : null,
      });
    } else {
      return { status: 'unsupported', error: '该域未接入', ms: Date.now() - t0 };
    }
    if (!res || res.success === false) {
      return { status: 'error', error: res?.error || 'sympy 返回失败', ms: Date.now() - t0 };
    }
    const actual = res.result ?? res.latex ?? null;
    const equivalent = numericEqual(actual, q.answer) || await symbolicEqual(q.answer, actual);
    return { status: 'solved', actual, equivalent, ms: Date.now() - t0 };
  } catch (e) {
    return { status: 'error', error: String(e.message), ms: Date.now() - t0 };
  }
}

// ---- 策略 B：多智能体流水线（candidate）----
async function solveMultiAgentOnce(q, attempt) {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);
  try {
    const r = await fetch(`${BACKEND_URL}/agents/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem: q.problem }),
      signal: ctrl.signal,
    });
    const body = await r.json().catch(() => null);
    if (r.status === 429 && attempt < 4) {
      const wait = Math.min(30000, REQ_DELAY_MS * Math.pow(3, attempt));
      return { retryAfterMs: wait };
    }
    if (!r.ok) {
      return { done: { status: 'error', error: `HTTP ${r.status}`, ms: Date.now() - t0, httpStatus: r.status } };
    }
    const data = body?.data ?? body; // TransformInterceptor 信封 {code,data}
    const finalAnswer = data?.finalAnswer ?? null;
    const stepCount = Array.isArray(data?.solutionSteps) ? data.solutionSteps.length : 0;
    if (!finalAnswer) {
      return { done: { status: 'error', error: '响应无 finalAnswer', ms: Date.now() - t0, stepCount } };
    }
    const equivalent = await judgeEquivalent(q.answer, finalAnswer);
    // 占位文本识别：既不等价、又包含典型兜底措辞 → 记为 placeholder，便于统计"退化为占位"的比例
    const isPlaceholder = !equivalent && /未能得出|无法生成|不可用|请检查题目|配置AI模型/.test(finalAnswer);
    return { done: { status: 'solved', actual: finalAnswer, equivalent, isPlaceholder, ms: Date.now() - t0, stepCount } };
  } catch (e) {
    return { done: { status: 'error', error: e.name === 'AbortError' ? `超时(>${REQ_TIMEOUT_MS}ms)` : String(e.message), ms: Date.now() - t0 } };
  } finally {
    clearTimeout(timer);
  }
}

async function solveMultiAgent(q) {
  let attempt = 0;
  for (;;) {
    const r = await solveMultiAgentOnce(q, attempt);
    if (r.done) return r.done;
    attempt++;
    await new Promise((resolve) => setTimeout(resolve, r.retryAfterMs));
  }
}

// ---- 主流程 ----
(async () => {
  const bench = JSON.parse(fs.readFileSync(BENCH, 'utf8'));
  let qs = bench.questions;
  if (opt.domain) qs = qs.filter((q) => q.domain === opt.domain);
  const solvable = qs.filter(isSymbolicSolvable);
  const pool = opt.limit ? solvable.slice(0, opt.limit) : solvable;

  console.log(`基准集总题数: ${bench.questions.length}`);
  console.log(`A/B 评测子集: ${solvable.length}（域: ${[...SYM_DOMAINS].join('/')}）`);
  console.log(`本次评测: ${pool.length} 题`);
  console.log(`策略A SymPy: ${SYMPY_URL} | 策略B 后端: ${BACKEND_URL}\n`);

  const rows = [];
  let i = 0;
  for (const q of pool) {
    i++;
    process.stdout.write(`[${i}/${pool.length}] ${q.id} (${q.domain}) ... `);
    const a = await solveBaseline(q);
    const b = await solveMultiAgent(q);
    if (i < pool.length) await new Promise((resolve) => setTimeout(resolve, REQ_DELAY_MS));
    const row = {
      id: q.id, domain: q.domain, difficulty: q.difficulty,
      problem: q.problem, expected: q.answer,
      baseline: a, candidate: b,
    };
    rows.push(row);
    console.log(`A=${a.status}${a.equivalent ? '+' : '-'}(${a.ms}ms) B=${b.status}${b.equivalent ? '+' : '-'}(${b.ms}ms)`);
  }

  // ---- 统计 ----
  // 公平口径：剔除 baseline 无法提取表达式的题目（这类题 A 本就无解，不应计入分母）
  const stat = (side) => {
    const ev = rows.filter((r) => r.baseline.status !== 'unsupported');
    const solved = ev.filter((r) => r[side].status === 'solved');
    const correct = solved.filter((r) => r[side].equivalent);
    const placeholder = solved.filter((r) => r[side].isPlaceholder);
    const ms = solved.map((r) => r[side].ms);
    return {
      evaluated: ev.length,
      solved: solved.length,
      correct: correct.length,
      placeholder: placeholder.length,
      solveRate: ev.length ? +(solved.length / ev.length).toFixed(4) : null,
      accuracyOnSolved: solved.length ? +(correct.length / solved.length).toFixed(4) : null,
      avgMs: ms.length ? Math.round(ms.reduce((x, y) => x + y, 0) / ms.length) : null,
    };
  };
  const summaryA = stat('baseline');
  const summaryB = stat('candidate');

  const byDomain = {};
  for (const r of rows) {
    const d = (byDomain[r.domain] = byDomain[r.domain] || { total: 0, aSolved: 0, aCorrect: 0, bSolved: 0, bCorrect: 0, bPlaceholder: 0 });
    d.total++;
    if (r.baseline.status === 'solved') { d.aSolved++; if (r.baseline.equivalent) d.aCorrect++; }
    if (r.candidate.status === 'solved') { d.bSolved++; if (r.candidate.equivalent) d.bCorrect++; if (r.candidate.isPlaceholder) d.bPlaceholder++; }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const raw = {
    generated_at: new Date().toISOString(),
    sympy_url: SYMPY_URL, backend_url: BACKEND_URL,
    llm_mode: LLM_MODE, // 'llm' | 'degraded'：策略 B 是否走真实 LLM 的关键标注
    benchmark: { file: 'datasets/benchmark-dataset.json', total: bench.questions.length, subset: solvable.length, evaluated: rows.length },
    strategy_a: { name: '纯符号直解（LaTeX→SymPy 服务）', ...summaryA },
    strategy_b: { name: '多智能体流水线（POST /agents/solve）', ...summaryB },
    by_domain: byDomain,
    rows,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'ablation-raw.json'), JSON.stringify(raw, null, 2), 'utf8');

  // ---- markdown 摘要 ----
  const llmLabel = LLM_MODE === 'llm' ? '真实 LLM（已配置 AI key）' : '降级形态（未配置 AI key，规则引擎兜底）';
  const L = [];
  L.push('# A/B 消融评测：多智能体流水线 vs 纯符号直解');
  L.push('');
  L.push(`- 生成时间: ${raw.generated_at}`);
  L.push(`- 数据集: datasets/benchmark-dataset.json（总 ${bench.questions.length} 题，本次子集 ${rows.length} 题）`);
  L.push(`- 策略A: ${raw.strategy_a.name} @ ${SYMPY_URL}`);
  L.push(`- 策略B: ${raw.strategy_b.name} @ ${BACKEND_URL}`);
  L.push(`- **策略 B LLM 形态: ${llmLabel}**（用 ABLATION_LLM_MODE=llm|degraded 显式标注，避免混淆两种形态的结果）`);
  L.push('');
  L.push('## 总体对比（公平口径：剔除 baseline 无法提取表达式的题目）');
  L.push('');
  L.push('| 指标 | A 纯符号直解 | B 多智能体流水线 |');
  L.push('|---|---|---|');
  L.push(`| 评测题数 | ${summaryA.evaluated} | ${summaryB.evaluated} |`);
  L.push(`| 成功求解 | ${summaryA.solved} | ${summaryB.solved} |`);
  L.push(`| 答案正确 | ${summaryA.correct} | ${summaryB.correct} |`);
  L.push(`| 求解率 | ${summaryA.solveRate ?? 'N/A'} | ${summaryB.solveRate ?? 'N/A'} |`);
  L.push(`| 正确率（成功子集） | ${summaryA.accuracyOnSolved ?? 'N/A'} | ${summaryB.accuracyOnSolved ?? 'N/A'} |`);
  L.push(`| 退化为占位文本 | - | ${summaryB.placeholder} |`);
  L.push(`| 平均耗时 | ${summaryA.avgMs ?? 'N/A'} ms | ${summaryB.avgMs ?? 'N/A'} ms |`);
  L.push('');
  L.push('## 分域对比');
  L.push('');
  L.push('| 域 | 题数 | A求解/A正确 | B求解/B正确 | B占位 |');
  L.push('|---|---|---|---|---|');
  for (const [d, v] of Object.entries(byDomain)) {
    L.push(`| ${d} | ${v.total} | ${v.aSolved}/${v.aCorrect} | ${v.bSolved}/${v.bCorrect} | ${v.bPlaceholder} |`);
  }
  L.push('');
  L.push('## 结论与解读');
  L.push('');
  L.push('- 本评测为**真实对照实验**：两策略吃相同题面、用同一判定器、逐题原始数据落盘 `results/ablation-raw.json`。');
  L.push('- 若 B 显著低于 A，说明多智能体链路当前的主要瓶颈在题面解析/编排层而非符号计算内核；');
  L.push('  "退化为占位文本"计数直接暴露 LLM key 未配置或解析失败的题目数量。');
  L.push('- 若 B 与 A 相当，说明符号优先 + 规则兜底的降级设计在可用性上成立，延迟差即为编排开销。');
  L.push('- 重复运行 `node scripts/ablation-eval.cjs`（保持服务可用）应得到一致结论。');
  L.push('');
  fs.writeFileSync(path.join(OUT_DIR, 'ablation-summary.md'), L.join('\n'), 'utf8');

  console.log('\n=== A/B 评测完成 ===');
  console.log(`A 纯符号: 求解 ${summaryA.solved}/${summaryA.evaluated}，正确 ${summaryA.correct}，均耗 ${summaryA.avgMs}ms`);
  console.log(`B 多智能体: 求解 ${summaryB.solved}/${summaryB.evaluated}，正确 ${summaryB.correct}，占位 ${summaryB.placeholder}，均耗 ${summaryB.avgMs}ms`);
  console.log(`原始数据: results/ablation-raw.json`);
  console.log(`摘要: results/ablation-summary.md`);
})().catch((e) => {
  console.error('A/B 评测脚本失败:', e);
  process.exit(1);
});
