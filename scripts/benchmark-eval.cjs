/**
 * 基准集符号求解评测（benchmark eval）——可复现、产出原始数据。
 *
 * 定位：针对 datasets/benchmark-dataset.json 中"符号可解、有确定性答案"的子集，
 * 调用运行中的 SymPy 符号计算服务（python-sympy-service，端口 8000）做真实求解，
 * 再用数值等价判定与标准答案比对，产出 machine-readable 的原始结果与分域准确率。
 *
 * 与历史文档里"无数据支撑的结论表"不同，本脚本：
 *   - 真实发 HTTP 请求到 SymPy 服务求解（不编造数字）；
 *   - 每题记录 成功/失败/期望值/实际值/是否等价，全量落盘 results/eval-raw.json；
 *   - 明确声明覆盖范围（仅符号可解子集），不夸大。
 *
 * 用法：
 *   1) 先起 SymPy 服务：cd python-sympy-service && python main.py（默认 127.0.0.1:8000）
 *   2) node scripts/benchmark-eval.cjs [--limit N] [--domain 极限与连续]
 *   3) 产物：results/eval-raw.json + results/eval-summary.md
 */
const fs = require('fs');
const path = require('path');
const { latexToSympy } = require('./latex-to-sympy.cjs');

const ROOT = path.resolve(__dirname, '..');
const BENCH = path.join(ROOT, 'datasets', 'benchmark-dataset.json');
const OUT_DIR = path.join(ROOT, 'results');
const SYMPY_URL = process.env.SYMPY_SERVICE_URL || 'http://127.0.0.1:8000';

// ---- CLI 参数 ----
const args = process.argv.slice(2);
const opt = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit') opt.limit = parseInt(args[++i], 10);
  else if (args[i] === '--domain') opt.domain = args[++i];
}

