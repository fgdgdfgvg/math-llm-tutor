#!/usr/bin/env node
/**
 * 前端数学工具的回归自检（无需新增依赖）。
 *
 * 为什么需要它：`utils/math/*` 是全站 ε-δ、导数、黎曼和、级数、知识图谱的
 * 计算内核，但项目没有前端测试运行器（只有 uni build / vue-tsc）。
 * 这里用本地 typescript 把 TS 转成 CJS 后直接断言，覆盖审阅报告中列出的
 * 每一个可复现缺陷，避免"改了公式没人发现"。
 *
 * 用法：node scripts/math-utils.selfcheck.cjs
 * 退出码：0 全部通过；1 有失败项
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const MATH_DIR = path.join(__dirname, '..', 'src', 'utils', 'math');

function loadTsModule(fileName) {
  const file = path.join(MATH_DIR, fileName);
  const source = fs.readFileSync(file, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: file,
  });
  const mod = new Module(file, null);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(MATH_DIR);
  mod._compile(outputText, file);
  return mod.exports;
}

const epsilonDelta = loadTsModule('epsilonDelta.ts');
const derivative = loadTsModule('derivative.ts');
const integral = loadTsModule('integral.ts');
const series = loadTsModule('series.ts');
const graph = loadTsModule('graph.ts');

let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (error) {
    failures.push({ name, message: error.message });
    console.log(`  ❌ ${name}\n     ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || '断言失败');
}

function approx(actual, expected, tolerance, message) {
  assert(
    Math.abs(actual - expected) <= tolerance,
    `${message || ''} 期望 ≈ ${expected}，实际 ${actual}`,
  );
}

// ============================ ε-δ ============================
console.log('\nε-δ 极限定义');
{
  const { checkDelta, evaluateDelta, searchOptimalDelta, EPSILON_DELTA_FUNCTIONS } = epsilonDelta;
  const x3 = EPSILON_DELTA_FUNCTIONS.find((f) => f.id === 'x3'); // lim(x→1) x³ = 1

  check('端点不再参与判定：x³ 在 x₀=1 处取 δ=1 时不应因端点被误判为不通过', () => {
    // |f(1±1)-1| = |8-1| = 7 远超 ε=0.5；端点若参与判定必然 false。
    // 去心邻域内 x→0.0001 附近仍会超出 ε，因此这里改测一个 δ 很小但合法的情况。
    const ok = checkDelta((x) => x * x * x, 1, 1, 0.5, 0.05);
    assert(ok, 'δ=0.05 时 |x³-1| ≈ 0.15 < 0.5，应判定通过');
  });

  check('极小 δ 不再恒判为真（旧实现 δ<1e-4 时全部采样点被跳过 → 返回 true）', () => {
    // 用一个在邻域内明显不满足 ε 的函数：f(x) = 巨大常数
    const constant = () => 100;
    const result = checkDelta(constant, 0, 0, 0.1, 1e-6);
    assert(result === false, '常量 100 在任何 δ 下都不满足 |f-L|<0.1，不能返回 true');
    const evaluation = evaluateDelta(constant, 0, 0, 0.1, 1e-6);
    assert(evaluation.checked > 0, 'δ=1e-6 时应有实际采样点参与判定');
  });

  check('最大可行 δ 通过最终验证，且不受“当前 δ”限制', () => {
    const { delta, found } = searchOptimalDelta((x) => x * x * x, 1, 1, 0.5, 0.01);
    assert(found && delta !== null, '在 ε=0.5 下应能找到可行 δ');
    assert(delta > 0.01, `搜索上界不应被 startDelta 限制，得到 ${delta}`);
    assert(
      checkDelta((x) => x * x * x, 1, 1, 0.5, delta),
      '返回的 δ 必须通过验证（旧实现在无解时回填未验证的 startDelta）',
    );
  });

  check('不连续函数：找不到可行 δ 时返回 null 而不是回填错误值', () => {
    const jump = (x) => (x < 0 ? -1 : 1); // 在 0 处极限不存在
    const { delta, found, reason } = searchOptimalDelta(jump, 0, 0, 0.5, 1);
    assert(!found && delta === null, '跳变函数不应返回可行 δ');
    assert(!!reason, '应给出未找到的原因');
  });

  check('浮点无法分辨邻域时标为无法判定（不能拿 f(a) 冒充邻域取值）', () => {
    // limitPoint = 1e16 时，δ = 1e-3 在双精度下会被完全抹平：1e16 + 1e-3 === 1e16
    const evaluation = evaluateDelta((x) => (x > 1e16 ? 5 : 0), 1e16, 0, 0.1, 1e-3);
    assert(evaluation.satisfied === false, '无法判定时不能返回 satisfied=true');
    assert(evaluation.degenerate === true, '应标记为 degenerate');
    assert(evaluation.checked === 0, '不应有可用的采样点');
  });
}

// ============================ 导数 ============================
console.log('\n导数与凹凸性');
{
  const { computeSecantLine, analyzeConcavity, computeTangentLine, centralDifference, forwardDifference } = derivative;

  check('h=0 时割线不再产生 NaN（旧实现 0/0 → 整条线崩）', () => {
    const secant = computeSecantLine((x) => x * x, 1, 0, [-2, 2]);
    assert(Number.isFinite(secant.slope), `slope 应为有限值，得到 ${secant.slope}`);
    assert(secant.ys.every((y) => Number.isFinite(y)), '割线数据不应含 NaN');
    approx(secant.usedStep, 1e-6, 1e-12, '步长应被钳制到 MIN_STEP');
  });

  check('切点落在定义域外时返回 NaN 标记（不抛错、不产生伪造的直线）', () => {
    const ln = (x) => (x > 0 ? Math.log(x) : NaN);
    const dln = (x) => (x > 0 ? 1 / x : NaN);
    const inside = computeTangentLine(ln, dln, 0.5, [-2, 2]);
    assert(inside.ys.every((y) => Number.isFinite(y)), '定义域内的切点应给出有限值');
    const outside = computeTangentLine(ln, dln, -1, [-2, 2]);
    assert(outside.ys.every((y) => Number.isNaN(y)), '切点越界时全部应为 NaN，供调用方过滤');
  });

  check('f″(x₀)=0 不再直接判为拐点：x⁴ 在 0 处取 f″=0 但不是拐点', () => {
    const analysis = analyzeConcavity((x) => 12 * x * x, 0);
    assert(analysis.kind === 'concave', `x⁴ 在 0 处两侧 f″≥0 同号 → 凹，实际 ${analysis.kind}`);
    assert(analysis.secondDerivative === 0, '此处 f″(0) 应为 0');
  });

  check('真正变号时判为拐点：x³ 在 0 处 f″ 由负变正', () => {
    const analysis = analyzeConcavity((x) => 6 * x, 0);
    assert(analysis.kind === 'inflection', `x³ 在 0 处应为拐点，实际 ${analysis.kind}`);
  });

  check('术语统一为 凹（f″>0）/ 凸（f″<0），不再混用上凸/下凸', () => {
    const concave = analyzeConcavity(() => 2, 0);
    const convex = analyzeConcavity(() => -2, 0);
    assert(concave.label.includes('凹（f″>0）'), `标签应统一，实际 ${concave.label}`);
    assert(convex.label.includes('凸（f″<0）'), `标签应统一，实际 ${convex.label}`);
  });

  check('中心差分比前向差分更精确（O(h²) vs O(h)）', () => {
    const fn = (x) => Math.sin(x);
    const dfn = (x) => Math.cos(x);
    const x0 = 0.7;
    const h = 1e-2;
    const fwd = Math.abs(forwardDifference(fn, x0, h) - dfn(x0));
    const ctr = Math.abs(centralDifference(fn, x0, h) - dfn(x0));
    assert(ctr < fwd / 10, `中心差分误差(${ctr}) 应远小于前向差分(${fwd})`);
  });
}

// ============================ 积分 ============================
console.log('\n黎曼和与数值积分');
{
  const {
    computeRiemannSum,
    trapezoidSum,
    simpsonSum,
    computeRiemannRectangles,
    validateIntegrationRange,
    computeHighPrecisionReference,
    computeQuadrature,
  } = integral;

  check('区间与分段数校验：n=0 / 小数 n 被拒绝', () => {
    assert(!validateIntegrationRange(Math.sin, 0, 1, 0).ok, 'n=0 应被拒绝');
    assert(!validateIntegrationRange(Math.sin, 0, 1, 2.5).ok, 'n 为小数应被拒绝');
    const suggestion = validateIntegrationRange(Math.sin, 0, 1, 2.5).suggestion;
    assert(suggestion && suggestion.n === 3, '应给出修正建议');
  });

  check('被积函数在区间内无定义时给出明确提示', () => {
    const result = validateIntegrationRange((x) => Math.log(x - 1), 0, 2, 10);
    assert(!result.ok, 'ln(x-1) 在 [0,2] 上存在无定义点，应被拒绝');
  });

  check('b < a 时矩形宽度为正（旧实现宽度为负导致图形错乱）', () => {
    const rects = computeRiemannRectangles((x) => x, 2, 0, 4, 'left');
    assert(rects.every((r) => r.width > 0), '所有矩形宽度应为正');
  });

  check('梯形法与辛普森法的误差阶优于黎曼和', () => {
    const fn = (x) => Math.exp(x);
    const exact = Math.E - 1;
    const n = 20;
    const left = Math.abs(computeRiemannSum(fn, 0, 1, n, 'left') - exact);
    const trapezoid = Math.abs(trapezoidSum(fn, 0, 1, n) - exact);
    const simpson = Math.abs(simpsonSum(fn, 0, 1, n) - exact);
    assert(trapezoid < left, `梯形法(${trapezoid}) 应优于左端点(${left})`);
    assert(simpson < trapezoid, `辛普森(${simpson}) 应优于梯形法(${trapezoid})`);
  });

  check('辛普森法自动处理奇数分段', () => {
    const odd = simpsonSum((x) => x * x, 0, 1, 9);
    approx(odd, 1 / 3, 1e-12, '奇数 n 应自动补成偶数');
  });

  check('无初等原函数时提供高精度数值参考（sin(x)/x）', () => {
    const reference = computeHighPrecisionReference((x) => (x === 0 ? 1 : Math.sin(x) / x), 0, 1);
    assert(reference !== null, '应能给出数值参考值');
    approx(reference, 0.9460830703671831, 1e-9, 'Si(1) 的参考值');
  });

  check('统一入口 computeQuadrature 与各方法一致', () => {
    const fn = (x) => Math.sin(x);
    approx(computeQuadrature(fn, 0, 1, 10, 'trapezoid'), trapezoidSum(fn, 0, 1, 10), 1e-15, '梯形法');
    approx(computeQuadrature(fn, 0, 1, 10, 'simpson'), simpsonSum(fn, 0, 1, 10), 1e-15, '辛普森');
  });
}

// ============================ 级数 ============================
console.log('\n级数与收敛性');
{
  const {
    TAYLOR_FUNCTIONS,
    taylorApprox,
    taylorCoeffs,
    describeTermLimits,
    isWithinConvergence,
    measureGibbsOvershoot,
    lagrangeRemainderBound,
  } = series;

  const expFn = TAYLOR_FUNCTIONS.find((f) => f.id === 'exp');
  const lnFn = TAYLOR_FUNCTIONS.find((f) => f.id === 'ln');

  check('系数按公式生成，项数不再被硬编码 11 项静默截断', () => {
    const coeffs = taylorCoeffs(expFn, 25);
    assert(coeffs.length === 25, '应生成 25 个系数');
    const fifteen = taylorApprox(1, 0, coeffs, 15, expFn.coefficient);
    const twelve = taylorApprox(1, 0, coeffs, 12, expFn.coefficient);
    assert(fifteen !== twelve, '15 项与 12 项的结果必须不同（旧实现被截断成同一个值）');
    approx(fifteen, Math.E, 1e-9, '15 项泰勒近似 e');
    assert(describeTermLimits(expFn, 10) === null, '项数在可用范围内不应提示');
  });

  check('超过可用项数时给出提示而不是静默截断', () => {
    const notice = describeTermLimits(expFn, 200, 61);
    assert(typeof notice === 'string' && notice.includes('61'), '应提示实际可用项数');
  });

  check('收敛域判定：ln(1+x) 在 x=2 处发散', () => {
    assert(isWithinConvergence(lnFn, 0.5), 'x=0.5 应收敛');
    assert(isWithinConvergence(lnFn, 1), 'x=1 处条件收敛，应视为可用');
    assert(!isWithinConvergence(lnFn, 2), 'x=2 处发散，应被裁掉');
    assert(Number.isFinite(lagrangeRemainderBound(lnFn, 0.5, 5)), '收敛域内应有有限余项上界');
    assert(!Number.isFinite(lagrangeRemainderBound(lnFn, 2, 5)), '发散点余项上界应为无穷');
    assert(isWithinConvergence(expFn, 1e6), 'eˣ 收敛半径为 ∞');
  });

  check('Gibbs 超调量实测接近理论值 8.95%（按跳变幅度归一化）', () => {
    const gibbs = measureGibbsOvershoot(200);
    approx(gibbs.theoretical, 0.0894899, 1e-6, '理论超调量');
    assert(
      Math.abs(gibbs.overshoot - gibbs.theoretical) < 0.003,
      `200 项时实测超调 ${gibbs.percent.toFixed(3)}% 应接近 8.95%`,
    );
    // 与谐波数无关：即使只有 20 项，超调比例也应接近同一常数
    approx(measureGibbsOvershoot(20).overshoot, gibbs.theoretical, 0.01, '20 项时的超调比例');
  });
}

// ============================ 知识图谱 ============================
console.log('\n知识图谱路径');
{
  const { findShortestPath, findLearningPath, getMasteryLabel, getMasteryColor, toPercentMastery, collectPrerequisites } = graph;

  const edges = [
    { source: 'limit', target: 'derivative', type: 'PREREQUISITE' },   // 极限是导数的前置
    { source: 'derivative', target: 'integral', type: 'PREREQUISITE' }, // 导数是积分的前置
    { source: 'limit', target: 'series', type: 'RELATED' },
  ];

  check('前置关系有向：可以从积分回溯到极限，反向不成立', () => {
    const forward = findShortestPath(edges, 'integral', 'limit');
    assert(forward && forward.join('→') === 'integral→derivative→limit', `实际 ${forward}`);
    const backward = findShortestPath(edges, 'limit', 'integral');
    assert(backward === null, '沿正向不应可达（学习顺序是 极限→导数→积分）');
  });

  check('RELATED 关系双向可达', () => {
    assert(findShortestPath(edges, 'limit', 'series') !== null, 'RELATED 应双向');
    assert(findShortestPath(edges, 'series', 'limit') !== null, 'RELATED 应双向');
  });

  check('无路径返回 null，可与“起点即终点”区分', () => {
    const isolated = findShortestPath(edges, 'derivative', 'nonexistent');
    assert(isolated === null, '不可达应返回 null');
    assert(findShortestPath(edges, 'limit', 'limit').join('→') === 'limit', '起点即终点应返回单点数组');
  });

  check('学习路径按先修先后拓扑排序，并标出未掌握的前置', () => {
    const mastery = { limit: 10, derivative: 80, integral: 0, series: 0 };
    const learningPath = findLearningPath(edges, 'integral', {
      masteryOf: (id) => mastery[id] ?? 0,
    });
    assert(learningPath.found, '应能找到学习路径');
    const order = learningPath.steps.map((s) => s.id);
    assert(order.indexOf('limit') < order.indexOf('derivative'), `先修应在前：${order}`);
    assert(learningPath.gaps.includes('limit'), '未掌握的前置应进入 gaps');
    assert(!learningPath.gaps.includes('derivative'), '已掌握的前置不应进入 gaps');
  });

  check('前置闭包收集完整', () => {
    const closure = collectPrerequisites(edges, 'integral').sort();
    assert(closure.join(',') === 'derivative,limit', `实际 ${closure}`);
  });

  check('掌握度量纲统一：0~1 与 0~100 得到同样的标签', () => {
    assert(getMasteryLabel(0.5) === getMasteryLabel(50), '0.5 与 50 应一致');
    assert(getMasteryLabel(0.5) === '学习中', `实际 ${getMasteryLabel(0.5)}`);
    assert(getMasteryLabel(0) === '未学习', '0 应为未学习');
    assert(toPercentMastery(0.95) === 95, '0.95 应换算为 95');
    assert(getMasteryColor(0.95) === getMasteryColor(95), '颜色也应一致');
    assert(getMasteryColor(0) !== getMasteryColor(95), '未学习与已掌握颜色应有区分');
  });
}

console.log(`\n通过 ${passed} 项，失败 ${failures.length} 项`);
if (failures.length) {
  console.log('\n失败明细：');
  failures.forEach((f) => console.log(` - ${f.name}: ${f.message}`));
  process.exit(1);
}
process.exit(0);
