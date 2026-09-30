/**
 * 级数逼近工具。
 *
 * 修复的缺陷：
 *  1. 系数硬编码 11 项，`taylorApprox` 在 terms > 11 时**静默截断**——学生把项数
 *     拉到 15，图像却停在 11 项且没有任何提示。现在系数由解析公式按需生成（上限很大）。
 *  2. 没有收敛域概念：ln(1+x) 的级数只在 (-1, 1] 收敛，但误差曲线在发散区照样绘制，
 *     画出来的"误差"没有数学意义。现在每个函数带收敛半径，发散区被裁掉并标注。
 *  3. 没有余项（理论误差上界），只有实测误差。现在提供拉格朗日余项上界。
 *  4. Gibbs 现象只写在文档里，代码中没有任何超调量测量。现在可计算并对照理论值 8.95%。
 */

export interface TaylorFunction {
  id: string
  name: string
  center: number
  /** 第 k 项系数 a_k（展开中心为 center）：f(x) = Σ a_k (x-center)^k */
  coefficient: (k: number) => number
  /** 收敛半径（Infinity 表示在全实轴收敛；ln(1+x) 在 x=1 处条件收敛，取 1） */
  convergenceRadius: number
  /** 收敛域的右端点是否包含（ln(1+x) 在 x=1 处收敛、x=-1 处发散） */
  includeRightEndpoint: boolean
  /** 拉格朗日余项上界 |R_n(x)| ≤ M|x-c|^{n+1}/(n+1)! 中的 M 估计 */
  remainderBound: (x: number, n: number) => number
}

const factorialExact = (n: number): number => {
  let result = 1
  for (let i = 2; i <= n; i++) result *= i
  return result
}

export function factorial(n: number): number {
  return factorialExact(Math.max(0, Math.floor(n)))
}

/** 兼容旧字段：保留 taylorCoeffs，但由公式生成且长度足够（默认 61 项） */
const DEFAULT_COEFF_COUNT = 61

export const TAYLOR_FUNCTIONS: TaylorFunction[] = [
  {
    id: 'exp',
    name: 'eˣ',
    center: 0,
    coefficient: (k) => 1 / factorialExact(k),
    convergenceRadius: Infinity,
    includeRightEndpoint: true,
    remainderBound: (x, n) => Math.exp(Math.abs(x)) / factorialExact(n + 1),
  },
  {
    id: 'sin',
    name: 'sin(x)',
    center: 0,
    coefficient: (k) => (k % 2 === 1 ? ((k - 1) / 2) % 2 === 0 ? 1 / factorialExact(k) : -1 / factorialExact(k) : 0),
    convergenceRadius: Infinity,
    includeRightEndpoint: true,
    remainderBound: (x, n) => Math.pow(Math.abs(x), n + 1) / factorialExact(n + 1),
  },
  {
    id: 'cos',
    name: 'cos(x)',
    center: 0,
    coefficient: (k) => (k % 2 === 0 ? (k / 2) % 2 === 0 ? 1 / factorialExact(k) : -1 / factorialExact(k) : 0),
    convergenceRadius: Infinity,
    includeRightEndpoint: true,
    remainderBound: (x, n) => Math.pow(Math.abs(x), n + 1) / factorialExact(n + 1),
  },
  {
    id: 'ln',
    name: 'ln(1+x)',
    center: 0,
    coefficient: (k) => (k === 0 ? 0 : (k % 2 === 1 ? 1 / k : -1 / k)),
    convergenceRadius: 1,
    includeRightEndpoint: true,
    // |f^(n+1)| = n!/(1+ξ)^{n+1} ≤ n!/(1-|x|)^{n+1}（|x|<1）
    remainderBound: (x, n) => {
      const r = Math.abs(x)
      if (r >= 1) return Infinity
      return (factorialExact(n) / Math.pow(1 - r, n + 1)) * Math.pow(r, n + 1) / factorialExact(n + 1)
    },
  },
]

/** 生成前 count 项系数（替代旧的硬编码数组） */
export function taylorCoeffs(fn: TaylorFunction, count = DEFAULT_COEFF_COUNT): number[] {
  return Array.from({ length: count }, (_, k) => fn.coefficient(k))
}

/** 精度提示：术语超出可用项数时明确告知，而不是静默截断 */
export function describeTermLimits(fn: TaylorFunction, terms: number, available = DEFAULT_COEFF_COUNT): string | null {
  if (terms > available) {
    return `当前仅精确计算前 ${available} 项，已按 ${available} 项近似`
  }
  return null
}

export function taylorApprox(
  x: number,
  center: number,
  coeffs: number[],
  terms: number,
  coefficient?: (k: number) => number,
): number {
  let sum = 0
  for (let k = 0; k < terms; k++) {
    const a =
      k < coeffs.length
        ? coeffs[k]
        : coefficient
          ? coefficient(k)
          : 0
    sum += a * Math.pow(x - center, k)
  }
  return sum
}

