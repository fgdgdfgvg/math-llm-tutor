import { useState } from 'react';
import FormulaRenderer from '../components/FormulaRenderer';
import { useResponsive } from '../hooks/useResponsive';

interface ErrorItem {
  id: string;
  problem: string;
  latex: string;
  errorType: string;
  errorAnalysis: string;
  timestamp: string;
  steps: { title: string; formula: string }[];
  correctAnswer: string;
  knowledgePoints: string[];
  category: string;
}

interface SimilarProblem {
  id: string;
  title: string;
  latex: string;
  difficulty: 'easy' | 'medium' | 'hard';
  hint: string;
  answer: string;
  category: string;
}

const CATEGORIES = [
  { key: 'limit_def', label: '极限定义' },
  { key: 'diff_eq', label: '微分方程' },
];

const ERROR_ITEMS: ErrorItem[] = [
  {
    id: 'limit-err-001',
    problem: '证明极限：lim(x→1) x² = 1',
    latex: '\\text{证明: } \\lim_{x \\to 1} x^2 = 1',
    errorType: '放缩不当',
    errorAnalysis: '在确定 δ 时，没有正确估计 |x+1| 的上界。错误地认为 |x+1| ≤ 2，实际上当 x 接近 1 时，|x+1| 可以接近 2，但需要限制 x 的范围才能得到准确的上界。正确做法是先限制 |x-1|<1，此时 0<x<2，所以 |x+1|<3。',
    timestamp: '2025-06-09 16:45',
    category: 'limit_def',
    steps: [
      { title: '步骤1：分析目标', formula: '|f(x) - L| = |x^2 - 1| = |x+1||x-1|' },
      { title: '步骤2：限制 x 的范围', formula: '\\text{设 } |x-1| < 1, \\text{ 则 } 0 < x < 2, \\text{ 所以 } |x+1| < 3' },
      { title: '步骤3：确定 δ', formula: '\\delta = \\min\\{1, \\frac{\\varepsilon}{3}\\}' },
      { title: '步骤4：验证', formula: '|x^2-1| = |x+1||x-1| < 3 \\cdot \\frac{\\varepsilon}{3} = \\varepsilon' },
    ],
    correctAnswer: '\\delta = \\min\\{1, \\frac{\\varepsilon}{3}\\}',
    knowledgePoints: ['ε-δ定义', '放缩技巧', 'δ的确定', '不等式估计'],
  },
  {
    id: 'limit-err-002',
    problem: '判断极限是否存在：lim(x→2) (x²-4)/(x-2)',
    latex: '\\lim_{x \\to 2} \\frac{x^2-4}{x-2}',
    errorType: '概念混淆',
    errorAnalysis: '错误地认为函数在 x=2 处无定义，所以极限不存在。实际上，极限存在与否与函数在该点是否有定义无关。极限关注的是 x 趋近于 2（但不等于 2）时函数值的行为。正确做法是约分化简后求极限。',
    timestamp: '2025-06-08 11:20',
    category: 'limit_def',
    steps: [
      { title: '步骤1：化简函数', formula: 'f(x) = \\frac{x^2-4}{x-2} = \\frac{(x-2)(x+2)}{x-2} = x+2 \\text{ (} x \\neq 2\\text{)}' },
      { title: '步骤2：分析目标', formula: '|f(x) - 4| = |x + 2 - 4| = |x - 2|' },
      { title: '步骤3：确定 δ', formula: '\\delta = \\varepsilon' },
      { title: '步骤4：验证', formula: '\\text{当 } 0 < |x-2| < \\delta \\text{ 时, } |x+2-4| = |x-2| < \\varepsilon' },
    ],
    correctAnswer: '\\lim_{x \\to 2} \\frac{x^2-4}{x-2} = 4',
    knowledgePoints: ['极限定义', '函数定义与极限', '分式化简', 'ε-δ证明'],
  },
  {
    id: 'err-001',
    problem: '求解二阶常系数齐次微分方程：y\'\' - 3y\' + 2y = 0',
    latex: "y'' - 3y' + 2y = 0",
    errorType: '概念混淆',
    errorAnalysis: '未能正确建立特征方程 r²-3r+2=0，混淆了特征根与通解系数的对应关系。将 y\'\' 误对应为 r 而非 r²，导致特征方程错误。',
    timestamp: '2025-06-09 14:32',
    category: 'diff_eq',
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
    category: 'diff_eq',
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

const SIMILAR_PROBLEMS: SimilarProblem[] = [
  {
    id: 'limit-sim-1',
    title: '一次函数极限',
    latex: '\\text{证明: } \\lim_{x \\to 3} (2x + 1) = 7',
    difficulty: 'easy',
    category: 'limit_def',
    hint: '将 |f(x)-L| 表达为 |x-a| 的函数，直接确定 δ',
    answer: '\\delta = \\frac{\\varepsilon}{2}',
  },
  {
    id: 'limit-sim-2',
    title: '三次函数极限',
    latex: '\\text{证明: } \\lim_{x \\to 2} x^3 = 8',
    difficulty: 'medium',
    category: 'limit_def',
    hint: '利用因式分解 x³-8=(x-2)(x²+2x+4)，限制 x 的范围估计上界',
    answer: '\\delta = \\min\\{1, \\frac{\\varepsilon}{19}\\}',
  },
  {
    id: 'limit-sim-3',
    title: '分式极限（可去间断点）',
    latex: '\\text{证明: } \\lim_{x \\to 3} \\frac{x^2-9}{x-3} = 6',
    difficulty: 'medium',
    category: 'limit_def',
    hint: '先约分化简，再进行 ε-δ 证明',
    answer: '\\delta = \\varepsilon',
  },
  {
    id: 'sim-1',
    title: '两不等实根',
    latex: "y'' - 5y' + 6y = 0",
    difficulty: 'easy',
    category: 'diff_eq',
    hint: '特征方程 r²-5r+6=(r-2)(r-3)=0，两不等实根',
    answer: 'y = C_1 e^{2x} + C_2 e^{3x}',
  },
  {
    id: 'sim-2',
    title: '重根情况',
    latex: "y'' - 4y' + 4y = 0",
    difficulty: 'medium',
    category: 'diff_eq',
    hint: '特征方程 r²-4r+4=(r-2)²=0，注意重根时的通解形式需乘x',
    answer: 'y = (C_1 + C_2 x) e^{2x}',
  },
  {
    id: 'sim-3',
    title: '共轭复根',
    latex: "y'' + 2y' + 5y = 0",
    difficulty: 'hard',
    category: 'diff_eq',
    hint: '特征方程 r²+2r+5=0，Δ=4-20=-16<0，r=-1±2i',
    answer: 'y = e^{-x}(C_1 \\cos 2x + C_2 \\sin 2x)',
  },
];

const DIFFICULTY_CONFIG = {
  easy: { label: '基础', color: '#22c55e', bg: '#22c55e20' },
  medium: { label: '进阶', color: '#f59e0b', bg: '#f59e0b20' },
  hard: { label: '挑战', color: '#ef4444', bg: '#ef444420' },
} as const;

export default function ErrorBookPage() {
  const { isMobile } = useResponsive();
  const [selectedCategory, setSelectedCategory] = useState('limit_def');
  const [activeTab, setActiveTab] = useState<'errors' | 'similar'>('errors');
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set(['limit-err-001']));
  const [revealedAnswers, setRevealedAnswers] = useState<Set<string>>(new Set());

  const filteredErrors = ERROR_ITEMS.filter((e) => selectedCategory === 'all' || e.category === selectedCategory);
  const filteredSimilar = SIMILAR_PROBLEMS.filter((p) => selectedCategory === 'all' || p.category === selectedCategory);

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

  const masteredCount = 0;
  const reviewCount = filteredErrors.length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0f172a', overflow: 'hidden' }}>
      <div style={{
        padding: isMobile ? '10px 14px' : '14px 24px',
        background: '#1e293b',
        borderBottom: '1px solid #334155',
      }}>
        <div style={{ fontSize: isMobile ? 15 : 17, fontWeight: 700, color: '#e2e8f0' }}>
          📕 错题本
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
          错题本 &gt; {CATEGORIES.find(c => c.key === selectedCategory)?.label || '全部'}
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: 12,
        padding: isMobile ? '8px 12px' : '10px 24px',
        background: '#1e293b',
        borderBottom: '1px solid #334155',
      }}>
        <div style={{
          flex: 1,
          padding: '8px 14px',
          background: '#0f172a',
          borderRadius: 8,
          border: '1px solid #334155',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>{filteredErrors.length}</div>
          <div style={{ fontSize: 10, color: '#64748b' }}>错题总数</div>
        </div>
        <div style={{
          flex: 1,
          padding: '8px 14px',
          background: '#0f172a',
          borderRadius: 8,
          border: '1px solid #334155',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>{masteredCount}</div>
          <div style={{ fontSize: 10, color: '#64748b' }}>已掌握</div>
        </div>
        <div style={{
          flex: 1,
          padding: '8px 14px',
          background: '#0f172a',
          borderRadius: 8,
          border: '1px solid #334155',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fbbf24' }}>{reviewCount}</div>
          <div style={{ fontSize: 10, color: '#64748b' }}>待复习</div>
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: 4,
        padding: '8px 16px',
        background: '#1e293b',
        borderBottom: '1px solid #334155',
        overflowX: 'auto',
      }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setSelectedCategory(cat.key)}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: selectedCategory === cat.key ? '1px solid #818cf8' : '1px solid #334155',
              background: selectedCategory === cat.key ? '#6366f120' : 'transparent',
              color: selectedCategory === cat.key ? '#a5b4fc' : '#94a3b8',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div style={{
        display: 'flex',
        borderBottom: '1px solid #334155',
        background: '#1e293b',
      }}>
        {([
          { key: 'errors', label: '📋 错题列表', count: filteredErrors.length },
          { key: 'similar', label: '💡 举一反三', count: filteredSimilar.length },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: '10px 0',
              background: activeTab === tab.key ? '#0f172a' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #818cf8' : '2px solid transparent',
              color: activeTab === tab.key ? '#e2e8f0' : '#64748b',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? 12 : 20 }}>
        {activeTab === 'errors' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredErrors.map((item) => {
              const isExpanded = expandedErrors.has(item.id);
              return (
                <div
                  key={item.id}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 10,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    onClick={() => toggleError(item.id)}
                    style={{
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
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
                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid #334155' }}>
                      <div style={{
                        marginTop: 12,
                        padding: 10,
                        background: '#ef444410',
                        borderRadius: 8,
                        border: '1px solid #ef444420',
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#f87171', marginBottom: 4 }}>
                          ❌ 错误分析
                        </div>
                        <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.6 }}>
                          {item.errorAnalysis}
                        </div>
                      </div>

                      <div style={{
                        marginTop: 12,
                        padding: 10,
                        background: '#22c55e10',
                        borderRadius: 8,
                        border: '1px solid #22c55e20',
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#34d399', marginBottom: 8 }}>
                          ✅ 正确解答
                        </div>
                        {item.steps.map((step, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: '8px 10px',
                              background: idx % 2 === 0 ? '#0f172a' : 'transparent',
                              borderRadius: 6,
                              marginBottom: 4,
                            }}
                          >
                            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                              {step.title}
                            </div>
                            <FormulaRenderer formula={step.formula} displayMode={false} style={{ margin: 0 }} />
                          </div>
                        ))}
                        <div style={{
                          marginTop: 8,
                          padding: '8px 10px',
                          background: '#6366f110',
                          borderRadius: 6,
                          border: '1px solid #6366f120',
                        }}>
                          <span style={{ fontSize: 11, color: '#a5b4fc', fontWeight: 600 }}>答案：</span>
                          <FormulaRenderer formula={item.correctAnswer} displayMode={false} style={{ margin: 0 }} />
                        </div>
                      </div>

                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {item.knowledgePoints.map((kp) => (
                          <span
                            key={kp}
                            style={{
                              fontSize: 10,
                              padding: '2px 8px',
                              borderRadius: 12,
                              background: '#334155',
                              color: '#94a3b8',
                            }}
                          >
                            {kp}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
              基于错题自动生成的拓展练习，帮助巩固相关知识点
            </div>
            {filteredSimilar.map((p) => {
              const cfg = DIFFICULTY_CONFIG[p.difficulty];
              const revealed = revealedAnswers.has(p.id);
              return (
                <div
                  key={p.id}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 10,
                    padding: 16,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
                        {p.title}
                      </div>
                      <FormulaRenderer formula={p.latex} displayMode={false} style={{ margin: 0 }} />
                    </div>
                    <span style={{
                      fontSize: 10,
                      padding: '3px 8px',
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
                    marginBottom: 8,
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#fbbf24', marginBottom: 2 }}>
                      💡 解题提示
                    </div>
                    <div style={{ fontSize: 11, color: '#cbd5e1' }}>{p.hint}</div>
                  </div>

                  <button
                    onClick={() => toggleAnswer(p.id)}
                    style={{
                      width: '100%',
                      padding: '8px 0',
                      background: revealed ? '#6366f115' : 'transparent',
                      border: `1px solid ${revealed ? '#6366f130' : '#334155'}`,
                      borderRadius: 6,
                      color: revealed ? '#a5b4fc' : '#64748b',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {revealed ? '隐藏解答 ▲' : '查看解答 ▼'}
                  </button>

                  {revealed && (
                    <div style={{
                      marginTop: 8,
                      padding: 10,
                      background: '#0f172a',
                      borderRadius: 6,
                      border: '1px solid #6366f120',
                    }}>
                      <span style={{ fontSize: 11, color: '#34d399', fontWeight: 600 }}>答案：</span>
                      <FormulaRenderer formula={p.answer} displayMode={false} style={{ margin: 0 }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