// ---- 数值等价判定（不依赖 SymPy 也能独立用）----
function normalize(s) {
  return String(s).replace(/\s+/g, '');
}
function toNum(s) {
  s = normalize(s).replace(/,/g, '');
  // 分数 a/b
  const frac = s.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
  if (frac) return parseFloat(frac[1]) / parseFloat(frac[2]);
  // 纯数字
  if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  // e 的幂 e^x / e^{-x}
  const ep = s.match(/^e\^\{(-?[\d.]+)\}$/i) || s.match(/^e\^(-?[\d.]+)$/i);
  if (ep) return Math.exp(parseFloat(ep[1]));
  // sqrt(n)
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

// ---- 判断题目是否属于"符号可解"子集（基于 domain + type + problem 文本启发）----
const SYM_DOMAINS = new Set(['极限与连续', '导数与微分', '积分计算', '微分方程', '无穷级数']);
function isSymbolicSolvable(q) {
  if (!SYM_DOMAINS.has(q.domain)) return false;
  if (q.type === 'proof' || q.type === 'multiple_choice') return false; // 证明/选择需 LLM 判定
  // 排除明显非计算的文本题与占位题（无具体表达式的空壳）
  if (/判断|讨论|证明|说明|是否|间断点|连续|收敛|发散/.test(q.problem)) return false;
  if (/^\[(应用题|计算题|填空题|证明题|简答题|解答题)\]/.test(q.problem)) return false; // 占位题
  return true;
}

// ---- 调用 SymPy 服务求解 ----
async function sympyLimit(expr, variable, approach) {
  const r = await fetch(`${SYMPY_URL}/limit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expr, variable, approach }),
  });
  return r.json();
}
async function sympyDerivative(expr, variable, order = 1) {
  const r = await fetch(`${SYMPY_URL}/derivative`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expr, variable, order }),
  });
  return r.json();
}
async function sympyIntegral(expr, variable, lower, upper) {
  const r = await fetch(`${SYMPY_URL}/integral`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expr, variable, lower: lower ?? null, upper: upper ?? null }),
  });
  return r.json();
}
async function sympySolve(equation, variable) {
  const r = await fetch(`${SYMPY_URL}/solve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ equation, variable }),
  });
  return r.json();
}
async function sympySimplify(expr) {
  const r = await fetch(`${SYMPY_URL}/simplify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expr }),
  });
  return r.json();
}
// 符号等价：将 expected 与 actual 都转成 SymPy 表达式，求差后 simplify 是否为 0
// 不定积分答案含 +C（任意常数），做差前剥离两侧的 +C
async function symbolicEqual(expectedLatex, actualSympy) {
  if (!expectedLatex || !actualSympy) return false;
  try {
    const e = latexToSympy(expectedLatex).replace(/\+\s*C\s*$/, '');
    const a = String(actualSympy).replace(/\+\s*C\s*$/, '');
    const diff = await sympySimplify(`(${e}) - (${a})`);
    if (diff.success === false) return false;
    const r = String(diff.result ?? '').replace(/\s+/g, '');
    return r === '0';
  } catch {
    return false;
  }
}

// 积分表达式提取：\int_a^b expr dx（定积分）/ \int expr dx（不定积分）
function extractIntegral(problem) {
  // 定积分 \int_a^b ... dx
  const def = problem.match(/\\int_\{([^{}]+)\}\^\{([^{}]+)\}\s*([^$]+?)\s*d([a-z])/);
  if (def) return { lower: def[1], upper: def[2], expr: def[3].trim(), variable: def[4], definite: true };
  const def2 = problem.match(/\\int_([^\s^]+)\^([^\s]+)\s*([^$]+?)\s*d([a-z])/);
  if (def2) return { lower: def2[1], upper: def2[2], expr: def2[3].trim(), variable: def2[4], definite: true };
  // 不定积分 \int expr dx
  const indef = problem.match(/\\int\s+([^$]+?)\s*d([a-z])/);
  if (indef) return { lower: null, upper: null, expr: indef[1].trim(), variable: indef[2], definite: false };
  return null;
}

// ---- 从 LaTeX 题面提取表达式（尽力而为的启发式，失败则记 unsupported 而非误判）----
function extractLimit(problem) {
  // $\lim_{x \to 0} f(x)$  / $\lim_{x \to \infty} f(x)$ / $\lim_{n \to \infty} f(n)$
  const m = problem.match(/\\lim_\{([a-z])\s*\\to\s*([^}]+)\}\s*([^$]+)/);
  if (!m) return null;
  let approach = m[2].trim();
  // LaTeX \infty → SymPy 的 oo
  approach = approach.replace(/\\infty/g, 'oo').replace(/\+\\infty/g, 'oo').replace(/-\\infty/g, '-oo');
  // \pi → pi
  let expr = m[3].trim().replace(/\\pi/g, 'pi');
  return { variable: m[1], approach, expr };
}
function extractDerivative(problem) {
  // 切线/在某点求值等需要额外步骤的题，超出纯符号求导范围 → 显式不支持
  if (/切线|在\s*x\s*=/.test(problem)) return { unsupported: '需在某点求值或几何含义' };
  // 二阶/高阶导数
  const orderN = problem.match(/二\s*阶|n\s*阶/);
  // $y = expr$ 的导数（主流形式）——题目里的 $ 是字面量，用 \$ 匹配
  const y = problem.match(/y\s*=\s*([^]*?)\s*\$?\s*(?:的|求)/);
  if (y) return { variable: 'x', expr: y[1].trim(), order: orderN ? 2 : 1 };
  // $\frac{d}{dx}(expr)$
  const d = problem.match(/\\frac\{d\}\{d([a-z])\}\s*\(?([^)$]+)\)?/);
  if (d) return { variable: d[1], expr: d[2].trim(), order: orderN ? 2 : 1 };
  return null;
}

// ---- 主流程 ----
(async () => {
  const bench = JSON.parse(fs.readFileSync(BENCH, 'utf8'));
  let qs = bench.questions;
  if (opt.domain) qs = qs.filter((q) => q.domain === opt.domain);
  const solvable = qs.filter(isSymbolicSolvable);
  const pool = opt.limit ? solvable.slice(0, opt.limit) : solvable;

  console.log(`基准集总题数: ${bench.questions.length}`);
  console.log(`符号可解子集: ${solvable.length}（覆盖域: ${[...SYM_DOMAINS].join('/')}）`);
  console.log(`本次评测: ${pool.length} 题（SymPy @ ${SYMPY_URL}）\n`);

  const rows = [];
  for (const q of pool) {
    const row = {
      id: q.id,
      domain: q.domain,
      type: q.type,
      difficulty: q.difficulty,
      problem: q.problem,
      expected: q.answer,
      actual: null,
      status: 'error', // solved | error | unsupported
      equivalent: false,
      error: null,
    };
    try {
      let res;
      if (q.domain === '极限与连续') {
        const p = extractLimit(q.problem);
        if (!p) { row.status = 'unsupported'; row.error = '无法提取极限表达式'; rows.push(row); continue; }
        let symExpr;
        try { symExpr = latexToSympy(p.expr); }
        catch (e) { row.status = 'unsupported'; row.error = `LaTeX转换失败: ${e.message}`; rows.push(row); continue; }
        res = await sympyLimit(symExpr, p.variable, p.approach);
      } else if (q.domain === '导数与微分') {
        const p = extractDerivative(q.problem);
        if (!p) { row.status = 'unsupported'; row.error = '无法提取求导表达式'; rows.push(row); continue; }
        if (p.unsupported) { row.status = 'unsupported'; row.error = p.unsupported; rows.push(row); continue; }
        let symExpr;
        try { symExpr = latexToSympy(p.expr); }
        catch (e) { row.status = 'unsupported'; row.error = `LaTeX转换失败: ${e.message}`; rows.push(row); continue; }
        res = await sympyDerivative(symExpr, p.variable, p.order);
      } else if (q.domain === '积分计算') {
        const p = extractIntegral(q.problem);
        if (!p) { row.status = 'unsupported'; row.error = '无法提取积分表达式'; rows.push(row); continue; }
        let symExpr;
        try { symExpr = latexToSympy(p.expr); }
        catch (e) { row.status = 'unsupported'; row.error = `LaTeX转换失败: ${e.message}`; rows.push(row); continue; }
        const lower = p.lower ? latexToSympy(p.lower) : null;
        const upper = p.upper ? latexToSympy(p.upper) : null;
        res = await sympyIntegral(symExpr, p.variable, lower, upper);
      } else {
        row.status = 'unsupported'; row.error = '该域暂未接入求解器（积分/方程/级数待扩展）'; rows.push(row); continue;
      }
      if (!res || res.success === false) {
        row.status = 'error'; row.error = res?.error || 'sympy 返回失败';
      } else {
        row.actual = res.result ?? res.latex ?? null;
        row.status = 'solved';
        // 先数值等价（分数/小数/根式/常数），再符号等价（含变量的多项式/三角式）
        row.equivalent = numericEqual(row.actual, row.expected) ||
          await symbolicEqual(row.expected, row.actual);
      }
    } catch (e) {
      row.status = 'error'; row.error = String(e.message);
    }
    rows.push(row);
  }

  // ---- 统计 ----
  const solved = rows.filter((r) => r.status === 'solved');
  const correct = rows.filter((r) => r.status === 'solved' && r.equivalent);
  const byDomain = {};
  for (const r of rows) {
    const d = r.domain;
    byDomain[d] = byDomain[d] || { total: 0, solved: 0, correct: 0 };
    byDomain[d].total++;
    if (r.status === 'solved') byDomain[d].solved++;
    if (r.equivalent) byDomain[d].correct++;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const raw = {
    generated_at: new Date().toISOString(),
    sympy_url: SYMPY_URL,
    benchmark: { file: 'datasets/benchmark-dataset.json', total: bench.questions.length, solvable: solvable.length, evaluated: pool.length },
    summary: {
      evaluated: rows.length,
      solved: solved.length,
      correct: correct.length,
      accuracy_on_solved: solved.length ? +(correct.length / solved.length).toFixed(4) : null,
      accuracy_on_evaluated: rows.length ? +(correct.length / rows.length).toFixed(4) : null,
    },
    by_domain: byDomain,
    rows,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'eval-raw.json'), JSON.stringify(raw, null, 2), 'utf8');

  // ---- markdown 摘要 ----
  const L = [];
  L.push('# Benchmark 符号求解评测结果');
  L.push('');
  L.push(`- 生成时间: ${raw.generated_at}`);
  L.push(`- SymPy 服务: ${SYMPY_URL}`);
  L.push(`- 基准集总题数: ${bench.questions.length}，符号可解子集: ${solvable.length}，本次评测: ${rows.length}`);
  L.push('');
  L.push('## 总览');
  L.push('');
  L.push(`| 指标 | 值 |`);
  L.push(`|---|---|`);
  L.push(`| 评测题数 | ${rows.length} |`);
  L.push(`| 成功求解 | ${solved.length} |`);
  L.push(`| 判为正确 | ${correct.length} |`);
  L.push(`| 准确率（成功求解子集） | ${raw.summary.accuracy_on_solved ?? 'N/A'} |`);
  L.push(`| 准确率（全部评测） | ${raw.summary.accuracy_on_evaluated ?? 'N/A'} |`);
  L.push('');
  L.push('## 分域');
  L.push('');
  L.push(`| 域 | 题数 | 成功求解 | 正确 | 求解率 | 正确率(成功子集) |`);
  L.push(`|---|---|---|---|---|---|`);
  for (const [d, v] of Object.entries(byDomain)) {
    const sr = v.total ? (v.solved / v.total).toFixed(3) : '0';
    const acc = v.solved ? (v.correct / v.solved).toFixed(3) : 'N/A';
    L.push(`| ${d} | ${v.total} | ${v.solved} | ${v.correct} | ${sr} | ${acc} |`);
  }
  L.push('');
  L.push('## 说明');
  L.push('');
  L.push('- 本评测仅覆盖"符号可解且有确定性数值/代数答案"的计算类子集，不含证明题与选择题。');
  L.push('- 原始逐题数据见 `results/eval-raw.json`。');
  L.push('- 这是**可复现**评测：重复运行 `node scripts/benchmark-eval.cjs` 应得到一致结果。');
  L.push('');
  fs.writeFileSync(path.join(OUT_DIR, 'eval-summary.md'), L.join('\n'), 'utf8');

  console.log('=== 评测完成 ===');
  console.log(`评测 ${rows.length} 题 | 成功 ${solved.length} | 正确 ${correct.length}`);
  console.log(`准确率(成功子集): ${raw.summary.accuracy_on_solved ?? 'N/A'}`);
  console.log(`原始数据: results/eval-raw.json`);
  console.log(`摘要: results/eval-summary.md`);
})().catch((e) => {
  console.error('评测脚本失败:', e);
  process.exit(1);
});