/** 该点是否落在收敛域内 */
export function isWithinConvergence(fn: TaylorFunction, x: number): boolean {
  const offset = Math.abs(x - fn.center)
  if (!Number.isFinite(fn.convergenceRadius)) return true
  if (offset < fn.convergenceRadius) return true
  if (offset === fn.convergenceRadius) return fn.includeRightEndpoint && x >= fn.center
  return false
}

/** 拉格朗日余项上界 |R_n(x)|（理论误差），NaN/Infinity 表示理论上界不可用 */
export function lagrangeRemainderBound(fn: TaylorFunction, x: number, terms: number): number {
  if (!isWithinConvergence(fn, x)) return Infinity
  return fn.remainderBound(x, Math.max(0, terms - 1))
}

export function fourierSquareWave(x: number, terms: number): number {
  let sum = 0
  for (let k = 0; k < terms; k++) {
    const n = 2 * k + 1
    sum += (4 / (n * Math.PI)) * Math.sin(n * x)
  }
  return sum
}

/** 方波的跳变量：从 -1 跳到 +1，幅度为 2 */
export const SQUARE_WAVE_JUMP = 2

/**
 * Gibbs 现象超调量测量。
 *
 * 方波傅里叶级数在跳变点附近始终过冲约 **跳变幅度的 8.95%**（与谐波数无关）。
 * 注意分母是跳变幅度而不是平台值：对 -1→+1 的方波，绝对超调约 0.179，
 * 即 0.179 / 2 ≈ 8.95%。把它做成可观测数值，而不是只写在文档里。
 */
export function measureGibbsOvershoot(terms: number, samples = 4000): {
  /** 相对跳变幅度的超调比例（理想值 0.0895） */
  overshoot: number
  theoretical: number
  percent: number
  /** 绝对超调量（以平台值为基准超出多少） */
  maxDeviation: number
} {
  const theoretical = 0.0894899 // (2/π)∫₀^π sin(t)/t dt - 1
  let maxDeviation = 0
  // 跳变点 x=0 与 x=±π：在 (-π, π) 上搜索超出平台的局部极值
  for (let i = 1; i < samples; i++) {
    const x = -Math.PI + (2 * Math.PI * i) / samples
    if (Math.abs(x) < 1e-6) continue
    const value = fourierSquareWave(x, terms)
    const deviation = Math.max(0, Math.abs(value) - 1)
    if (deviation > maxDeviation) maxDeviation = deviation
  }
  const relative = maxDeviation / SQUARE_WAVE_JUMP
  return {
    overshoot: relative,
    theoretical,
    percent: relative * 100,
    maxDeviation,
  }
}

export interface ErrorPoint {
  x: number
  error: number
  /** 该点是否在收敛域内 */
  inDomain: boolean
  /** 拉格朗日余项上界 */
  bound: number
}

export interface ErrorDistribution {
  points: ErrorPoint[]
  /** 是否在区域内检测到发散（用于 UI 灰色遮罩与提示） */
  divergent: boolean
  divergenceFrom?: number
}

/**
 * 误差分布。收敛域外的点被标记 `inDomain: false` 且不参与"误差"语义
 * （旧实现在发散区照样画误差曲线，甚至因溢出产生断裂）。
 */
export function computeErrorDistribution(
  exactFn: (x: number) => number,
  center: number,
  coeffs: number[],
  terms: number,
  xRange: [number, number],
  pointCount = 200,
  taylorFn?: TaylorFunction,
): ErrorDistribution {
  const [xMin, xMax] = xRange
  const points: ErrorPoint[] = []
  let divergent = false
  let divergenceFrom: number | undefined

  for (let i = 0; i <= pointCount; i++) {
    const x = xMin + ((xMax - xMin) * i) / pointCount
    const inDomain = taylorFn ? isWithinConvergence(taylorFn, x) : true
    if (!inDomain && divergenceFrom === undefined) {
      divergenceFrom = x
      divergent = true
    }
    const exact = exactFn(x)
    const approx = taylorApprox(x, center, coeffs, terms, taylorFn?.coefficient)
    const error = inDomain && Number.isFinite(exact) && Number.isFinite(approx)
      ? Math.abs(exact - approx)
      : NaN
    const bound = taylorFn ? lagrangeRemainderBound(taylorFn, x, terms) : NaN
    points.push({ x, error, inDomain, bound })
  }

  return { points, divergent, divergenceFrom }
}

/** 收敛性实验：给定 n 序列，返回实测误差是否随 n 单调下降（教学与自检共用） */
export function checkConvergenceTrend(
  exactFn: (x: number) => number,
  fn: TaylorFunction,
  x: number,
  termSequence: number[] = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20],
): { terms: number; error: number }[] {
  const coeffs = taylorCoeffs(fn)
  return termSequence.map((terms) => ({
    terms,
    error: Math.abs(exactFn(x) - taylorApprox(x, fn.center, coeffs, terms, fn.coefficient)),
  }))
}
