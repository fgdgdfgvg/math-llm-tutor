export interface EpsilonDeltaFunction {
  id: string
  name: string
  fn: (x: number) => number
  limitPoint: number
  limitValue: number
  description: string
  hint: string
}

export const EPSILON_DELTA_FUNCTIONS: EpsilonDeltaFunction[] = [
  {
    id: 'sin_x_over_x',
    name: 'lim(x→0) sin(x)/x = 1',
    fn: (x: number) => (x === 0 ? 1 : Math.sin(x) / x),
    limitPoint: 0,
    limitValue: 1,
    description: '当 x→0 时，sin(x)/x 的极限是 1。这是微积分中最重要的极限之一。',
    hint: '尝试将 ε 设为 0.3，然后找到合适的 δ 使得 |f(x)-1|<ε。绿色虚线是允许误差范围，橙色虚线是 δ 邻域。',
  },
  {
    id: 'x2_minus_4',
    name: 'lim(x→2) (x²-4)/(x-2) = 4',
    fn: (x: number) => (x === 2 ? 4 : (x * x - 4) / (x - 2)),
    limitPoint: 2,
    limitValue: 4,
    description: '当 x→2 时，(x²-4)/(x-2) = x+2 → 4。函数在 x=2 处有"洞"，但极限存在。',
    hint: '这个函数在 x=2 处有个"洞"，但极限仍然存在。设 ε=0.5 试试。',
  },
  {
    id: 'exp_minus_1',
    name: 'lim(x→0) (eˣ-1)/x = 1',
    fn: (x: number) => (x === 0 ? 1 : (Math.exp(x) - 1) / x),
    limitPoint: 0,
    limitValue: 1,
    description: '当 x→0 时，(eˣ-1)/x → 1。这是自然对数底 e 的重要性质。',
    hint: '这个极限告诉我们 eˣ 在 x=0 处的"瞬时增长率"是 1。',
  },
  {
    id: 'x3',
    name: 'lim(x→1) x³ = 1',
    fn: (x: number) => x * x * x,
    limitPoint: 1,
    limitValue: 1,
    description: '当 x→1 时，x³ → 1。多项式函数在每一点都连续，极限值等于函数值。',
    hint: '多项式函数处处连续，极限值就等于函数值。试试较大的 ε 和 δ。',
  },
]

/** 采样点数：数值验证本身是近似的，UI 上应标注出来 */
const DEFAULT_SAMPLES = 400

export interface DeltaEvaluation {
  /** 是否所有采样点都落在 ε 带内 */
  satisfied: boolean
  /** 实际比较过的采样点数量（0 表示无法判定） */
  checked: number
  /** 违反 |f(x)-L|<ε 的最严重点 */
  worst?: { x: number; value: number; deviation: number }
  /** 是否因为 δ 过小/定义域问题导致无法判定 */
  degenerate: boolean
}

/**
 * 按 ε-δ 定义在**去心邻域** 0 < |x-a| < δ 上验证 δ。
 *
 * 修复的三个真实缺陷：
 *  1. 旧实现在闭区间 [a-δ, a+δ] 上采样（含端点）。ε-δ 定义要求去心邻域，
 *     端点处函数值可以超出 ε 带，因此旧实现会把**合法**的 δ 判为不通过。
 *  2. 旧实现用绝对阈值 `|x-a| < 1e-4` 跳过中心点：当 δ < 1e-4 时所有采样点都被
 *     跳过，函数直接 return true —— 学生把 δ 拖到极小即可"通关"。现在阈值是
 *     相对量 δ·1e-9，并把"全部被跳过"作为无法判定处理（不返回 true）。
 *  3. 旧实现不检查定义域，`ln(x)` 等在邻域外的 NaN 会被当成"不满足"。
 *     现在遇到无定义点跳过并计数，全部无定义时判为无法判定。
 */
export function evaluateDelta(
  fn: (x: number) => number,
  limitPoint: number,
  limitValue: number,
  epsilon: number,
  delta: number,
  sampleCount = DEFAULT_SAMPLES,
): DeltaEvaluation {
  if (!Number.isFinite(epsilon) || !Number.isFinite(delta) || epsilon <= 0 || delta <= 0) {
    return { satisfied: false, checked: 0, degenerate: true }
  }

  const centerThreshold = delta * 1e-9
  let checked = 0
  let undefinedPoints = 0
  let collapsedPoints = 0
  let worst: DeltaEvaluation['worst']

  // i 从 1 到 sampleCount-1：两侧对称取样，且**永不取端点**（|x-a| = δ）
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 1; i < sampleCount; i++) {
      const offset = (delta * i) / sampleCount
      if (offset <= centerThreshold) continue
      const x = limitPoint + side * offset
      // 浮点精度坍缩：x 与 a 无法区分时该点不携带任何信息
      // （否则会拿 f(a) 当成邻域内的值，得出虚假的"满足"）
      if (x === limitPoint) {
        collapsedPoints++
        continue
      }
      const value = fn(x)
      if (!Number.isFinite(value)) {
        undefinedPoints++
        continue
      }
      checked++
      const deviation = Math.abs(value - limitValue)
      if (deviation >= epsilon) {
        return {
          satisfied: false,
          checked,
          worst: { x, value, deviation },
          degenerate: false,
        }
      }
      if (!worst || deviation > worst.deviation) worst = { x, value, deviation }
    }
  }

  if (checked === 0) {
    // 所有采样点都因浮点坍缩或被跳过而不可用 → 无法判定（不是"满足"）
    return { satisfied: false, checked: 0, degenerate: collapsedPoints > 0 || undefinedPoints === 0 }
  }

  return { satisfied: true, checked, worst, degenerate: undefinedPoints === checked }
}

