import type { KnowledgeNode, KnowledgeRelation, DynamicGraphNode } from '../types';

export const MOCK_NODES: KnowledgeNode[] = [
  {
    id: 'limit_definition',
    name: '极限的定义',
    type: 'Concept',
    description: '极限是微积分的基础概念，描述函数在某一点附近的行为趋势。ε-δ定义给出了极限的严格数学表述。',
    formula: 'lim(x→a) f(x) = L',
    latex: '\\lim_{x \\to a} f(x) = L',
    difficulty: 'medium',
    tags: ['极限', '基础概念', 'ε-δ定义'],
    examples: ['lim(x→2) x² = 4', 'lim(x→0) sin(x)/x = 1'],
  },
  {
    id: 'limit_properties',
    name: '极限的性质',
    type: 'Theorem',
    description: '极限的四则运算性质、夹逼定理、单调有界定理等基本性质。',
    difficulty: 'medium',
    tags: ['极限', '性质', '运算'],
  },
  {
    id: 'limit_computation',
    name: '极限的计算',
    type: 'Method',
    description: '包括代入法、约分法、洛必达法则、等价无穷小替换等计算极限的方法。',
    difficulty: 'hard',
    tags: ['极限', '计算方法', '洛必达'],
  },
  {
    id: 'derivative_definition',
    name: '导数的定义',
    type: 'Concept',
    description: '导数是函数在某点的瞬时变化率，是极限的重要应用。几何意义为切线斜率。',
    formula: "f'(x) = lim(h→0) [f(x+h)-f(x)]/h",
    latex: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h)-f(x)}{h}",
    difficulty: 'medium',
    tags: ['导数', '定义', '变化率'],
  },
  {
    id: 'derivative_rules',
    name: '求导法则',
    type: 'Method',
    description: '包括基本求导公式、四则运算求导法则、链式法则等。',
    difficulty: 'medium',
    tags: ['导数', '法则', '链式法则'],
  },
  {
    id: 'integral_definition',
    name: '积分的定义',
    type: 'Concept',
    description: '定积分是黎曼和的极限，不定积分是导数的逆运算。',
    formula: '∫[a,b] f(x)dx = lim(n→∞) Σf(xi)Δx',
    latex: '\\int_a^b f(x)dx = \\lim_{n \\to \\infty} \\sum f(x_i)\\Delta x',
    difficulty: 'hard',
    tags: ['积分', '定义', '黎曼和'],
  },
  {
    id: 'integral_techniques',
    name: '积分技巧',
    type: 'Method',
    description: '换元积分法、分部积分法、有理函数积分等计算技巧。',
    difficulty: 'hard',
    tags: ['积分', '技巧', '换元'],
  },
  {
    id: 'series_convergence',
    name: '级数收敛',
    type: 'Concept',
    description: '级数的收敛性判别，包括比较判别法、比值判别法、根值判别法等。',
    difficulty: 'hard',
    tags: ['级数', '收敛', '判别法'],
  },
];

export const MOCK_EDGES: KnowledgeRelation[] = [
  { fromId: 'limit_definition', toId: 'limit_properties', type: 'PREREQUISITE', weight: 0.9, description: '理解极限定义是掌握性质的前提' },
  { fromId: 'limit_properties', toId: 'limit_computation', type: 'PREREQUISITE', weight: 0.85, description: '极限性质是计算的基础' },
  { fromId: 'limit_definition', toId: 'derivative_definition', type: 'PREREQUISITE', weight: 0.95, description: '导数由极限定义' },
  { fromId: 'derivative_definition', toId: 'derivative_rules', type: 'PREREQUISITE', weight: 0.9, description: '定义是法则的推导基础' },
  { fromId: 'limit_computation', toId: 'derivative_rules', type: 'RELATED_TO', weight: 0.6, description: '极限计算技巧在求导中也有应用' },
  { fromId: 'derivative_rules', toId: 'integral_definition', type: 'RELATED_TO', weight: 0.7, description: '积分是导数的逆运算' },
  { fromId: 'integral_definition', toId: 'integral_techniques', type: 'PREREQUISITE', weight: 0.85, description: '理解定义才能掌握技巧' },
  { fromId: 'limit_computation', toId: 'series_convergence', type: 'PREREQUISITE', weight: 0.8, description: '级数收敛依赖极限概念' },
  { fromId: 'series_convergence', toId: 'integral_techniques', type: 'RELATED_TO', weight: 0.5, description: '级数与积分有深层联系' },
];

export const MOCK_MASTERY: Record<string, number> = {
  limit_definition: 0.75,
  limit_properties: 0.6,
  limit_computation: 0.4,
  derivative_definition: 0.55,
  derivative_rules: 0.3,
  integral_definition: 0.2,
  integral_techniques: 0.1,
  series_convergence: 0.15,
};

export function getMasteryColor(mastery: number): string {
  if (mastery >= 0.8) return '#22c55e';
  if (mastery >= 0.6) return '#84cc16';
  if (mastery >= 0.4) return '#eab308';
  if (mastery >= 0.2) return '#f97316';
  return '#ef4444';
}

export function getMasteryLabel(mastery: number): string {
  if (mastery >= 0.8) return '已掌握';
  if (mastery >= 0.6) return '较熟悉';
  if (mastery >= 0.4) return '学习中';
  if (mastery >= 0.2) return '初接触';
  return '未学习';
}

export function toDynamicNodes(nodes: KnowledgeNode[], mastery: Record<string, number>): DynamicGraphNode[] {
  return nodes.map((n) => ({
    id: n.id,
    name: n.name,
    type: n.type,
    dynamicWeight: 1 - (mastery[n.id] ?? 0),
    relevanceScore: mastery[n.id] ? 1 - Math.abs(mastery[n.id] - 0.5) * 2 : 0.3,
    activationLevel: mastery[n.id] ?? 0,
    masteryLevel: mastery[n.id] ?? 0,
    tags: n.tags,
  }));
}
