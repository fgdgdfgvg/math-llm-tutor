export interface KnowledgeNode {
  id: string
  name: string
  type: string
  description: string
  formula?: string
  latex?: string
  difficulty: string
  tags: string[]
  x?: number
  y?: number
  mastery?: number
  practiceCount?: number
  correctRate?: number
  lastPractice?: string
  accuracy?: number
}

export interface GraphEdge {
  source: string
  target: string
  type: string
}

/**
 * 掌握度量纲统一。
 *
 * 系统里存在两套量纲：知识图谱接口用百分制（0~100），
 * `stores/cognitive.ts` 的认知维度是 0~1 小数。旧实现一律按百分制阈值判断，
 * 于是 0~1 的值永远小于 30，所有节点都显示"未学习/红色"。
 * 这里统一按**百分制**对外，并在入口把 0~1 自动放大。
 */
export function toPercentMastery(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0
  const scaled = value > 0 && value <= 1 ? value * 100 : value
  return Math.max(0, Math.min(100, scaled))
}

export function getMasteryColor(mastery: number | null | undefined): string {
  const value = toPercentMastery(mastery)
  if (value >= 90) return '#4CAF50'
  if (value >= 70) return '#8BC34A'
  if (value >= 50) return '#FFC107'
  if (value >= 30) return '#FF9800'
  if (value > 0) return '#F44336'
  return '#94a3b8'
}

export function getMasteryLabel(mastery: number | null | undefined): string {
  const value = toPercentMastery(mastery)
  if (value >= 90) return '已掌握'
  if (value >= 70) return '较熟悉'
  if (value >= 50) return '学习中'
  if (value >= 30) return '初接触'
  if (value > 0) return '待巩固'
  return '未学习'
}

/** 仅前置关系是有向的；其余关系按无向处理 */
const PREREQUISITE_TYPES = ['PREREQUISITE', 'prerequisite', 'prerequisite_of', 'BELONGS_TO_PATH'];
const DIRECTED_TYPES = [...PREREQUISITE_TYPES, 'SUGGESTS', 'suggests']

function isDirected(edge: GraphEdge): boolean {
  return DIRECTED_TYPES.includes(edge.type)
}

export interface AdjacencyOptions {
  /** 是否把有向边当无向（仅用于纯连通性展示，不用于学习路径） */
  undirectAll?: boolean
}

/**
 * 构建邻接表。
 *
 * 旧实现无条件把每条边双向化，于是 `PREREQUISITE`（前置依赖）也变成无向，
 * 从"定积分"到"极限"能沿**反向**前置边走出路径，得出"先学定积分再学极限"的
 * 错误学习建议。现在按关系类型决定方向：前置关系只允许 target → source
 * （先修在前），其余关系可双向。
 */
export function buildAdjacency(
  edges: GraphEdge[],
  options: AdjacencyOptions = {},
): Record<string, string[]> {
  const adj: Record<string, string[]> = {}
  const ensure = (id: string) => {
    if (!adj[id]) adj[id] = []
  }

  for (const edge of edges) {
    ensure(edge.source)
    ensure(edge.target)
    if (options.undirectAll || !isDirected(edge)) {
      adj[edge.source].push(edge.target)
      adj[edge.target].push(edge.source)
    } else {
      // 前置关系：source 是 target 的前置知识 → 学习顺序 target → source
      adj[edge.target].push(edge.source)
    }
  }
  return adj
}

/**
 * 最短路径（按边数，BFS + 索引指针）。
 *
 * 修复：
 *  - 旧实现 `queue.shift()` 是 O(n)，在大图上退化为 O(n²)；
 *  - 旧实现找不到路径时返回 `[]`，与"起点即终点"无法区分。现在无路径返回 `null`。
 */
export function findShortestPath(
  edges: GraphEdge[],
  startId: string,
  endId: string,
  options: AdjacencyOptions = {},
): string[] | null {
  if (!startId || !endId) return null
  if (startId === endId) return [startId]

  const adj = buildAdjacency(edges, options)
  const visited = new Set<string>([startId])
  const queue: { id: string; path: string[] }[] = [{ id: startId, path: [startId] }]
  let head = 0

  while (head < queue.length) {
    const { id, path } = queue[head++]
    for (const neighbor of adj[id] || []) {
      if (visited.has(neighbor)) continue
      const nextPath = [...path, neighbor]
      if (neighbor === endId) return nextPath
      visited.add(neighbor)
      queue.push({ id: neighbor, path: nextPath })
    }
  }
  return null
}

// ================= 学习路径（前置闭包 + 拓扑排序 + 加权推荐） =================

export interface LearningPathOptions {
  masteryOf?: (nodeId: string) => number
  difficultyOf?: (nodeId: string) => number
  /** 掌握度低于该值视为"未掌握" */
  masteryThreshold?: number
}

export interface LearningPathStep {
  id: string
  /** 在推荐序列中的位置（1 起） */
  order: number
  mastered: boolean
  /** 未满足的前置数量 */
  unmetPrerequisites: number
  /** 推荐优先级分数，越高越该先学 */
  priority: number
}

export interface LearningPath {
  /** 是否找到了可达路径 */
  found: boolean
  /** 按学习顺序排列的节点（含未掌握的前置） */
  steps: LearningPathStep[]
  /** 目标的前置闭包中尚未掌握的节点 */
  gaps: string[]
  reason?: string
}

