export interface DerivativeFunction {
  id: string
  name: string
  fn: (x: number) => number
  dfn: (x: number) => number
  d2fn: (x: number) => number
  /** 定义域（可选）；未提供时按全体实数处理 */
  domain?: (x: number) => boolean
}

export const DERIVATIVE_FUNCTIONS: DerivativeFunction[] = [
  { id: 'x2', name: 'x²', fn: (x) => x * x, dfn: (x) => 2 * x, d2fn: () => 2 },
  { id: 'x3', name: 'x³', fn: (x) => x * x * x, dfn: (x) => 3 * x * x, d2fn: (x) => 6 * x },
  { id: 'sin', name: 'sin(x)', fn: (x) => Math.sin(x), dfn: (x) => Math.cos(x), d2fn: (x) => -Math.sin(x) },
  { id: 'exp', name: 'eˣ', fn: (x) => Math.exp(x), dfn: (x) => Math.exp(x), d2fn: (x) => Math.exp(x) },
  {
    id: 'ln',
    name: 'ln(x)',
    fn: (x) => (x > 0 ? Math.log(x) : NaN),
    dfn: (x) => (x > 0 ? 1 / x : NaN),
    d2fn: (x) => (x > 0 ? -1 / (x * x) : NaN),
    domain: (x) => x > 0,
  },
  {
    id: 'x4',
    name: 'x⁴（f″(0)=0 但不是拐点）',
    fn: (x) => x ** 4,
    dfn: (x) => 4 * x ** 3,
    d2fn: (x) => 12 * x * x,
  },
]

/** h 的最小绝对值：避免 h=0 时 (f(x+h)-f(x))/h = 0/0 = NaN 把整条割线变成 NaN */
export const MIN_STEP = 1e-6

const clampStep = (h: number): number => {
  if (!Number.isFinite(h)) return MIN_STEP
  if (Math.abs(h) < MIN_STEP) return h < 0 ? -MIN_STEP : MIN_STEP
  return h
}

export interface LineSeries {
  xs: number[]
  ys: number[]
}

export interface SecantLine extends LineSeries {
  slope: number
  /** 实际使用的步长（可能已被钳制） */
  usedStep: number
  /** 数据是否因定义域越界被截断 */
  truncated: boolean
}

export function computeTangentLine(
  fn: (x: number) => number,
  dfn: (x: number) => number,
  x0: number,
  xRange: [number, number],
  pointCount = 50,
): LineSeries {
  const slope = dfn(x0)
  const y0 = fn(x0)
  const xs: number[] = []
  const ys: number[] = []
  const [xMin, xMax] = xRange
  for (let i = 0; i <= pointCount; i++) {
    const x = xMin + ((xMax - xMin) * i) / pointCount
    xs.push(x)
    ys.push(Number.isFinite(slope) && Number.isFinite(y0) ? y0 + slope * (x - x0) : NaN)
  }
  return { xs, ys }
}

/**
 * 割线：过 (x0, f(x0)) 与 (x0+h, f(x0+h))。
 *
 * 修复：h 由滑块驱动，取到 0 时旧实现得到 0/0 = NaN，整条线连同图表一起崩。
 * 现在把 |h| 钳到 MIN_STEP，并对定义域越界的点标 NaN 而不是让它污染整条序列。
 */
export function computeSecantLine(
  fn: (x: number) => number,
  x0: number,
  h: number,
  xRange: [number, number],
  pointCount = 50,
): SecantLine {
  const usedStep = clampStep(h)
  const y0 = fn(x0)
  const y1 = fn(x0 + usedStep)
  const slope = (y1 - y0) / usedStep
  const xs: number[] = []
  const ys: number[] = []
  const [xMin, xMax] = xRange
  let truncated = false
  for (let i = 0; i <= pointCount; i++) {
    const x = xMin + ((xMax - xMin) * i) / pointCount
    xs.push(x)
    const y = Number.isFinite(slope) && Number.isFinite(y0) ? y0 + slope * (x - x0) : NaN
    if (!Number.isFinite(y)) truncated = true
    ys.push(y)
  }
  return { xs, ys, slope, usedStep, truncated }
}

/** 前向差分 (f(x+h)-f(x))/h —— 截断误差 O(h) */
export function forwardDifference(fn: (x: number) => number, x0: number, h = 1e-5): number {
  const step = clampStep(h)
  return (fn(x0 + step) - fn(x0)) / step
}

/** 中心差分 (f(x+h)-f(x-h))/(2h) —— 截断误差 O(h²)，教材推荐的数值求导方式 */
export function centralDifference(fn: (x: number) => number, x0: number, h = 1e-5): number {
  const step = clampStep(h)
  return (fn(x0 + step) - fn(x0 - step)) / (2 * step)
}

