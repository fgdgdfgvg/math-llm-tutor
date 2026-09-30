import { useState, useRef, useEffect, useCallback } from 'react';
import FormulaRenderer from '../components/FormulaRenderer';
import { useResponsive } from '../hooks/useResponsive';

// ========================= 第零部分：全局数据常量 =========================

interface AgentMessage {
  id: string;
  agentId: string;
  agentName: string;
  agentIcon: string;
  agentColor: string;
  type: 'thinking' | 'output' | 'handoff' | 'complete';
  content: string;
  formulas?: string[];
}

const AGENTS = [
  { id: 'agent-analyzer', name: '问题分析智能体', shortName: '分析Agent', icon: '🔍', color: '#6366f1', role: '问题分类与方程类型识别' },
  { id: 'agent-characteristic', name: '特征方程智能体', shortName: '特征Agent', icon: '⚙️', color: '#f59e0b', role: '特征方程构建与求解' },
  { id: 'agent-solver', name: '通解推导智能体', shortName: '求解Agent', icon: '🧮', color: '#10b981', role: '通解形式推导与验证' },
  { id: 'agent-presenter', name: '结果呈现智能体', shortName: '呈现Agent', icon: '📋', color: '#ec4899', role: '最终结果整理与呈现' },
] as const;

const HARDCODED_CONVERSATION: AgentMessage[] = [
  {
    id: 'msg-1', agentId: 'agent-analyzer', agentName: '问题分析智能体', agentIcon: '🔍', agentColor: '#6366f1',
    type: 'thinking', content: '正在接收用户输入，解析数学问题...', formulas: [],
  },
  {
    id: 'msg-2', agentId: 'agent-analyzer', agentName: '问题分析智能体', agentIcon: '🔍', agentColor: '#6366f1',
    type: 'output',
    content: '【问题分类结果】\n\n已识别方程为：二阶常系数齐次线性微分方程\n\n标准形式：y\'\' + p·y\' + q·y = 0\n\n提取参数：p = -3, q = 2\n\n方程类型特征：\n• 阶数：2阶（最高导数阶数为2）\n• 系数：常系数（p、q为常数）\n• 齐次性：齐次（右端为0）\n\n→ 将分析结果传递给特征方程智能体...',
    formulas: ["y'' - 3y' + 2y = 0", "y'' + p \\cdot y' + q \\cdot y = 0", "p = -3,\\quad q = 2"],
  },
  {
    id: 'msg-3', agentId: 'agent-analyzer', agentName: '问题分析智能体', agentIcon: '🔍', agentColor: '#6366f1',
    type: 'handoff', content: '🔄 已将问题分析结果移交至 "特征方程智能体"', formulas: [],
  },
  {
    id: 'msg-4', agentId: 'agent-characteristic', agentName: '特征方程智能体', agentIcon: '⚙️', agentColor: '#f59e0b',
    type: 'thinking', content: '正在接收分析数据，构建特征方程...', formulas: [],
  },
  {
    id: 'msg-5', agentId: 'agent-characteristic', agentName: '特征方程智能体', agentIcon: '⚙️', agentColor: '#f59e0b',
    type: 'output',
    content: '【特征方程构建】\n\n步骤1：设 y = e^{rx}，代入原方程\n• y\' = r·e^{rx}\n• y\'\' = r²·e^{rx}\n\n步骤2：代入 y\'\' - 3y\' + 2y = 0\n→ r²·e^{rx} - 3r·e^{rx} + 2·e^{rx} = 0\n→ e^{rx}(r² - 3r + 2) = 0\n\n步骤3：由于 e^{rx} ≠ 0，得特征方程：',
    formulas: ["y = e^{rx}", "y' = r \\cdot e^{rx}", "y'' = r^2 \\cdot e^{rx}", "r^2 - 3r + 2 = 0"],
  },
  {
    id: 'msg-6', agentId: 'agent-characteristic', agentName: '特征方程智能体', agentIcon: '⚙️', agentColor: '#f59e0b',
    type: 'output',
    content: '【特征根求解】\n\n求解特征方程：r² - 3r + 2 = 0\n\n因式分解：(r - 1)(r - 2) = 0\n\n得到两个不相等的实根：\n• r₁ = 1\n• r₂ = 2\n\n判别式 Δ = (-3)² - 4×1×2 = 9 - 8 = 1 > 0\n→ 两个不相等实根，适用通解形式：y = C₁·e^(r₁·x) + C₂·e^(r₂·x)\n\n→ 将特征根结果传递给通解推导智能体...',
    formulas: ["r^2 - 3r + 2 = 0", "(r - 1)(r - 2) = 0", "r_1 = 1,\\quad r_2 = 2", "\\Delta = (-3)^2 - 4 \\times 1 \\times 2 = 1 > 0"],
  },
  {
    id: 'msg-7', agentId: 'agent-characteristic', agentName: '特征方程智能体', agentIcon: '⚙️', agentColor: '#f59e0b',
    type: 'handoff', content: '🔄 已将特征根 r₁=1, r₂=2 移交至 "通解推导智能体"', formulas: [],
  },
  {
    id: 'msg-8', agentId: 'agent-solver', agentName: '通解推导智能体', agentIcon: '🧮', agentColor: '#10b981',
    type: 'thinking', content: '正在接收特征根数据，推导通解表达式...', formulas: [],
  },
  {
    id: 'msg-9', agentId: 'agent-solver', agentName: '通解推导智能体', agentIcon: '🧮', agentColor: '#10b981',
    type: 'output',
    content: '【通解推导】\n\n根据二阶常系数齐次线性微分方程理论：\n\n当特征方程有两个不相等的实根 r₁, r₂ 时，\n通解形式为：y = C₁·e^(r₁·x) + C₂·e^(r₂·x)\n\n代入 r₁ = 1, r₂ = 2：\n\ny = C₁·e^(1·x) + C₂·e^(2·x)',
    formulas: ["y = C_1 \\cdot e^{r_1 x} + C_2 \\cdot e^{r_2 x}", "y = C_1 \\cdot e^{x} + C_2 \\cdot e^{2x}"],
  },
  {
    id: 'msg-10', agentId: 'agent-solver', agentName: '通解推导智能体', agentIcon: '🧮', agentColor: '#10b981',
    type: 'output',
    content: '【验证推导结果】\n\n将 y = C₁·e^x + C₂·e^(2x) 代入原方程验证：\n\ny\' = C₁·e^x + 2C₂·e^(2x)\ny\'\' = C₁·e^x + 4C₂·e^(2x)\n\n代入 y\'\' - 3y\' + 2y：\n= (C₁·e^x + 4C₂·e^(2x)) - 3(C₁·e^x + 2C₂·e^(2x)) + 2(C₁·e^x + C₂·e^(2x))\n= C₁·e^x + 4C₂·e^(2x) - 3C₁·e^x - 6C₂·e^(2x) + 2C₁·e^x + 2C₂·e^(2x)\n= (C₁ - 3C₁ + 2C₁)·e^x + (4C₂ - 6C₂ + 2C₂)·e^(2x)\n= 0·e^x + 0·e^(2x)\n= 0 ✓\n\n验证通过！通解正确。\n\n→ 将完整结果传递给结果呈现智能体...',
    formulas: ["y = C_1 e^{x} + C_2 e^{2x}", "y' = C_1 e^{x} + 2C_2 e^{2x}", "y'' = C_1 e^{x} + 4C_2 e^{2x}", "y'' - 3y' + 2y = 0 \\quad \\checkmark"],
  },
  {
    id: 'msg-11', agentId: 'agent-solver', agentName: '通解推导智能体', agentIcon: '🧮', agentColor: '#10b981',
    type: 'handoff', content: '🔄 已将完整推导结果移交至 "结果呈现智能体"', formulas: [],
  },
  {
    id: 'msg-12', agentId: 'agent-presenter', agentName: '结果呈现智能体', agentIcon: '📋', agentColor: '#ec4899',
    type: 'thinking', content: '正在整理最终解题报告...', formulas: [],
  },
  {
    id: 'msg-13', agentId: 'agent-presenter', agentName: '结果呈现智能体', agentIcon: '📋', agentColor: '#ec4899',
    type: 'output',
    content: '═══════════════════════════════════\n      📐 最终解题报告\n═══════════════════════════════════\n\n📌 原题：求解 y\'\' - 3y\' + 2y = 0\n\n📌 方程类型：二阶常系数齐次线性微分方程\n\n📌 完整解题流程：\n\n  ① 建立特征方程：r² - 3r + 2 = 0\n  ② 因式分解：(r - 1)(r - 2) = 0\n  ③ 求解特征根：r₁ = 1, r₂ = 2\n  ④ 判别类型：两个不相等实根\n  ⑤ 写出通解：',
    formulas: ["r^2 - 3r + 2 = 0", "r_1 = 1,\\quad r_2 = 2", "y = C_1 e^{x} + C_2 e^{2x}"],
  },
  {
    id: 'msg-14', agentId: 'agent-presenter', agentName: '结果呈现智能体', agentIcon: '📋', agentColor: '#ec4899',
    type: 'complete',
    content: '✅ 求解完成！\n\n📚 涉及知识点：\n• 二阶常系数齐次线性微分方程标准形式\n• 特征方程的建立方法（欧拉待定系数法）\n• 一元二次方程的因式分解\n• 特征根类型判别（Δ > 0: 两不等实根）\n• 通解结构定理\n\n💡 举一反三提示：\n当特征根 r₁, r₂ 为复数 α±βi 时，\n通解形式为 y = e^(αx)[C₁·cos(βx) + C₂·sin(βx)]',
    formulas: ["y = C_1 e^{x} + C_2 e^{2x}", "y = e^{\\alpha x}[C_1 \\cos(\\beta x) + C_2 \\sin(\\beta x)]"],
  },
];

