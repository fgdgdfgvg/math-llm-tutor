export type RiemannType = 'left' | 'right' | 'midpoint'
/** 数值积分方法：黎曼三种取样点 + 梯形法 + 辛普森法 */
export type QuadratureMethod = RiemannType | 'trapezoid' | 'simpson'

export interface IntegralFunction {
  id: string
  name: string
  fn: (x: number) => number
  antideriv: (x: number) => number
  /** 定义域（可选），例如 1/x 在 0 处无定义 */
  domain?: (x: number) => boolean
}

export const INTEGRAL_FUNCTIONS: IntegralFunction[] = [
  { id: 'x2', name: 'x²', fn: (x) => x * x, antideriv: (x) => (x * x * x) / 3 },
  { id: 'sin', name: 'sin(x)', fn: (x) => Math.sin(x), antideriv: (x) => -Math.cos(x) },
  { id: 'exp', name: 'eˣ', fn: (x) => Math.exp(x), antideriv: (x) => Math.exp(x) },
  { id: 'linear', name: '2x+1', fn: (x) => 2 * x + 1, antideriv: (x) => x * x + x },
  { id: 'sinx_over_x', name: 'sin(x)/x（无初等原函数）', fn: (x) => (x === 0 ? 1 : Math.sin(x) / x), antideriv: () => NaN },
]

export const MAX_INTERVALS = 5000

export interface RangeValidation {
  ok: boolean
  message?: string
  /** 建议修正后的区间 */
  suggestion?: { a: number; b: number; n: number }
}

/**
 * 区间/分段数校验。
 *
 * 旧实现没有任何入参校验：`b < a` 时 dx<0，矩形宽度为负且结果符号翻转；
 * `n <= 0` 时 `dx = Infinity`，求和变 NaN；`n` 为小数时步长语义混乱。
 */
export function validateIntegrationRange(
  fn: (x: number) => number,
  a: number,
  b: number,
  n: number,
): RangeValidation {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return { ok: false, message: '积分上下限必须是有限实数' }
  }
  if (a === b) {
    return { ok: false, message: '上下限相同，积分值为 0（无需可视化）' }
  }
  let lo = Math.min(a, b)
  let hi = Math.max(a, b)
  if (!Number.isInteger(n) || n < 1) {
    return {
      ok: false,
      message: '分段数 n 必须是 ≥ 1 的整数',
      suggestion: { a, b, n: Math.max(1, Math.round(n) || 1) },
    }
  }
  if (n > MAX_INTERVALS) {
    return {
      ok: false,
      message: `分段数过大（上限 ${MAX_INTERVALS}），渲染会明显卡顿`,
      suggestion: { a, b, n: MAX_INTERVALS },
    }
  }
  // 抽样检查可求值性
  const probeCount = Math.min(50, n);
  for (let i = 0; i <= probeCount; i++) {
    const x = lo + ((hi - lo) * i) / probeCount
    if (!Number.isFinite(fn(x))) {
      return {
        ok: false,
        message: `被积函数在 x = ${x.toFixed(4)} 处无定义，请调整积分区间`,
      }
    }
  }
  return { ok: true }
}

const EPSILON_ENDPOINT = 1e-9

/** 端点安全求值：端点落在定义域外时向区间内微移 */
function safeEval(fn: (x: number) => number, x: number, lo: number, hi: number): number {
  const value = fn(x)
  if (Number.isFinite(value)) return value
  const nudged = x <= lo ? lo + (hi - lo) * EPSILON_ENDPOINT : hi - (hi - lo) * EPSILON_ENDPOINT
  return fn(nudged)
}

export function computeRiemannSum(
  fn: (x: number) => number,
  a: number,
  b: number,
  n: number,
  type: RiemannType = 'left',
): number {
  const dx = (b - a) / n
  let sum = 0
  for (let i = 0; i < n; i++) {
    const xi =
      type === 'left'
        ? a + i * dx
        : type === 'right'
          ? a + (i + 1) * dx
          : a + (i + 0.5) * dx
    sum += fn(xi) * dx
  }
  return sum
}

/** 梯形法：截断误差 O(1/n²) */
export function trapezoidSum(fn: (x: number) => number, a: number, b: number, n: number): number {
  const dx = (b - a) / n
  let sum = 0
  for (let i = 0; i < n; i++) {
    const left = i === 0 ? safeEval(fn, a, a, b) : fn(a + i * dx)
    const right = i === n - 1 ? safeEval(fn, b, a, b) : fn(a + (i + 1) * dx)
    sum += ((left + right) / 2) * dx
  }
  return sum
}