/**
 * 生成"到目标知识点为止"的学习路径：
 *  1. 计算目标的**前置闭包**（沿 PREREQUISITE 反向收集所有前置）；
 *  2. 按拓扑序排列（先修在前），保证不会出现"先学结果再学前提"；
 *  3. 在拓扑序内，优先推荐"掌握度低但前置已满足"的节点。
 *
 * 这比无权最短路更符合教学逻辑：最短路可能只给出一个跳板，而学习路径必须补齐所有前置。
 */
export function findLearningPath(
  edges: GraphEdge[],
  targetId: string,
  options: LearningPathOptions = {},
): LearningPath {
  const masteryThreshold = options.masteryThreshold ?? 60
  const masteryOf = options.masteryOf ?? (() => 0)
  const difficultyOf = options.difficultyOf ?? (() => 0)

  const prerequisites: Record<string, string[]> = {}
  const ensure = (id: string) => {
    if (!prerequisites[id]) prerequisites[id] = []
  }
  for (const edge of edges) {
    if (!PREREQUISITE_TYPES.includes(edge.type)) continue
    ensure(edge.target)
    ensure(edge.source)
    prerequisites[edge.target].push(edge.source)
  }

  if (!prerequisites[targetId]) {
    return { found: false, steps: [], gaps: [], reason: '目标知识点不存在或没有前置关系数据' }
  }

  // 1. 前置闭包（DFS，带环保护）
  const closure = new Set<string>()
  const stack = [...(prerequisites[targetId] || [])]
  while (stack.length) {
    const id = stack.pop() as string
    if (closure.has(id)) continue
    closure.add(id)
    for (const pre of prerequisites[id] || []) {
      if (!closure.has(pre)) stack.push(pre)
    }
  }

  // 2. Kahn 拓扑排序（保证先修在前）
  const inDegree = new Map<string, number>()
  const ids = [...closure]
  for (const id of ids) {
    const parents = (prerequisites[id] || []).filter((p) => closure.has(p))
    inDegree.set(id, parents.length)
  }
  const ready = ids.filter((id) => (inDegree.get(id) || 0) === 0)
  const ordered: string[] = []
  while (ready.length) {
    // 前置已满足者中，优先推"掌握度低 + 难度低"的
    ready.sort((a, b) => masteryOf(a) - masteryOf(b) || difficultyOf(a) - difficultyOf(b))
    const id = ready.shift() as string
    ordered.push(id)
    for (const child of ids) {
      if (!(prerequisites[child] || []).includes(id)) continue
      const next = (inDegree.get(child) || 0) - 1
      inDegree.set(child, next)
      if (next === 0) ready.push(child)
    }
  }

  // 存在环时，把剩余节点按掌握度排入，避免静默丢节点
  const remaining = ids.filter((id) => !ordered.includes(id))
  remaining.sort((a, b) => masteryOf(a) - masteryOf(b))
  ordered.push(...remaining)

  const gaps = ordered.filter((id) => masteryOf(id) < masteryThreshold)
  const steps: LearningPathStep[] = ordered.map((id, index) => {
    const unmet = (prerequisites[id] || []).filter(
      (p) => closure.has(p) && masteryOf(p) < masteryThreshold,
    ).length
    const mastery = masteryOf(id)
    return {
      id,
      order: index + 1,
      mastered: mastery >= masteryThreshold,
      unmetPrerequisites: unmet,
      // 掌握度越低、前置越少、难度越低 → 越该先学
      priority: Math.round((100 - mastery) - unmet * 10 - difficultyOf(id) * 5),
    }
  })

  return {
    found: true,
    steps,
    gaps,
    reason: gaps.length === 0 ? '所有前置知识均已掌握，可直接学习目标知识点' : undefined,
  }
}

/** 前置闭包（供 UI 高亮"还需先学哪些"） */
export function collectPrerequisites(edges: GraphEdge[], targetId: string): string[] {
  const prerequisites: Record<string, string[]> = {}
  for (const edge of edges) {
    if (!PREREQUISITE_TYPES.includes(edge.type)) continue
    ;(prerequisites[edge.target] ||= []).push(edge.source)
  }
  const closure = new Set<string>()
  const stack = [...(prerequisites[targetId] || [])]
  while (stack.length) {
    const id = stack.pop() as string
    if (closure.has(id)) continue
    closure.add(id)
    for (const pre of prerequisites[id] || []) stack.push(pre)
  }
  return [...closure]
}

export const AREA_MAP: Record<string, { label: string; color: string; nodeIds: string[] }> = {
  limit: { label: '极限', color: '#6366f1', nodeIds: ['limit_definition', 'limit_properties', 'limit_computation', 'infinity_limits', 'continuity', 'discontinuity', 'lhopital_rule'] },
  derivative: { label: '导数', color: '#f97316', nodeIds: ['derivative_definition', 'derivative_rules', 'chain_rule', 'product_rule', 'quotient_rule', 'implicit_differentiation', 'higher_derivatives', 'mean_value_theorem', 'extreme_values', 'concavity'] },
  integral: { label: '积分', color: '#22c55e', nodeIds: ['integral_definition', 'indefinite_integral', 'definite_integral', 'fundamental_theorem', 'substitution_method', 'integration_by_parts', 'partial_fractions', 'improper_integrals'] },
  series: { label: '级数', color: '#a855f7', nodeIds: ['taylor_series', 'power_series', 'convergence_tests'] },
  differential: { label: '微分方程', color: '#ef4444', nodeIds: ['differential_equations', 'separable_equations', 'linear_equations'] },
}