const SIMILARITY_PROBLEMS = [
  { id: 'sim-1', title: '两不等实根', latex: "y'' - 5y' + 6y = 0", hint: '特征方程 r²-5r+6=(r-2)(r-3)=0', answer: 'y = C_1 e^{2x} + C_2 e^{3x}' },
  { id: 'sim-2', title: '重根情况', latex: "y'' - 4y' + 4y = 0", hint: '特征方程 r²-4r+4=(r-2)²=0', answer: 'y = (C_1 + C_2 x) e^{2x}' },
  { id: 'sim-3', title: '共轭复根', latex: "y'' + 2y' + 5y = 0", hint: '特征方程 r²+2r+5=0, Δ=-16<0', answer: 'y = e^{-x}(C_1 \\cos 2x + C_2 \\sin 2x)' },
];

const KNOWLEDGE_NODES = [
  { id: 'ode_definition', name: '微分方程基本概念', type: 'Concept', mastery: 0.85, tags: ['ODE', '基础'], formula: "F(x, y, y', y'') = 0", description: '包含未知函数及其导数的方程，是描述自然现象的重要数学工具', area: '基础' },
  { id: 'ode_order', name: '微分方程的阶', type: 'Concept', mastery: 0.80, tags: ['ODE', '基础'], description: '方程中出现的最高阶导数的阶数，决定了通解中独立常数的个数', area: '基础' },
  { id: 'ode_linear', name: '线性与齐次', type: 'Concept', mastery: 0.70, tags: ['ODE', '分类'], formula: "y'' + p(x)y' + q(x)y = g(x)", description: '线性ODE中未知函数及其导数均为一次幂，g(x)=0时为齐次', area: '分类' },
  { id: 'separable_ode', name: '可分离变量方程', type: 'Method', mastery: 0.60, tags: ['ODE', '一阶'], formula: '\\frac{dy}{dx} = f(x)g(y)', description: '将含有x和y的项分别移到等号两侧，然后两边同时积分求解', area: '一阶ODE' },
  { id: 'char_eq_build', name: '特征方程构建', type: 'Method', mastery: 0.45, tags: ['ODE', '解法'], formula: 'r^2 + pr + q = 0', description: '对于常系数齐次线性ODE，设y=e^{rx}代入得到关于r的代数方程', area: '解法' },
  { id: 'char_root_solve', name: '特征根求解', type: 'Method', mastery: 0.40, tags: ['ODE', '解法'], formula: 'r = \\frac{-p \\pm \\sqrt{p^2 - 4q}}{2}', description: '使用一元二次方程求根公式，解得特征方程的根r₁和r₂', area: '解法' },
  { id: 'root_discriminant', name: '特征根判别', type: 'Theorem', mastery: 0.35, tags: ['ODE', '判别'], formula: '\\Delta = p^2 - 4q', description: '根据判别式Δ的符号确定通解形式：Δ>0两实根，Δ=0重根，Δ<0共轭复根', area: '解法' },
  { id: 'two_real_roots', name: '两不等实根通解', type: 'Formula', mastery: 0.30, tags: ['ODE', '通解'], formula: 'y = C_1 e^{r_1 x} + C_2 e^{r_2 x}', description: '当Δ>0时，通解为两个指数函数的线性组合', area: '通解' },
  { id: 'double_root', name: '重根通解', type: 'Formula', mastery: 0.25, tags: ['ODE', '通解'], formula: 'y = (C_1 + C_2 x) e^{r x}', description: '当Δ=0时，通解为指数函数乘以一次多项式', area: '通解' },
  { id: 'complex_roots', name: '共轭复根通解', type: 'Formula', mastery: 0.20, tags: ['ODE', '通解'], formula: 'y = e^{\\alpha x}(C_1 \\cos \\beta x + C_2 \\sin \\beta x)', description: '当Δ<0时，通解为指数衰减/增长与三角函数的乘积', area: '通解' },
  { id: 'ode_verification', name: '通解验证方法', type: 'Method', mastery: 0.20, tags: ['ODE', '验证'], description: '将求得的通解代回原方程，检查是否恒成立', area: '解法' },
  { id: 'initial_condition', name: '初值条件应用', type: 'Method', mastery: 0.15, tags: ['ODE', '应用'], description: '利用给定的初始条件确定通解中的任意常数，得到唯一的特解', area: '应用' },
];