/**
 * 辛普森法（要求偶数分段，奇数时自动 +1）：截断误差 O(1/n⁴)。
 * 与左/右/中点（O(1/n)）、梯形（O(1/n²)）并列，才是"误差随 n 收敛"的完整教学形态。
 */
export function simpsonSum(fn: (x: number) => number, a: number, b: number, n: number): number {
  const evenN = n % 2 === 0 ? n : n + 1
  const dx = (b - a) / evenN
  let sum = safeEval(fn, a, a, b) + safeEval(fn, b, a, b)
  for (let i = 1; i < evenN; i++) {
    const value = fn(a + i * dx)
    sum += value * (i % 2 === 0 ? 2 : 4)
  }
  return (dx / 3) * sum
}

/** 按方法统一入口 */
export function computeQuadrature(
  fn: (x: number) => number,
  a: number,
  b: number,
  n: number,
  method: QuadratureMethod,
): number {
  if (method === 'trapezoid') return trapezoidSum(fn, a, b, n)
  if (method === 'simpson') return simpsonSum(fn, a, b, n)
  return computeRiemannSum(fn, a, b, n, method)
}

export function computeExactIntegral(
  antideriv: (x: number) => number,
  a: number,
  b: number,
): number {
  return antideriv(b) - antideriv(a)
}

/**
 * 高精度数值参考值（自适应 Simpson + Richardson 外推）。
 * 当函数没有初等原函数（如 sin(x)/x）时，用它代替"精确值"，并标注为数值参考。
 */
export function computeHighPrecisionReference(
  fn: (x: number) => number,
  a: number,
  b: number,
): number | null {
  const adaptive = (lo: number, hi: number, tolerance: number, depth: number): number => {
    const mid = (lo + hi) / 2
    const whole = ((hi - lo) / 6) * (safeEval(fn, lo, a, b) + 4 * fn(mid) + safeEval(fn, hi, a, b))
    const left = ((mid - lo) / 6) * (safeEval(fn, lo, a, b) + 4 * fn((lo + mid) / 2) + fn(mid))
    const right = ((hi - mid) / 6) * (fn(mid) + 4 * fn((mid + hi) / 2) + safeEval(fn, hi, a, b))
    if (depth <= 0 || Math.abs(left + right - whole) < 15 * tolerance) {
      return left + right + (left + right - whole) / 15
    }
    return adaptive(lo, mid, tolerance / 2, depth - 1) + adaptive(mid, hi, tolerance / 2, depth - 1);
  };
  const result = adaptive(a, b, 1e-10, 20);
  return Number.isFinite(result) ? result : null;
}

export interface RiemannRectangle {
  xLeft: number
  width: number
  height: number
  isPositive: boolean
}

/**
 * 生成矩形（仅用于绘制）。
 * 旧实现在 b < a 时 dx < 0，矩形的“宽度”为负数，图形错乱。
 * 这里统一按 [min(a,b), max(a,b)] 生成**正宽度**矩形；
 * 定积分的符号（有向面积）由 computeRiemannSum 负责，不由图形负责。
 */
export function computeRiemannRectangles(
  fn: (x: number) => number,
  a: number,
  b: number,
  n: number,
  type: RiemannType = 'left',
): RiemannRectangle[] {
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  const safeN = Math.max(1, Math.floor(n) || 1)
  const dx = (hi - lo) / safeN
  const rects: RiemannRectangle[] = []
  for (let i = 0; i < safeN; i++) {
    const xLeft = lo + i * dx
    const xi =
      type === 'left' ? xLeft : type === 'right' ? xLeft + dx : xLeft + dx / 2
    const height = fn(xi)
    rects.push({ xLeft, width: dx, height, isPositive: height >= 0 })
  }
  return rects
}

export interface MethodComparison {
  method: QuadratureMethod
  value: number
  /** 与参考真值的绝对误差 */
  error: number
  /** 理论截断误差阶 */
  order: string
}

/**
 * 并列比较各方法的误差量级（左/右/中点 O(1/n)，梯形 O(1/n²)，辛普森 O(1/n⁴)）。
 * 这是"误差随 n 收敛"教学的核心表格，此前系统完全没有。
 */
export function compareMethods(
  fn: (x: number) => number,
  a: number,
  b: number,
  n: number,
  reference: number,
): MethodComparison[] {
  const methods: [QuadratureMethod, string][] = [
    ['left', 'O(1/n)'],
    ['right', 'O(1/n)'],
    ['midpoint', 'O(1/n²)'],
    ['trapezoid', 'O(1/n²)'],
    ['simpson', 'O(1/n⁴)'],
  ]
  return methods.map(([method, order]) => {
    const value = computeQuadrature(fn, a, b, n, method)
    return { method, order, value, error: Math.abs(value - reference) }
  })
}
