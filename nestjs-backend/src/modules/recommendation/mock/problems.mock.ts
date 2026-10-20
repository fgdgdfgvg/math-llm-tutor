export interface MockProblem {
  id: string;
  text: string;
  difficulty: 'easy' | 'medium' | 'hard';
  relatedConcepts: string[];
  estimatedTime: number;
}

export const mockProblems: MockProblem[] = [
  {
    id: 'prob-1',
    text: '求极限 lim(x→0) sin(x)/x',
    difficulty: 'easy',
    relatedConcepts: ['limit_definition', 'limit_properties'],
    estimatedTime: 10,
  },
  {
    id: 'prob-2',
    text: '计算导数 d/dx(x² + 2x + 1)',
    difficulty: 'easy',
    relatedConcepts: ['derivative_definition', 'derivative_rules'],
    estimatedTime: 10,
  },
  {
    id: 'prob-3',
    text: '求不定积分 ∫x²dx',
    difficulty: 'easy',
    relatedConcepts: ['indefinite_integral'],
    estimatedTime: 10,
  },
  {
    id: 'prob-4',
    text: '用洛必达法则求极限 lim(x→0) (e^x - 1)/x',
    difficulty: 'medium',
    relatedConcepts: ['lhopital_rule', 'limit_computation'],
    estimatedTime: 15,
  },
  {
    id: 'prob-5',
    text: '计算复合函数 f(g(x)) 的导数，其中 f(x) = sin(x), g(x) = x²',
    difficulty: 'medium',
    relatedConcepts: ['chain_rule', 'derivative_rules'],
    estimatedTime: 15,
  },
  {
    id: 'prob-6',
    text: '用分部积分法求 ∫x·e^xdx',
    difficulty: 'medium',
    relatedConcepts: ['integration_by_parts'],
    estimatedTime: 20,
  },
  {
    id: 'prob-7',
    text: '求定积分 ∫₀¹ x²dx',
    difficulty: 'medium',
    relatedConcepts: ['definite_integral', 'fundamental_theorem'],
    estimatedTime: 15,
  },
  {
    id: 'prob-8',
    text: '求函数 f(x) = x³ - 3x² + 2 的极值',
    difficulty: 'medium',
    relatedConcepts: ['extreme_values', 'derivative_applications'],
    estimatedTime: 20,
  },
  {
    id: 'prob-9',
    text: '用泰勒级数展开 e^x 到 x³ 项',
    difficulty: 'hard',
    relatedConcepts: ['taylor_series'],
    estimatedTime: 25,
  },
  {
    id: 'prob-10',
    text: '解微分方程 dy/dx = y',
    difficulty: 'hard',
    relatedConcepts: ['differential_equations', 'separable_equations'],
    estimatedTime: 25,
  },
];