const ERROR_ITEMS = [
  {
    id: 'err-001',
    problem: '求解二阶常系数齐次微分方程：y\'\' - 3y\' + 2y = 0',
    latex: "y'' - 3y' + 2y = 0",
    errorType: '概念混淆',
    errorAnalysis: '未能正确建立特征方程 r²-3r+2=0，混淆了特征根与通解系数的对应关系。将 y\'\' 误对应为 r 而非 r²，导致特征方程错误。',
    timestamp: '2025-06-09 14:32',
    steps: [
      { title: '步骤1：建立特征方程', formula: 'r^2 - 3r + 2 = 0' },
      { title: '步骤2：求解特征根', formula: '(r-1)(r-2)=0,\\ r_1=1,\\ r_2=2' },
      { title: '步骤3：判别根类型', formula: '\\Delta = 9-8=1>0,\\ \\text{两不等实根}' },
      { title: '步骤4：写出通解', formula: 'y = C_1 e^{x} + C_2 e^{2x}' },
    ],
    correctAnswer: 'y = C_1 e^{x} + C_2 e^{2x}',
    knowledgePoints: ['特征方程建立', '因式分解', '特征根判别', '通解结构'],
  },
  {
    id: 'err-002',
    problem: '求解：y\'\' - 4y\' + 4y = 0',
    latex: "y'' - 4y' + 4y = 0",
    errorType: '判别失误',
    errorAnalysis: '将重根情况（Δ=0）误判为两不等实根，直接套用 y=C₁e^(r₁x)+C₂e^(r₂x) 导致漏解。重根时通解应为 y=(C₁+C₂x)e^(rx)。',
    timestamp: '2025-06-08 10:15',
    steps: [
      { title: '步骤1：建立特征方程', formula: 'r^2 - 4r + 4 = 0' },
      { title: '步骤2：判别Δ', formula: '\\Delta = 16 - 16 = 0,\\ \\text{重根}' },
      { title: '步骤3：求特征根', formula: '(r-2)^2=0,\\ r=2\\ (\\text{二重根})' },
      { title: '步骤4：重根通解', formula: 'y = (C_1 + C_2 x) e^{2x}' },
    ],
    correctAnswer: 'y = (C_1 + C_2 x) e^{2x}',
    knowledgePoints: ['判别式Δ', '重根判定', '重根通解形式'],
  },
];

const SIMILAR_ERROR_PROBLEMS = [
  { id: 'sep-1', title: '两不等实根', latex: "y'' - 5y' + 6y = 0", difficulty: 'easy' as const, hint: '特征方程 r²-5r+6=(r-2)(r-3)=0，两不等实根', answer: 'y = C_1 e^{2x} + C_2 e^{3x}' },
  { id: 'sep-2', title: '重根情况', latex: "y'' - 4y' + 4y = 0", difficulty: 'medium' as const, hint: '特征方程 r²-4r+4=(r-2)²=0，注意重根时通解乘x', answer: 'y = (C_1 + C_2 x) e^{2x}' },
  { id: 'sep-3', title: '共轭复根', latex: "y'' + 2y' + 5y = 0", difficulty: 'hard' as const, hint: '特征方程 r²+2r+5=0，Δ=4-20=-16<0，r=-1±2i', answer: 'y = e^{-x}(C_1 \\cos 2x + C_2 \\sin 2x)' },
];

const DIFFICULTY_CONFIG = {
  easy: { label: '基础', color: '#22c55e', bg: '#22c55e20' },
  medium: { label: '进阶', color: '#f59e0b', bg: '#f59e0b20' },
  hard: { label: '挑战', color: '#ef4444', bg: '#ef444420' },
};

const PRACTICE_PROBLEMS = [
  { id: 'p1', title: '基础：两不等实根', latex: "y'' - 3y' + 2y = 0", difficulty: 'easy' as const, status: 'completed' as const, score: 100, steps: [{ title: '建立特征方程', formula: 'r^2 - 3r + 2 = 0' }, { title: '因式分解并求解', formula: '(r-1)(r-2)=0,\\ r_1=1,\\ r_2=2' }, { title: '写出通解', formula: 'y = C_1 e^{x} + C_2 e^{2x}' }], answer: 'y = C_1 e^{x} + C_2 e^{2x}' },
  { id: 'p2', title: '基础：两不等实根（二）', latex: "y'' - 5y' + 6y = 0", difficulty: 'easy' as const, status: 'completed' as const, score: 95, steps: [{ title: '建立特征方程', formula: 'r^2 - 5r + 6 = 0' }, { title: '因式分解', formula: '(r-2)(r-3)=0,\\ r_1=2,\\ r_2=3' }, { title: '写出通解', formula: 'y = C_1 e^{2x} + C_2 e^{3x}' }], answer: 'y = C_1 e^{2x} + C_2 e^{3x}' },
  { id: 'p3', title: '进阶：重根情形', latex: "y'' - 4y' + 4y = 0", difficulty: 'medium' as const, status: 'in_progress' as const, score: 60, hint: '注意 Δ=0 时的重根通解形式需要乘以 x', steps: [{ title: '建立特征方程', formula: 'r^2 - 4r + 4 = 0' }, { title: '判别重根', formula: '\\Delta = 16-16=0,\\ (r-2)^2=0' }, { title: '重根通解', formula: 'y = (C_1 + C_2 x) e^{2x}' }], answer: 'y = (C_1 + C_2 x) e^{2x}' },
  { id: 'p4', title: '进阶：共轭复根', latex: "y'' + 2y' + 5y = 0", difficulty: 'medium' as const, status: 'not_started' as const, score: 0, hint: '特征方程 r²+2r+5=0, Δ=4-20=-16, r=-1±2i', answer: 'y = e^{-x}(C_1 \\cos 2x + C_2 \\sin 2x)' },
  { id: 'p5', title: '挑战：参数讨论', latex: "y'' + ky' + y = 0", difficulty: 'hard' as const, status: 'not_started' as const, score: 0, hint: '需讨论 k²-4 的正负零三种情况', answer: '\\text{当 }|k|>2:\\ y=C_1 e^{r_1x}+C_2 e^{r_2x},\\ r=\\frac{-k\\pm\\sqrt{k^2-4}}{2}' },
  { id: 'p6', title: '进阶：二阶综合', latex: "y'' + y' - 2y = 0", difficulty: 'medium' as const, status: 'not_started' as const, score: 0, hint: '特征方程 r²+r-2=(r+2)(r-1)=0', answer: 'y = C_1 e^{-2x} + C_2 e^{x}' },
];

const TYPE_COLORS: Record<string, string> = { Concept: '#6366f1', Theorem: '#8b5cf6', Formula: '#a855f7', Method: '#ec4899' };
const TYPE_LABELS: Record<string, string> = { Concept: '概念', Theorem: '定理', Formula: '公式', Method: '方法' };

