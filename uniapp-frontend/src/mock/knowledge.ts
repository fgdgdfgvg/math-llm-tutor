export interface KnowledgeNode {
  id: string;
  name: string;
  type: string;
  description: string;
  formula?: string;
  latex?: string;
  difficulty: string;
  tags: string[];
  x?: number;
  y?: number;
  mastery?: number; // 掌握度
  practiceCount?: number; // 练习次数
  correctRate?: number; // 正确率
  lastPractice?: string; // 最后练习时间
  accuracy?: number; // 兼容旧字段
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface LearningPath {
  name: string;
  description: string;
  icon: string;
  nodes: string[];
  isCustom?: boolean;
}

export interface LearningProgress {
  conceptId: string;
  mastery: number;
  practiceCount: number;
  correctRate: number;
  lastPracticeDate: string;
}

// 模拟节点数据
export const mockNodes: KnowledgeNode[] = [
  {
    id: 'function',
    name: '函数',
    type: 'Concept',
    description: '数学中重要的基础概念，表示两个集合之间的对应关系。函数将定义域中的每个元素唯一地映射到值域中的一个元素。',
    formula: 'y = f(x)',
    latex: 'y = f(x)',
    difficulty: 'easy',
    tags: ['基础', '函数'],
  },
  {
    id: 'limit',
    name: '极限',
    type: 'Concept',
    description: '微积分的基础概念，描述函数在某一点附近的行为。当自变量无限接近某一点时，函数值趋近于某个确定的常数。',
    formula: 'lim[x→a] f(x) = L',
    latex: '\\lim_{x \\to a} f(x) = L',
    difficulty: 'medium',
    tags: ['微积分', '极限'],
  },
  {
    id: 'derivative',
    name: '导数',
    type: 'Concept',
    description: '函数在某一点的变化率，表示函数在该点处的瞬时变化速度。几何上对应曲线在该点处切线的斜率。',
    formula: "f'(x) = lim[h→0] (f(x+h)-f(x))/h",
    latex: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}",
    difficulty: 'medium',
    tags: ['微积分', '导数'],
  },
  {
    id: 'integral',
    name: '积分',
    type: 'Concept',
    description: '导数的逆运算，用于计算面积、体积等。定积分通过黎曼和的极限来定义，表示曲线下的面积。',
    formula: '∫[a,b] f(x) dx = F(b) - F(a)',
    latex: '\\int_{a}^{b} f(x)\\,dx = F(b) - F(a)',
    difficulty: 'medium',
    tags: ['微积分', '积分'],
  },
  {
    id: 'differential_equation',
    name: '微分方程',
    type: 'Concept',
    description: '含有未知函数及其导数的方程，是描述自然现象中变化规律的重要数学工具。分为常微分方程和偏微分方程。',
    formula: 'dy/dx = f(x, y)',
    latex: '\\frac{dy}{dx} = f(x, y)',
    difficulty: 'hard',
    tags: ['微积分', '微分方程'],
  },
  {
    id: 'series',
    name: '级数',
    type: 'Concept',
    description: '无穷多个数的和。通过部分和序列的极限来定义级数的收敛性，是函数逼近理论的基础。',
    formula: 'Σ[n=1,∞] a_n',
    latex: '\\sum_{n=1}^{\\infty} a_n',
    difficulty: 'medium',
    tags: ['微积分', '级数'],
  },
  {
    id: 'power_series',
    name: '幂级数',
    type: 'Concept',
    description: '形如Σaₙxⁿ的级数，具有收敛半径。幂级数在其收敛区间内可逐项求导和积分，是函数展开的重要形式。',
    formula: 'Σ[n=0,∞] a_n x^n',
    latex: '\\sum_{n=0}^{\\infty} a_n x^n',
    difficulty: 'medium',
    tags: ['微积分', '级数'],
  },
  {
    id: 'taylor_series',
    name: '泰勒级数',
    type: 'Theorem',
    description: '用多项式逼近函数的重要工具。若函数在一点处无穷次可导，则可展开为泰勒级数，余项描述逼近误差。',
    formula: 'f(x) = Σ[n=0,∞] f^(n)(a)/n! · (x-a)^n',
    latex: 'f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!} (x-a)^n',
    difficulty: 'hard',
    tags: ['微积分', '级数', '定理'],
  },
  {
    id: 'multivariable_function',
    name: '多元函数',
    type: 'Concept',
    description: '具有多个自变量的函数，是单变量函数的自然推广。其定义域是多维空间中的点集，在物理和工程中有广泛应用。',
    formula: 'z = f(x, y)',
    latex: 'z = f(x, y)',
    difficulty: 'medium',
    tags: ['微积分', '多元'],
  },
  {
    id: 'partial_derivative',
    name: '偏导数',
    type: 'Concept',
    description: '多元函数对某一自变量的导数，将其他自变量视为常数。偏导数描述了函数沿坐标轴方向的变化率。',
    formula: '∂f/∂x = lim[Δx→0] (f(x+Δx,y)-f(x,y))/Δx',
    latex: '\\frac{\\partial f}{\\partial x} = \\lim_{\\Delta x \\to 0} \\frac{f(x+\\Delta x, y) - f(x, y)}{\\Delta x}',
    difficulty: 'medium',
    tags: ['微积分', '多元'],
  },
  {
    id: 'substitution_method',
    name: '换元积分法',
    type: 'Method',
    description: '通过变量代换简化积分计算的方法。令u=g(x)，将原积分转化为关于u的积分，是复合函数求导链式法则的逆应用。',
    formula: '∫ f(g(x))·g\'(x) dx = ∫ f(u) du',
    latex: '\\int f(g(x)) \\cdot g\'(x)\\,dx = \\int f(u)\\,du',
    difficulty: 'medium',
    tags: ['微积分', '积分', '方法'],
  },
  {
    id: 'integration_by_parts',
    name: '分部积分法',
    type: 'Method',
    description: '利用乘积法则求积分的方法。将被积函数拆分为u和dv两部分，通过公式转化为更容易计算的积分形式。',
    formula: '∫ u dv = uv - ∫ v du',
    latex: '\\int u\\,dv = uv - \\int v\\,du',
    difficulty: 'medium',
    tags: ['微积分', '积分', '方法'],
  },
  {
    id: 'separation_method',
    name: '分离变量法',
    type: 'Method',
    description: '求解常微分方程的基本方法。将方程中涉及不同变量的项分别移到等式两边，然后分别积分求解。',
    formula: 'dy/dx = g(x)·h(y) → ∫ dy/h(y) = ∫ g(x)dx',
    latex: '\\frac{dy}{dx} = g(x) \\cdot h(y) \\quad \\Rightarrow \\quad \\int \\frac{dy}{h(y)} = \\int g(x)\\,dx',
    difficulty: 'medium',
    tags: ['微积分', '微分方程', '方法'],
  },
  {
    id: 'total_differential',
    name: '全微分',
    type: 'Concept',
    description: '多元函数的微分概念，表示函数在所有自变量同时发生微小变化时的总变化量。是可微函数线性近似的核心概念。',
    formula: 'dz = (∂f/∂x)dx + (∂f/∂y)dy',
    latex: 'dz = \\frac{\\partial f}{\\partial x}dx + \\frac{\\partial f}{\\partial y}dy',
    difficulty: 'medium',
    tags: ['微积分', '多元'],
  },
];