/** 简洁判定（向后兼容旧调用方）；无法判定时返回 false 而不是 true */
export function checkDelta(
  fn: (x: number) => number,
  limitPoint: number,
  limitValue: number,
  epsilon: number,
  delta: number,
  sampleCount = DEFAULT_SAMPLES,
): boolean {
  return evaluateDelta(fn, limitPoint, limitValue, epsilon, delta, sampleCount).satisfied
}

export interface OptimalDeltaResult {
  /** 找到的最大可行 δ；未找到时为 null */
  delta: number | null
  /** 是否由 findOptimalDelta 找到（而不是"当前 δ 恰好可行"） */
  found: boolean
  /** 搜索过程中实际验证的次数（诊断用） */
  evaluations: number
  /** 未找到时的原因 */
  reason?: string
}

/**
 * 求满足 ε 的**最大**可行 δ。
 *
 * 旧实现的问题：
 *  - 注释说"二分搜索"，实际是从 startDelta 起线性递减 1000 步；
 *  - 搜索上界就是传入的 startDelta，永远找不到比它更大的 δ；
 *  - 1000 步内无解时返回**未经任何验证**的 startDelta，把一个肯定不成立的 δ
 *    当作"最优 δ"展示给学生；
 *  - 单次调用约 1000×201 ≈ 20 万次函数求值，还被放进 Vue computed 里同步执行。
 *
 * 新实现：先在 [0, δ_hi] 上做指数扩张找出一个可行上界（δ_hi 与函数定义域相关，
 * 不受"当前 δ"限制），再在该区间上二分 ~40 次，总求值量约 8000 次量级。
 * 无解时返回 null，由 UI 明确提示，而不是回填一个错误值。
 */
export function findOptimalDelta(
  fn: (x: number) => number,
  limitPoint: number,
  limitValue: number,
  epsilon: number,
  startDelta = 1,
  sampleCount = DEFAULT_SAMPLES,
): number | null {
  return searchOptimalDelta(fn, limitPoint, limitValue, epsilon, startDelta, sampleCount).delta
}

export function searchOptimalDelta(
  fn: (x: number) => number,
  limitPoint: number,
  limitValue: number,
  epsilon: number,
  startDelta = 1,
  sampleCount = DEFAULT_SAMPLES,
): OptimalDeltaResult {
  if (!Number.isFinite(epsilon) || epsilon <= 0) {
    return { delta: null, found: false, evaluations: 0, reason: 'ε 必须为正数' }
  }
  const seed = Number.isFinite(startDelta) && startDelta > 0 ? startDelta : 1
  let evaluations = 0

  const feasible = (delta: number): boolean => {
    evaluations++
    return checkDelta(fn, limitPoint, limitValue, epsilon, delta, sampleCount)
  }

  /** 评估成本较高，采样点数随 δ 减小而减小（小邻域内函数变化更平缓） */
  const feasibleCheap = (delta: number): boolean => {
    evaluations++
    const localSamples = Math.max(60, Math.min(sampleCount, Math.ceil(200 * Math.min(1, delta / seed))))
    return checkDelta(fn, limitPoint, limitValue, epsilon, delta, localSamples)
  }

  // 1. 找到一个可行点：从 seed 出发指数收缩
  let lo = 0 // 不可行下界（0 视为不可行，避免取到空集）
  let hi = 0 // 已知可行的 δ
  let probe = seed
  for (let i = 0; i < 40; i++) {
    if (feasibleCheap(probe)) {
      hi = probe
      break
    }
    lo = probe
    probe /= 2
    if (probe < Math.abs(limitPoint) * 1e-12 + 1e-12) break
  }

  if (hi === 0) {
    return { delta: null, found: false, evaluations, reason: '当前 ε 下未找到可行 δ（函数可能在该点不连续）' }
  }

  // 2. 指数扩张上界，确认 hi 附近是否还有更大的可行 δ
  let upper = hi
  for (let i = 0; i < 40; i++) {
    const next = upper * 2
    if (feasibleCheap(next)) {
      hi = next
      upper = next
      continue
    }
    lo = Math.max(lo, next * 0.5)
    upper = next
    break
  }

  // 3. 在 [hi, upper] 上二分，逼近最大可行 δ
  let left = hi
  let right = upper
  for (let i = 0; i < 40 && right - left > Math.max(1e-12, left * 1e-9); i++) {
    const mid = (left + right) / 2
    if (feasible(mid)) left = mid
    else right = mid
  }

  // 4. 最终结果必须再验证一次，绝不返回未经验证的值
  if (!feasible(left)) {
    return { delta: null, found: false, evaluations, reason: '二分结果未通过最终验证' }
  }
  return { delta: left, found: true, evaluations }
}

/**
 * 采样法的可靠性提示。
 * 数值验证永远只是近似：应同时标注"符号/解析验证"的结论，两者不一致本身就是教学点。
 */
export function describeDeltaVerification(epsilon: number, samples = DEFAULT_SAMPLES): string {
  return `数值验证（ε=${epsilon}，去心邻域 ${samples} 点对称采样）：结论为近似判定，不构成严格证明`
}