function getMasteryColor(m: number) { return m >= 0.8 ? '#22c55e' : m >= 0.6 ? '#f59e0b' : m >= 0.4 ? '#f97316' : '#ef4444'; }
function getMasteryLabel(m: number) { return m >= 0.8 ? '已掌握' : m >= 0.6 ? '学习中' : m >= 0.4 ? '初接触' : '未学习'; }

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  completed: { label: '已完成', color: '#34d399', icon: '✅' },
  in_progress: { label: '进行中', color: '#fbbf24', icon: '🔄' },
  not_started: { label: '未开始', color: '#64748b', icon: '⬜' },
};

interface PracticeProblem {
  id: string;
  title: string;
  latex: string;
  difficulty: 'easy' | 'medium' | 'hard';
  status: 'completed' | 'in_progress' | 'not_started';
  score: number;
  steps?: { title: string; formula: string }[];
  hint?: string;
  answer?: string;
}

// ========================= 主组件 =========================

export default function DemoModePage() {
  const { isMobile } = useResponsive();

  return (
    <div style={{
      background: '#0f172a',
      color: '#e2e8f0',
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    }}>
      {/* ====== 第一部分：系统标题 ====== */}
      <SectionOne isMobile={isMobile} />

      {/* ====== 第二部分：智能体求解交互流程 ====== */}
      <SectionTwo isMobile={isMobile} />

      {/* ====== 第三部分：知识图谱列表视图 ====== */}
      <SectionThree isMobile={isMobile} />

      {/* ====== 第四部分：错题本功能界面 ====== */}
      <SectionFour isMobile={isMobile} />

      {/* ====== 第五部分：专项练习功能界面 ====== */}
      <SectionFive isMobile={isMobile} />

      {/* 页脚 */}
      <SectionFooter isMobile={isMobile} />
    </div>
  );
}

// ========================= 第一部分：系统标题 =========================

function SectionOne({ isMobile }: { isMobile: boolean }) {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handler = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const opacity = Math.max(0, 1 - scrollY / 400);

  return (
    <section style={{
      position: 'relative',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #1e293b 100%)',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        top: '15%',
        left: '10%',
        width: 300,
        height: 300,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
        filter: 'blur(40px)',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '10%',
        right: '5%',
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)',
        filter: 'blur(50px)',
      }} />
      <div style={{
        position: 'absolute',
        top: '40%',
        right: '20%',
        width: 200,
        height: 200,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)',
        filter: 'blur(30px)',
      }} />

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 24px', opacity }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 16px',
          borderRadius: 20,
          background: 'rgba(99,102,241,0.12)',
          border: '1px solid rgba(99,102,241,0.25)',
          marginBottom: 24,
        }}>
          <span style={{ fontSize: 12, color: '#a5b4fc', fontWeight: 600 }}>
            📋 毕业设计演示模式
          </span>
        </div>

        <h1 style={{
          fontSize: isMobile ? 28 : 44,
          fontWeight: 800,
          lineHeight: 1.25,
          margin: '0 0 12px 0',
          background: 'linear-gradient(135deg, #a5b4fc 0%, #c084fc 30%, #f9a8d4 60%, #34d399 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          高等数学LLM自动求解<br />与错误诊断系统
        </h1>

        <p style={{
          fontSize: isMobile ? 16 : 22,
          color: '#94a3b8',
          margin: '0 0 8px 0',
          fontWeight: 400,
        }}>
          二阶常系数微分方程专项演示
        </p>

        <div style={{
          marginTop: 20,
          padding: '12px 24px',
          borderRadius: 12,
          background: 'rgba(30,41,59,0.7)',
          border: '1px solid rgba(51,65,85,0.5)',
          display: 'inline-block',
        }}>
          <FormulaRenderer formula="y'' - 3y' + 2y = 0" displayMode={false} style={{ margin: 0 }} />
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 32, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { icon: '🤖', label: '多智能体协作' },
            { icon: '🕸️', label: '知识图谱' },
            { icon: '📕', label: '错题诊断' },
            { icon: '📝', label: '专项练习' },
            { icon: '🔬', label: 'LaTeX渲染' },
          ].map((item) => (
            <span key={item.label} style={{
              padding: '8px 16px',
              borderRadius: 20,
              background: 'rgba(30,41,59,0.8)',
              border: '1px solid #334155',
              fontSize: 13,
              color: '#cbd5e1',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              {item.icon} {item.label}
            </span>
          ))}
        </div>

        <div style={{ marginTop: 48, color: '#475569', fontSize: 18 }}>
          ↓ 向下滚动浏览完整演示 ↓
        </div>
      </div>
    </section>
  );
}

// ========================= 第二部分：智能体求解交互流程 =========================