// 模拟边数据
export const mockEdges: GraphEdge[] = [
  { source: 'function', target: 'limit', type: 'prerequisite' },
  { source: 'limit', target: 'derivative', type: 'prerequisite' },
  { source: 'derivative', target: 'integral', type: 'prerequisite' },
  { source: 'derivative', target: 'differential_equation', type: 'prerequisite' },
  { source: 'limit', target: 'series', type: 'prerequisite' },
  { source: 'series', target: 'power_series', type: 'prerequisite' },
  { source: 'power_series', target: 'taylor_series', type: 'prerequisite' },
  { source: 'function', target: 'multivariable_function', type: 'prerequisite' },
  { source: 'derivative', target: 'partial_derivative', type: 'prerequisite' },
  { source: 'multivariable_function', target: 'partial_derivative', type: 'prerequisite' },
  { source: 'integral', target: 'substitution_method', type: 'prerequisite' },
  { source: 'integral', target: 'integration_by_parts', type: 'prerequisite' },
  { source: 'differential_equation', target: 'separation_method', type: 'prerequisite' },
  { source: 'partial_derivative', target: 'total_differential', type: 'prerequisite' },
];

// 模拟学习路径
export const mockLearningPaths: LearningPath[] = [
  {
    name: '微积分基础路径',
    description: '展示从函数到极限、导数、积分的学习路径',
    icon: '📈',
    nodes: ['function', 'limit', 'derivative', 'integral'],
  },
  {
    name: '级数收敛分析',
    description: '数项级数、幂级数、泰勒级数的关系',
    icon: '📊',
    nodes: ['series', 'power_series', 'taylor_series'],
  },
  {
    name: '微分方程求解',
    description: '从导数到微分方程的完整知识链',
    icon: '🔢',
    nodes: ['derivative', 'differential_equation', 'separation_method'],
  },
  {
    name: '多元函数分析',
    description: '偏导数、全微分、极值问题',
    icon: '🎯',
    nodes: ['multivariable_function', 'partial_derivative', 'total_differential'],
  },
  {
    name: '积分技巧综合',
    description: '换元积分、分部积分、有理函数积分',
    icon: '🔧',
    nodes: ['integral', 'substitution_method', 'integration_by_parts'],
  },
];

// 生成模拟学习数据
export const generateMockLearningData = (nodes: KnowledgeNode[]): void => {
  nodes.forEach(node => {
    node.mastery = Math.floor(Math.random() * 100);
    node.practiceCount = Math.floor(Math.random() * 50);
    node.correctRate = Math.floor(Math.random() * 100);
    node.lastPractice = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toLocaleDateString();
  });
};

// 生成模拟进度数据
export const generateMockProgress = (nodes: KnowledgeNode[]): LearningProgress[] => {
  return nodes.map(node => ({
    conceptId: node.id,
    mastery: Math.floor(Math.random() * 100),
    practiceCount: Math.floor(Math.random() * 50),
    correctRate: Math.floor(Math.random() * 100),
    lastPracticeDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toLocaleDateString()
  }));
};