/** 二阶中心差分，用于数值验证 f″ */
export function secondCentralDifference(fn: (x: number) => number, x0: number, h = 1e-4): number {
  const step = clampStep(h)
  return (fn(x0 + step) - 2 * fn(x0) + fn(x0 - step)) / (step * step)
}

export type Concavity = 'concave' | 'convex' | 'inflection' | 'undefined' | 'undetermined'

export interface ConcavityAnalysis {
  kind: Concavity
  /** 教材口径的中文标签（统一术语，不再混用"上凸/下凸"） */
  label: string
  /** f″(x0) 的值 */
  secondDerivative: number
  /** 左右邻域的符号 */
  leftSign: number
  rightSign: number
  explanation: string
}

/** 统一术语：同济版约定 f″>0 为凹（concave up），f″<0 为凸（concave down） */
export const CONCAVITY_TERMS = {
  concave: '凹（f″>0）',
  convex: '凸（f″<0）',
  inflection: '拐点（f″ 左右变号）',
  undefined: '未定义',
  undetermined: '需进一步分析',
} as const

function signOf(value: number): number {
  if (!Number.isFinite(value)) return NaN
  if (Math.abs(value) < 1e-9) return 0
  return value > 0 ? 1 : -1
}

/**
 * 凹凸性判定。
 *
 * 修复：旧实现 `f''(x0) === 0 → 返回"拐点"`，这是**错误**的——f″(x0)=0 只是
 * 拐点的必要条件，反例 f(x)=x⁴ 在 x=0 处 f″=0 却不是拐点。正确判据是 f″ 在
 * x0 两侧变号（或最低阶非零导数阶数为奇数）。
 * 旧实现的中文标签还同时用了"凹（上凸）/凸（下凸）"两套互相矛盾的体系。
 */
export function analyzeConcavity(
  d2fn: (x: number) => number,
  x0: number,
  eta = 1e-3,
): ConcavityAnalysis {
  const center = d2fn(x0)
  if (!Number.isFinite(center)) {
    return {
      kind: 'undefined',
      label: CONCAVITY_TERMS.undefined,
      secondDerivative: center,
      leftSign: NaN,
      rightSign: NaN,
      explanation: 'x₀ 处函数或其二阶导数无定义',
    }
  }

  // 在 x0 两侧取样判断符号变化（避开 x0 本身）
  const sampleSide = (direction: -1 | 1): number[] => {
    const values: number[] = []
    for (const scale of [0.25, 0.5, 1]) {
      const value = d2fn(x0 + direction * eta * scale)
      if (Number.isFinite(value)) values.push(signOf(value))
    }
    return values
  }

  const left = sampleSide(-1)
  const right = sampleSide(1)
  const leftSign = left.length ? left[left.length - 1] : NaN
  const rightSign = right.length ? right[right.length - 1] : NaN

  if (leftSign === 0 || rightSign === 0 || Number.isNaN(leftSign) || Number.isNaN(rightSign)) {
    return {
      kind: 'undetermined',
      label: CONCAVITY_TERMS.undetermined,
      secondDerivative: center,
      leftSign,
      rightSign,
      explanation: '邻域内 f″ 取值接近 0 或不可用，无法判定符号变化',
    }
  }

  if (leftSign !== rightSign) {
    return {
      kind: 'inflection',
      label: CONCAVITY_TERMS.inflection,
      secondDerivative: center,
      leftSign,
      rightSign,
      explanation: `f″ 在 x₀ 左右由 ${leftSign > 0 ? '正' : '负'} 变 ${rightSign > 0 ? '正' : '负'}，符号改变 → 拐点`,
    }
  }

  const concave = leftSign > 0
  return {
    kind: concave ? 'concave' : 'convex',
    label: concave ? CONCAVITY_TERMS.concave : CONCAVITY_TERMS.convex,
    secondDerivative: center,
    leftSign,
    rightSign,
    explanation: `f″ 在 x₀ 两侧同号（${concave ? '正' : '负'}）→ ${concave ? '凹' : '凸'}。` +
      (Math.abs(center) < 1e-9 ? '注意：f″(x₀)=0 本身不足以判定拐点。' : ''),
  }
}

/** 标签版本（向后兼容旧调用方） */
export function getConcavityLabel(d2fn: (x: number) => number, x0: number): string {
  return analyzeConcavity(d2fn, x0).label
}

/**
 * 数值求导误差对比：给出前向/中心差分的实测误差量级，
 * 用于展示"为什么中心差分更精确"（截断误差 O(h) vs O(h²)）。
 */
export function compareDifferenceSchemes(
  fn: (x: number) => number,
  dfn: (x: number) => number,
  x0: number,
  h = 1e-3,
): { forwardError: number; centralError: number; exact: number } {
  const exact = dfn(x0)
  return {
    exact,
    forwardError: Math.abs(forwardDifference(fn, x0, h) - exact),
    centralError: Math.abs(centralDifference(fn, x0, h) - exact),
  }
}