function SectionTwo({ isMobile }: { isMobile: boolean }) {
  const [visibleMessages, setVisibleMessages] = useState<AgentMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [showSimilarity, setShowSimilarity] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const hasStarted = useRef(false);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  const startSimulation = useCallback(() => {
    setIsRunning(true);
    setIsComplete(false);
    setVisibleMessages([]);
    setShowSimilarity(false);

    let index = 0;
    const revealNext = () => {
      if (index >= HARDCODED_CONVERSATION.length) {
        setIsRunning(false);
        setIsComplete(true);
        setActiveAgentId(null);
        setTimeout(() => setShowSimilarity(true), 500);
        return;
      }
      const msg = HARDCODED_CONVERSATION[index];
      setVisibleMessages((prev) => [...prev, msg]);
      setActiveAgentId(msg.agentId);
      scrollToBottom();
      index++;
      setTimeout(revealNext, 1200 + Math.random() * 400);
    };

    setTimeout(revealNext, 600);
  }, [scrollToBottom]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted.current) {
          hasStarted.current = true;
          startSimulation();
        }
      },
      { threshold: 0.15 },
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [startSimulation]);

  const completedCount = visibleMessages.filter((m) => m.type === 'output' || m.type === 'complete').length;
  const outputMsgCount = (id: string) => visibleMessages.filter((m) => m.agentId === id && (m.type === 'output' || m.type === 'complete')).length;

  return (
    <section ref={sectionRef} style={{
      padding: isMobile ? '40px 12px' : '60px 24px',
      background: '#0a0f1a',
    }}>
      <SectionHeader
        number="02"
        title="智能体求解交互流程"
        subtitle="4个专业智能体协作完成微分方程的自动求解，展示完整的推理链路与交互过程"
      />

      <div style={{
        display: 'flex',
        gap: isMobile ? 0 : 24,
        flexDirection: isMobile ? 'column' : 'row',
        maxWidth: 1200,
        margin: '32px auto 0',
      }}>
        {/* 对话区域 */}
        <div style={{
          flex: 1,
          background: '#0f172a',
          borderRadius: 16,
          border: '1px solid #1e293b',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: isMobile ? '60vh' : '70vh',
        }}>
          <div style={{
            padding: '14px 20px',
            background: '#1e293b',
            borderBottom: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>
                🤝 多智能体协作解题
              </div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                原题：<FormulaRenderer formula="y'' - 3y' + 2y = 0" displayMode={false} style={{ margin: 0 }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{
                fontSize: 10,
                padding: '3px 10px',
                borderRadius: 10,
                background: isRunning ? 'rgba(251,191,36,0.15)' : isComplete ? 'rgba(52,211,153,0.15)' : 'rgba(100,116,139,0.15)',
                color: isRunning ? '#fbbf24' : isComplete ? '#34d399' : '#64748b',
                fontWeight: 600,
              }}>
                {isRunning ? `协作中 (${completedCount}/${HARDCODED_CONVERSATION.length})` : isComplete ? '✅ 完成' : '准备就绪'}
              </span>
              <button onClick={() => { hasStarted.current = true; startSimulation(); }} style={{
                padding: '4px 12px',
                background: 'rgba(99,102,241,0.15)',
                border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: 6,
                color: '#a5b4fc',
                cursor: 'pointer',
                fontSize: 10,
              }}>
                重新演示
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visibleMessages.length === 0 && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🤖</div>
                  <div>滚动到此区域后，系统将自动开始演示</div>
                  <div style={{ fontSize: 10, marginTop: 4 }}>4个智能体协作完成微分方程求解</div>
                </div>
              </div>
            )}

            {visibleMessages.map((msg) => (
              <DemoMessageBubble key={msg.id} message={msg} />
            ))}

            {isRunning && activeAgentId && (
              <TypingIndicator agentId={activeAgentId} />
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 智能体状态面板 */}
        {!isMobile && (
          <div style={{
            width: 220,
            background: '#1e293b',
            borderRadius: 16,
            border: '1px solid #334155',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>
              🧠 智能体状态面板
            </div>
            {AGENTS.map((agent) => {
              const isActive = activeAgentId === agent.id;
              const count = outputMsgCount(agent.id);
              return (
                <div key={agent.id} style={{
                  padding: 10,
                  borderRadius: 10,
                  background: isActive ? `${agent.color}15` : '#0f172a',
                  border: `1px solid ${isActive ? agent.color + '40' : '#1e293b'}`,
                  transition: 'all 0.3s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 18 }}>{agent.icon}</span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: isActive ? agent.color : '#e2e8f0' }}>
                        {agent.shortName}
                      </div>
                      <div style={{ fontSize: 8, color: '#64748b' }}>{agent.role}</div>
                    </div>
                    {isActive && (
                      <div style={{
                        marginLeft: 'auto',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: agent.color,
                        animation: 'pulse 1s infinite',
                      }} />
                    )}
                    {count > 0 && !isActive && (
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: '#34d399' }}>✓</span>
                    )}
                  </div>
                  {count > 0 && (
                    <div style={{ fontSize: 9, color: '#64748b' }}>
                      已产出 {count} 条消息
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 举一反三 */}
      {showSimilarity && isComplete && (
        <div style={{
          maxWidth: 1200,
          margin: '20px auto 0',
        }}>
          <div style={{
            background: '#1e293b',
            borderRadius: 12,
            border: '1px solid #334155',
            padding: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 16 }}>💡</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>举一反三 · 拓展练习</span>
              <span style={{ fontSize: 10, color: '#64748b' }}>({SIMILARITY_PROBLEMS.length}道同类题)</span>
            </div>
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
              {SIMILARITY_PROBLEMS.map((p) => (
                <div key={p.id} style={{
                  minWidth: 220,
                  flex: 1,
                  padding: 12,
                  background: '#0f172a',
                  borderRadius: 10,
                  border: '1px solid #334155',
                }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>
                    {p.title}
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <FormulaRenderer formula={p.latex} displayMode={false} style={{ margin: 0 }} />
                  </div>
                  <div style={{ fontSize: 9, color: '#64748b', marginBottom: 4 }}>
                    💡 {p.hint}
                  </div>
                  <div style={{ fontSize: 10, color: '#34d399' }}>
                    通解：<FormulaRenderer formula={p.answer} displayMode={false} style={{ margin: 0 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.5); } }`}</style>
    </section>
  );
}

// ========================= 第三部分：知识图谱列表视图 =========================

function SectionThree({ isMobile }: { isMobile: boolean }) {
  const nodes = [...KNOWLEDGE_NODES].sort((a, b) => a.mastery - b.mastery);

  return (
    <section style={{
      padding: isMobile ? '40px 12px' : '60px 24px',
      background: '#0f172a',
    }}>
      <SectionHeader
        number="03"
        title="知识图谱列表视图"
        subtitle="微分方程 (ODE) 模块全部12个知识点，按掌握度升序排列——薄弱知识点排在最前，精准定位学习短板"
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: 14,
        maxWidth: 1200,
        margin: '32px auto 0',
      }}>
        {nodes.map((node) => {
          const masteryColor = getMasteryColor(node.mastery);
          const masteryLabel = getMasteryLabel(node.mastery);
          const typeColor = TYPE_COLORS[node.type] || '#6366f1';

          return (
            <div key={node.id} style={{
              background: '#1e293b',
              borderRadius: 12,
              border: '1px solid #334155',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  background: `${typeColor}22`,
                  color: typeColor,
                  border: `1px solid ${typeColor}44`,
                }}>
                  {TYPE_LABELS[node.type] || node.type}
                </span>
                {node.tags.map((tag, idx) => (
                  <span key={idx} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 9, background: '#334155', color: '#94a3b8' }}>
                    {tag}
                  </span>
                ))}
              </div>

              <div>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px 0' }}>
                  {node.name}
                </h4>
                <p style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
                  {node.description}
                </p>
              </div>

              {node.formula && (
                <div style={{
                  background: '#0f172a',
                  borderRadius: 6,
                  padding: '8px 12px',
                  border: '1px solid #334155',
                }}>
                  <FormulaRenderer formula={node.formula} displayMode={false} style={{ margin: 0 }} />
                </div>
              )}

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: masteryColor }}>
                    {masteryLabel}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
                    {(node.mastery * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={{ width: '100%', height: 6, borderRadius: 3, background: '#334155', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.round(node.mastery * 100)}%`,
                    height: '100%',
                    borderRadius: 3,
                    background: masteryColor,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ========================= 第四部分：错题本功能界面 =========================

function SectionFour({ isMobile }: { isMobile: boolean }) {
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set(['err-001']));
  const [revealedAnswers, setRevealedAnswers] = useState<Set<string>>(new Set());
  const [errorTab, setErrorTab] = useState<'errors' | 'similar'>('errors');

  const toggleError = (id: string) => {
    setExpandedErrors((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAnswer = (id: string) => {
    setRevealedAnswers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <section style={{
      padding: isMobile ? '40px 12px' : '60px 24px',
      background: '#0a0f1a',
    }}>
      <SectionHeader
        number="04"
        title="错题本功能界面"
        subtitle="展示错题映射与诊断功能——包含错题列表、错误分析、正确解答、举一反三拓展题"
      />

      <div style={{ maxWidth: 1200, margin: '32px auto 0' }}>
        {/* 统计卡片 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr 1fr' : 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 20,
        }}>
          {[
            { value: ERROR_ITEMS.length, label: '错题总数', color: '#e2e8f0' },
            { value: 0, label: '已掌握', color: '#22c55e' },
            { value: ERROR_ITEMS.length, label: '待复习', color: '#fbbf24' },
          ].map((stat) => (
            <div key={stat.label} style={{
              padding: '14px',
              background: '#1e293b',
              borderRadius: 10,
              border: '1px solid #334155',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* 标签切换 */}
        <div style={{
          display: 'flex',
          background: '#1e293b',
          borderRadius: 10,
          border: '1px solid #334155',
          marginBottom: 16,
          overflow: 'hidden',
        }}>
          {([
            { key: 'errors', label: '📋 错题列表', count: ERROR_ITEMS.length },
            { key: 'similar', label: '💡 举一反三', count: SIMILAR_ERROR_PROBLEMS.length },
          ] as const).map((tab) => (
            <button key={tab.key} onClick={() => setErrorTab(tab.key)} style={{
              flex: 1,
              padding: '12px 0',
              background: errorTab === tab.key ? '#0f172a' : 'transparent',
              border: 'none',
              color: errorTab === tab.key ? '#e2e8f0' : '#64748b',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}>
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* 错题列表 */}
        {errorTab === 'errors' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ERROR_ITEMS.map((item) => {
              const isExpanded = expandedErrors.has(item.id);
              return (
                <div key={item.id} style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 12,
                  overflow: 'hidden',
                }}>
                  <div onClick={() => toggleError(item.id)} style={{
                    padding: '14px 18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 10, color: '#64748b' }}>{item.id}</span>
                        <span style={{
                          fontSize: 10,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: '#ef444420',
                          color: '#ef4444',
                          fontWeight: 600,
                        }}>
                          {item.errorType}
                        </span>
                        <span style={{ fontSize: 10, color: '#475569' }}>{item.timestamp}</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>
                        <FormulaRenderer formula={item.latex} displayMode={false} style={{ margin: 0 }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 14, color: '#64748b', marginLeft: 8 }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>

                  {isExpanded && (
                    <div style={{ padding: '0 18px 18px', borderTop: '1px solid #334155' }}>
                      <div style={{
                        marginTop: 14,
                        padding: 12,
                        background: '#ef444410',
                        borderRadius: 8,
                        border: '1px solid #ef444420',
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#f87171', marginBottom: 6 }}>
                          ❌ 错误分析
                        </div>
                        <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.7 }}>
                          {item.errorAnalysis}
                        </div>
                      </div>

                      <div style={{
                        marginTop: 12,
                        padding: 12,
                        background: '#22c55e10',
                        borderRadius: 8,
                        border: '1px solid #22c55e20',
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#34d399', marginBottom: 10 }}>
                          ✅ 正确解答
                        </div>
                        {item.steps.map((step, idx) => (
                          <div key={idx} style={{
                            padding: '8px 12px',
                            background: idx % 2 === 0 ? '#0f172a' : 'transparent',
                            borderRadius: 6,
                            marginBottom: 4,
                          }}>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>
                              {step.title}
                            </div>
                            <FormulaRenderer formula={step.formula} displayMode={false} style={{ margin: 0 }} />
                          </div>
                        ))}
                        <div style={{
                          marginTop: 10,
                          padding: '10px 12px',
                          background: '#6366f110',
                          borderRadius: 6,
                          border: '1px solid #6366f120',
                        }}>
                          <span style={{ fontSize: 11, color: '#a5b4fc', fontWeight: 600 }}>通解：</span>
                          <FormulaRenderer formula={item.correctAnswer} displayMode={false} style={{ margin: 0 }} />
                        </div>
                      </div>

                      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {item.knowledgePoints.map((kp) => (
                          <span key={kp} style={{
                            fontSize: 10,
                            padding: '3px 10px',
                            borderRadius: 12,
                            background: '#334155',
                            color: '#94a3b8',
                          }}>{kp}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 举一反三 */}
        {errorTab === 'similar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
              基于错题自动生成的拓展练习，覆盖三种特征根类型（两不等实根、重根、共轭复根）
            </div>
            {SIMILAR_ERROR_PROBLEMS.map((p) => {
              const cfg = DIFFICULTY_CONFIG[p.difficulty];
              const revealed = revealedAnswers.has(p.id);
              return (
                <div key={p.id} style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 12,
                  padding: 18,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
                        {p.title}
                      </div>
                      <FormulaRenderer formula={p.latex} displayMode={false} style={{ margin: 0 }} />
                    </div>
                    <span style={{
                      fontSize: 10,
                      padding: '3px 10px',
                      borderRadius: 4,
                      background: cfg.bg,
                      color: cfg.color,
                      fontWeight: 600,
                    }}>
                      {cfg.label}
                    </span>
                  </div>

                  <div style={{
                    padding: 10,
                    background: '#fbbf2410',
                    borderRadius: 6,
                    border: '1px solid #fbbf2420',
                    marginBottom: 10,
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#fbbf24', marginBottom: 3 }}>
                      💡 解题提示
                    </div>
                    <div style={{ fontSize: 11, color: '#cbd5e1' }}>{p.hint}</div>
                  </div>

                  <button onClick={() => toggleAnswer(p.id)} style={{
                    width: '100%',
                    padding: '9px 0',
                    background: revealed ? '#6366f115' : 'transparent',
                    border: `1px solid ${revealed ? '#6366f130' : '#334155'}`,
                    borderRadius: 6,
                    color: revealed ? '#a5b4fc' : '#64748b',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}>
                    {revealed ? '隐藏解答 ▲' : '查看解答 ▼'}
                  </button>

                  {revealed && (
                    <div style={{
                      marginTop: 8,
                      padding: 12,
                      background: '#0f172a',
                      borderRadius: 6,
                      border: '1px solid #6366f120',
                    }}>
                      <span style={{ fontSize: 11, color: '#34d399', fontWeight: 600 }}>通解：</span>
                      <FormulaRenderer formula={p.answer} displayMode={false} style={{ margin: 0 }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// ========================= 第五部分：专项练习功能界面 =========================

function SectionFive({ isMobile }: { isMobile: boolean }) {
  const [selectedProblem, setSelectedProblem] = useState<PracticeProblem>(PRACTICE_PROBLEMS[0] as PracticeProblem);
  const [showAnswer, setShowAnswer] = useState(true);

  const completedCount = PRACTICE_PROBLEMS.filter((p) => p.status === 'completed').length;
  const completedScores = PRACTICE_PROBLEMS.filter((p) => p.status === 'completed');
  const avgScore = completedScores.length > 0
    ? Math.round(completedScores.reduce((s, p) => s + p.score, 0) / completedScores.length)
    : 0;

  const progressPercent = Math.round((completedCount / PRACTICE_PROBLEMS.length) * 100);

  return (
    <section style={{
      padding: isMobile ? '40px 12px' : '60px 24px',
      background: '#0f172a',
    }}>
      <SectionHeader
        number="05"
        title="专项练习功能界面"
        subtitle="微分方程专项练习——包含题目分类（特征方程法）、难度标识、练习进度与正确率统计"
      />

      <div style={{ maxWidth: 1200, margin: '32px auto 0', display: 'flex', gap: isMobile ? 0 : 24, flexDirection: isMobile ? 'column' : 'row' }}>
        {/* 左侧题目列表 + 统计 */}
        {!isMobile && (
          <div style={{ width: 260, flexShrink: 0 }}>
            {/* 统计卡片 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              marginBottom: 16,
            }}>
              {[
                { value: `${completedCount}/${PRACTICE_PROBLEMS.length}`, label: '完成进度', color: '#a5b4fc' },
                { value: `${avgScore}%`, label: '正确率', color: '#34d399' },
              ].map((s) => (
                <div key={s.label} style={{
                  padding: '12px',
                  background: '#1e293b',
                  borderRadius: 8,
                  border: '1px solid #334155',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: '#64748b' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* 进度条 */}
            <div style={{
              padding: 12,
              background: '#1e293b',
              borderRadius: 10,
              border: '1px solid #334155',
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8' }}>总体进度</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#a5b4fc' }}>{progressPercent}%</span>
              </div>
              <div style={{ width: '100%', height: 6, borderRadius: 3, background: '#334155', overflow: 'hidden' }}>
                <div style={{ width: `${progressPercent}%`, height: '100%', borderRadius: 3, background: '#6366f1' }} />
              </div>
            </div>

            {/* 题目列表 */}
            <div style={{
              background: '#1e293b',
              borderRadius: 12,
              border: '1px solid #334155',
              padding: 8,
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', padding: '6px 8px', marginBottom: 4 }}>
                题目列表（特征方程法）
              </div>
              {PRACTICE_PROBLEMS.map((p) => {
                const isSelected = selectedProblem.id === p.id;
                const diffCfg = DIFFICULTY_CONFIG[p.difficulty];
                const stCfg = STATUS_CONFIG[p.status];
                return (
                  <div key={p.id} onClick={() => { setSelectedProblem(p); setShowAnswer(p.status === 'completed'); }} style={{
                    padding: '10px 10px',
                    borderRadius: 8,
                    background: isSelected ? '#0f172a' : 'transparent',
                    border: isSelected ? '1px solid #6366f140' : '1px solid transparent',
                    cursor: 'pointer',
                    marginBottom: 4,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: isSelected ? '#e2e8f0' : '#cbd5e1' }}>
                        {p.title}
                      </span>
                      <span style={{ fontSize: 12 }}>{stCfg.icon}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: diffCfg.bg, color: diffCfg.color, fontWeight: 600 }}>
                        {diffCfg.label}
                      </span>
                      {p.status === 'completed' && (
                        <span style={{ fontSize: 9, color: '#34d399', fontWeight: 600 }}>{p.score}分</span>
                      )}
                    </div>
                    {p.status === 'completed' && (
                      <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: '#334155', overflow: 'hidden' }}>
                        <div style={{ width: `${p.score}%`, height: '100%', background: '#22c55e', borderRadius: 2 }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 右侧：选中题目详情 */}
        <div style={{ flex: 1 }}>
          {isMobile && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                {[
                  { value: `${completedCount}/${PRACTICE_PROBLEMS.length}`, label: '完成进度', color: '#a5b4fc' },
                  { value: `${avgScore}%`, label: '正确率', color: '#34d399' },
                ].map((s) => (
                  <div key={s.label} style={{
                    padding: '10px',
                    background: '#1e293b',
                    borderRadius: 8,
                    border: '1px solid #334155',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 9, color: '#64748b' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
                {PRACTICE_PROBLEMS.map((p) => (
                  <button key={p.id} onClick={() => { setSelectedProblem(p); setShowAnswer(p.status === 'completed'); }} style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: selectedProblem.id === p.id ? '1px solid #818cf8' : '1px solid #334155',
                    background: selectedProblem.id === p.id ? '#6366f120' : 'transparent',
                    color: selectedProblem.id === p.id ? '#a5b4fc' : '#94a3b8',
                    fontSize: 10, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {STATUS_CONFIG[p.status].icon} {p.title}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* 题目卡片 */}
          <div style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 12,
            padding: 22,
            marginBottom: 14,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{
                    fontSize: 10, padding: '3px 10px', borderRadius: 4,
                    background: DIFFICULTY_CONFIG[selectedProblem.difficulty].bg,
                    color: DIFFICULTY_CONFIG[selectedProblem.difficulty].color, fontWeight: 600,
                  }}>
                    {DIFFICULTY_CONFIG[selectedProblem.difficulty].label}
                  </span>
                  <span style={{
                    fontSize: 10, padding: '3px 10px', borderRadius: 4,
                    background: STATUS_CONFIG[selectedProblem.status].color + '20',
                    color: STATUS_CONFIG[selectedProblem.status].color, fontWeight: 600,
                  }}>
                    {STATUS_CONFIG[selectedProblem.status].icon} {STATUS_CONFIG[selectedProblem.status].label}
                  </span>
                  {selectedProblem.status === 'completed' && (
                    <span style={{ fontSize: 12, color: '#34d399', fontWeight: 600 }}>
                      {selectedProblem.score}分
                    </span>
                  )}
                </div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', margin: '0 0 6px 0' }}>
                  {selectedProblem.title}
                </h2>
                <FormulaRenderer formula={selectedProblem.latex} displayMode={false} style={{ margin: 0 }} />
              </div>
            </div>

            {selectedProblem.hint && selectedProblem.status !== 'completed' && (
              <div style={{
                marginTop: 12, padding: 10, background: '#fbbf2415',
                borderRadius: 8, border: '1px solid #fbbf2425',
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#fbbf24', marginBottom: 3 }}>💡 提示</div>
                <div style={{ fontSize: 11, color: '#cbd5e1' }}>{selectedProblem.hint}</div>
              </div>
            )}
          </div>

          {/* 解题步骤 */}
          {(showAnswer || selectedProblem.status === 'completed') && selectedProblem.steps && (
            <div style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 12,
              padding: 22,
              marginBottom: 14,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#34d399', marginBottom: 12 }}>
                ✅ 解题步骤
              </div>
              {selectedProblem.steps.map((step, idx) => (
                <div key={idx} style={{
                  padding: '10px 14px',
                  background: idx % 2 === 0 ? '#0f172a' : 'transparent',
                  borderRadius: 8,
                  marginBottom: 6,
                }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>
                    {step.title}
                  </div>
                  <FormulaRenderer formula={step.formula} displayMode={false} style={{ margin: 0 }} />
                </div>
              ))}
              {selectedProblem.answer && (
                <div style={{
                  marginTop: 10, padding: '10px 14px', background: '#6366f115',
                  borderRadius: 8, border: '1px solid #6366f125',
                }}>
                  <span style={{ fontSize: 11, color: '#a5b4fc', fontWeight: 600 }}>通解答案：</span>
                  <FormulaRenderer formula={selectedProblem.answer} displayMode={false} style={{ margin: 0 }} />
                </div>
              )}
            </div>
          )}

          {/* 知识点覆盖 */}
          {selectedProblem.status === 'completed' && (
            <div style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 12,
              padding: 18,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 10 }}>
                📊 知识点覆盖
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['特征方程建立', '一元二次方程求解', '特征根判别', '通解结构定理'].map((kp) => (
                  <span key={kp} style={{
                    fontSize: 10,
                    padding: '4px 12px',
                    borderRadius: 12,
                    background: selectedProblem.score >= 80 ? '#22c55e15' : '#334155',
                    color: selectedProblem.score >= 80 ? '#34d399' : '#94a3b8',
                    border: `1px solid ${selectedProblem.score >= 80 ? '#22c55e30' : '#475569'}`,
                  }}>
                    {selectedProblem.score >= 80 ? '✓ ' : ''}{kp}
                  </span>
                ))}
              </div>
            </div>
          )}

          {selectedProblem.status !== 'completed' && (
            <button onClick={() => setShowAnswer(!showAnswer)} style={{
              width: '100%',
              padding: '12px 0',
              background: showAnswer ? '#22c55e15' : '#6366f1',
              border: showAnswer ? '1px solid #22c55e30' : 'none',
              borderRadius: 10,
              color: showAnswer ? '#34d399' : '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}>
              {showAnswer ? '隐藏解答' : '显示解答与步骤'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// ========================= 页脚 =========================

function SectionFooter({ isMobile }: { isMobile: boolean }) {
  return (
    <footer style={{
      padding: isMobile ? '40px 20px' : '60px 40px',
      background: '#0a0f1a',
      textAlign: 'center',
      borderTop: '1px solid #1e293b',
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#818cf8', marginBottom: 8 }}>
        MathCognitive
      </div>
      <div style={{ fontSize: 12, color: '#475569', marginBottom: 16 }}>
        高等数学LLM自动求解与错误诊断系统 · 毕业设计演示
      </div>
      <div style={{ fontSize: 10, color: '#334155' }}>
        核心技术栈：React 18 + TypeScript + G6 + Plotly + KaTeX
      </div>
      <div style={{ fontSize: 10, color: '#334155', marginTop: 4 }}>
        核心题目：y\'\' - 3y\' + 2y = 0 → y = C₁e^x + C₂e^(2x)
      </div>
      <div style={{
        marginTop: 20,
        display: 'flex',
        gap: 4,
        justifyContent: 'center',
        fontSize: 20,
        color: '#334155',
      }}>
        🤖 🕸️ 📕 📝 🔬
      </div>
    </footer>
  );
}

// ========================= 共享子组件 =========================

function SectionHeader({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
      <div style={{
        display: 'inline-block',
        fontSize: 11,
        fontWeight: 700,
        color: '#6366f1',
        padding: '4px 12px',
        borderRadius: 6,
        background: 'rgba(99,102,241,0.1)',
        border: '1px solid rgba(99,102,241,0.2)',
        marginBottom: 12,
      }}>
        PART {number}
      </div>
      <h2 style={{
        fontSize: 24,
        fontWeight: 700,
        color: '#f1f5f9',
        margin: '0 0 8px 0',
      }}>
        {title}
      </h2>
      <p style={{
        fontSize: 13,
        color: '#64748b',
        margin: 0,
        lineHeight: 1.5,
      }}>
        {subtitle}
      </p>
    </div>
  );
}

function DemoMessageBubble({ message }: { message: AgentMessage }) {
  const agent = AGENTS.find((a) => a.id === message.agentId);
  const color = agent?.color || '#6366f1';

  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <div style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: color + '20',
        border: `2px solid ${color}40`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 15,
        flexShrink: 0,
        marginTop: 4,
      }}>
        {agent?.icon || '🤖'}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color }}>{message.agentName}</span>
          <span style={{
            fontSize: 9,
            padding: '2px 6px',
            borderRadius: 4,
            background: message.type === 'thinking' ? 'rgba(100,116,139,0.2)' :
              message.type === 'handoff' ? 'rgba(139,92,246,0.2)' :
              message.type === 'complete' ? 'rgba(52,211,153,0.2)' : 'rgba(99,102,241,0.2)',
            color: message.type === 'thinking' ? '#94a3b8' :
              message.type === 'handoff' ? '#a78bfa' :
              message.type === 'complete' ? '#34d399' : '#a5b4fc',
          }}>
            {message.type === 'thinking' ? '思考中...' :
              message.type === 'handoff' ? '移交' :
              message.type === 'complete' ? '完成' : '输出'}
          </span>
        </div>

        {(message.type === 'output' || message.type === 'complete') && (
          <div style={{
            background: '#1e293b',
            border: `1px solid ${color}20`,
            borderRadius: 10,
            padding: '12px 14px',
          }}>
            <div style={{
              fontSize: 12,
              color: '#cbd5e1',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6,
              wordBreak: 'break-word',
            }}>
              {message.content}
            </div>

            {message.formulas && message.formulas.length > 0 && (
              <div style={{
                marginTop: 8,
                padding: '8px 10px',
                background: '#0f172a',
                borderRadius: 6,
                border: '1px solid #1e293b',
              }}>
                {message.formulas.map((formula, idx) => (
                  <div key={idx} style={idx > 0 ? { marginTop: 2 } : {}}>
                    <FormulaRenderer formula={formula} displayMode={false} style={{ margin: 0 }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {message.type === 'thinking' && (
          <div style={{
            background: '#1e293b',
            border: `1px solid ${color}15`,
            borderRadius: 8,
            padding: '8px 14px',
          }}>
            <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
              💭 {message.content}
            </div>
          </div>
        )}

        {message.type === 'handoff' && (
          <div style={{
            background: 'rgba(139,92,246,0.08)',
            border: '1px solid rgba(139,92,246,0.2)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 11,
            color: '#a78bfa',
            textAlign: 'center',
          }}>
            {message.content}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator({ agentId }: { agentId: string }) {
  const agent = AGENTS.find((a) => a.id === agentId);
  return (
    <div style={{ display: 'flex', gap: 8, paddingLeft: 42 }}>
      <div style={{
        display: 'flex', gap: 4,
        padding: '6px 12px',
        background: '#1e293b',
        borderRadius: 8,
        border: `1px solid ${agent?.color || '#64748b'}20`,
      }}>
        <span style={{ fontSize: 10, color: '#64748b' }}>
          {agent?.icon} {agent?.name} 正在处理
        </span>
        <span style={{ color: agent?.color, fontSize: 13 }}>...</span>
      </div>
    </div>
  );
}