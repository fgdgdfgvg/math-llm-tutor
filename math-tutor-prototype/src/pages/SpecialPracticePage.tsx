import { useState } from 'react';
import FormulaRenderer from '../components/FormulaRenderer';
import { useResponsive } from '../hooks/useResponsive';

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
  category: string;
}

const CATEGORIES = [
  { key: 'limit_def', label: '极限定义', active: true },
  { key: 'char_eq', label: '特征方程法' },
  { key: 'undetermined', label: '待定系数法' },
  { key: 'separable', label: '变量分离法' },
];

const PRACTICE_PROBLEMS: PracticeProblem[] = [
  {
    id: 'limit-1',
    title: '一次函数极限证明',
    latex: '\\text{证明: } \\lim_{x \\to 3} (2x + 1) = 7',
    difficulty: 'easy',
    status: 'completed',
    score: 100,
    category: 'limit_def',
    steps: [
      { title: '分析目标', formula: '|f(x) - L| = |2x + 1 - 7| = 2|x - 3|' },
      { title: '寻找 δ 与 ε 的关系', formula: '\\text{要使 } 2|x-3| < \\varepsilon, \\text{ 需要 } |x-3| < \\frac{\\varepsilon}{2}' },
      { title: '确定 δ', formula: '\\delta = \\frac{\\varepsilon}{2}' },
      { title: '验证', formula: '\\text{当 } 0 < |x-3| < \\delta \\text{ 时, } |2x+1-7| = 2|x-3| < 2\\delta = \\varepsilon' },
    ],
    answer: '\\delta = \\frac{\\varepsilon}{2}',
    hint: '将 |f(x)-L| 表达为 |x-a| 的函数，然后确定 δ',
  },
  {
    id: 'limit-2',
    title: '二次函数极限证明',
    latex: '\\text{证明: } \\lim_{x \\to 1} x^2 = 1',
    difficulty: 'medium',
    status: 'in_progress',
    score: 60,
    category: 'limit_def',
    steps: [
      { title: '分析目标', formula: '|f(x) - L| = |x^2 - 1| = |x+1||x-1|' },
      { title: '限制 x 的范围', formula: '\\text{设 } |x-1| < 1, \\text{ 则 } 0 < x < 2, \\text{ 所以 } |x+1| < 3' },
      { title: '确定 δ', formula: '\\delta = \\min\\{1, \\frac{\\varepsilon}{3}\\}' },
      { title: '验证', formula: '|x^2-1| = |x+1||x-1| < 3 \\cdot \\frac{\\varepsilon}{3} = \\varepsilon' },
    ],
    answer: '\\delta = \\min\\{1, \\frac{\\varepsilon}{3}\\}',
    hint: '需要先限制 x 的范围来估计 |x+1| 的上界',
  },
  {
    id: 'limit-3',
    title: '常数函数极限',
    latex: '\\text{证明: } \\lim_{x \\to a} c = c \\text{ (c为常数)}',
    difficulty: 'easy',
    status: 'not_started',
    score: 0,
    category: 'limit_def',
    steps: [
      { title: '分析目标', formula: '|f(x) - L| = |c - c| = 0' },
      { title: '确定 δ', formula: '\\text{任意 } \\delta > 0 \\text{ 均可}' },
      { title: '验证', formula: '|c - c| = 0 < \\varepsilon \\text{ 恒成立}' },
    ],
    answer: '\\delta \\text{ 可取任意正数}',
    hint: '常数函数在任何点的极限都等于该常数本身',
  },
  {
    id: 'limit-4',
    title: '分式函数极限',
    latex: '\\text{证明: } \\lim_{x \\to 2} \\frac{x^2-4}{x-2} = 4',
    difficulty: 'medium',
    status: 'not_started',
    score: 0,
    category: 'limit_def',
    steps: [
      { title: '化简函数', formula: 'f(x) = \\frac{x^2-4}{x-2} = \\frac{(x-2)(x+2)}{x-2} = x+2 \\text{ (} x \\neq 2\\text{)}' },
      { title: '分析目标', formula: '|f(x) - 4| = |x + 2 - 4| = |x - 2|' },
      { title: '确定 δ', formula: '\\delta = \\varepsilon' },
      { title: '验证', formula: '\\text{当 } 0 < |x-2| < \\delta \\text{ 时, } |x+2-4| = |x-2| < \\varepsilon' },
    ],
    answer: '\\delta = \\varepsilon',
    hint: '先对分式进行约分化简，注意 x≠2',
  },
  {
    id: 'limit-5',
    title: '根式函数极限',
    latex: '\\text{证明: } \\lim_{x \\to 4} \\sqrt{x} = 2',
    difficulty: 'hard',
    status: 'not_started',
    score: 0,
    category: 'limit_def',
    steps: [
      { title: '分析目标', formula: '|\\sqrt{x} - 2| = \\frac{|x-4|}{\\sqrt{x}+2}' },
      { title: '限制 x 的范围', formula: '\\text{设 } |x-4| < 3, \\text{ 则 } x > 1, \\text{ 所以 } \\sqrt{x} + 2 > 3' },
      { title: '确定 δ', formula: '\\delta = \\min\\{3, 3\\varepsilon\\}' },
      { title: '验证', formula: '|\\sqrt{x}-2| = \\frac{|x-4|}{\\sqrt{x}+2} < \\frac{\\delta}{3} \\leq \\varepsilon' },
    ],
    answer: '\\delta = \\min\\{3, 3\\varepsilon\\}',
    hint: '利用分子有理化技巧，注意限制 x 的范围保证分母有下界',
  },
  {
    id: 'p1',
    title: '基础：两不等实根',
    latex: "y'' - 3y' + 2y = 0",
    difficulty: 'easy',
    status: 'completed',
    score: 100,
    category: 'char_eq',
    steps: [
      { title: '建立特征方程', formula: 'r^2 - 3r + 2 = 0' },
      { title: '因式分解并求解', formula: '(r-1)(r-2)=0,\\ r_1=1,\\ r_2=2' },
      { title: '写出通解', formula: 'y = C_1 e^{x} + C_2 e^{2x}' },
    ],
    answer: 'y = C_1 e^{x} + C_2 e^{2x}',
  },
  {
    id: 'p2',
    title: '基础：两不等实根（二）',
    latex: "y'' - 5y' + 6y = 0",
    difficulty: 'easy',
    status: 'completed',
    score: 95,
    category: 'char_eq',
    steps: [
      { title: '建立特征方程', formula: 'r^2 - 5r + 6 = 0' },
      { title: '因式分解', formula: '(r-2)(r-3)=0,\\ r_1=2,\\ r_2=3' },
      { title: '写出通解', formula: 'y = C_1 e^{2x} + C_2 e^{3x}' },
    ],
    answer: 'y = C_1 e^{2x} + C_2 e^{3x}',
  },
  {
    id: 'p3',
    title: '进阶：重根情形',
    latex: "y'' - 4y' + 4y = 0",
    difficulty: 'medium',
    status: 'in_progress',
    score: 60,
    category: 'char_eq',
    hint: '注意 Δ=0 时的重根通解形式需要乘以 x',
    steps: [
      { title: '建立特征方程', formula: 'r^2 - 4r + 4 = 0' },
      { title: '判别重根', formula: '\\Delta = 16-16=0,\\ (r-2)^2=0' },
      { title: '重根通解', formula: 'y = (C_1 + C_2 x) e^{2x}' },
    ],
    answer: 'y = (C_1 + C_2 x) e^{2x}',
  },
  {
    id: 'p4',
    title: '进阶：共轭复根',
    latex: "y'' + 2y' + 5y = 0",
    difficulty: 'medium',
    status: 'not_started',
    score: 0,
    category: 'char_eq',
    hint: '特征方程 r²+2r+5=0, Δ=4-20=-16, r=-1±2i',
    answer: 'y = e^{-x}(C_1 \\cos 2x + C_2 \\sin 2x)',
  },
  {
    id: 'p5',
    title: '挑战：参数讨论',
    latex: "y'' + ky' + y = 0",
    difficulty: 'hard',
    status: 'not_started',
    score: 0,
    category: 'char_eq',
    hint: '需讨论 k²-4 的正负零三种情况，对应三种不同的特征根类型',
    answer: '\\text{当 }|k|>2:\\ y=C_1 e^{r_1x}+C_2 e^{r_2x},\\ r=\\frac{-k\\pm\\sqrt{k^2-4}}{2}',
  },
  {
    id: 'p6',
    title: '进阶：二阶综合',
    latex: "y'' + y' - 2y = 0",
    difficulty: 'medium',
    status: 'not_started',
    score: 0,
    category: 'char_eq',
    hint: '特征方程 r²+r-2=(r+2)(r-1)=0',
    answer: 'y = C_1 e^{-2x} + C_2 e^{x}',
  },
];

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  easy: { label: '基础', color: '#22c55e', bg: '#22c55e20' },
  medium: { label: '进阶', color: '#f59e0b', bg: '#f59e0b20' },
  hard: { label: '挑战', color: '#ef4444', bg: '#ef444420' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  completed: { label: '已完成', color: '#34d399', icon: '✅' },
  in_progress: { label: '进行中', color: '#fbbf24', icon: '🔄' },
  not_started: { label: '未开始', color: '#64748b', icon: '⬜' },
};

export default function SpecialPracticePage() {
  const { isMobile } = useResponsive();
  const [selectedCategory, setSelectedCategory] = useState('limit_def');
  const filteredProblems = PRACTICE_PROBLEMS.filter((p) => selectedCategory === 'all' || p.category === selectedCategory);
  const [selectedProblem, setSelectedProblem] = useState<PracticeProblem>(filteredProblems[0]);
  const [showAnswer, setShowAnswer] = useState(selectedProblem.status === 'completed');

  const completedCount = filteredProblems.filter((p) => p.status === 'completed').length;
  const completedScores = filteredProblems.filter((p) => p.status === 'completed');
  const avgScore = completedScores.length > 0
    ? Math.round(completedScores.reduce((s, p) => s + p.score, 0) / completedScores.length)
    : 0;

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    const newFiltered = PRACTICE_PROBLEMS.filter((p) => cat === 'all' || p.category === cat);
    if (newFiltered.length > 0) {
      setSelectedProblem(newFiltered[0]);
      setShowAnswer(newFiltered[0].status === 'completed');
    }
  };

  const handleProblemSelect = (p: PracticeProblem) => {
    setSelectedProblem(p);
    setShowAnswer(p.status === 'completed');
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0f172a', overflow: 'hidden' }}>
      <div style={{
        padding: isMobile ? '10px 14px' : '14px 24px',
        background: '#1e293b',
        borderBottom: '1px solid #334155',
      }}>
        <div style={{ fontSize: isMobile ? 15 : 17, fontWeight: 700, color: '#e2e8f0' }}>
          📝 专项练习
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
          专项练习 &gt; {CATEGORIES.find(c => c.key === selectedCategory)?.label || '全部'}
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
          <div style={{ fontSize: 20, fontWeight: 700, color: '#a5b4fc' }}>
            {completedCount}/{filteredProblems.length}
          </div>
          <div style={{ fontSize: 10, color: '#64748b' }}>完成进度</div>
        </div>
        <div style={{
          flex: 1,
          padding: '8px 14px',
          background: '#0f172a',
          borderRadius: 8,
          border: '1px solid #334155',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#34d399' }}>{avgScore}%</div>
          <div style={{ fontSize: 10, color: '#64748b' }}>平均正确率</div>
        </div>
        <div style={{
          flex: 1,
          padding: '8px 14px',
          background: '#0f172a',
          borderRadius: 8,
          border: '1px solid #334155',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>3</div>
          <div style={{ fontSize: 10, color: '#64748b' }}>知识维度</div>
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: 4,
        padding: '8px 16px',
        background: '#1e293b',
        borderBottom: '1px solid #334155',
        overflowX: 'auto',
        flexWrap: 'nowrap',
      }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => handleCategoryChange(cat.key)}
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

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {!isMobile && (
          <div style={{
            width: 280,
            borderRight: '1px solid #334155',
            background: '#1e293b',
            overflowY: 'auto',
            padding: '8px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', padding: '8px 8px 8px', marginBottom: 4 }}>
              题目列表
            </div>
            {filteredProblems.map((p) => {
              const isSelected = selectedProblem.id === p.id;
              const diffCfg = DIFFICULTY_CONFIG[p.difficulty];
              const stCfg = STATUS_CONFIG[p.status];
              return (
                <div
                  key={p.id}
                  onClick={() => handleProblemSelect(p)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: isSelected ? '#0f172a' : 'transparent',
                    border: isSelected ? '1px solid #6366f140' : '1px solid transparent',
                    cursor: 'pointer',
                    marginBottom: 4,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: isSelected ? '#e2e8f0' : '#cbd5e1' }}>
                      {p.title}
                    </span>
                    <span style={{ fontSize: 12 }}>{stCfg.icon}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{
                      fontSize: 9,
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: diffCfg.bg,
                      color: diffCfg.color,
                      fontWeight: 600,
                    }}>
                      {diffCfg.label}
                    </span>
                    {p.status === 'completed' && (
                      <span style={{ fontSize: 10, color: '#34d399', fontWeight: 600 }}>
                        {p.score}分
                      </span>
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
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? 12 : 20 }}>
          {isMobile && (
            <div style={{
              display: 'flex',
              gap: 4,
              marginBottom: 12,
              overflowX: 'auto',
              paddingBottom: 4,
            }}>
              {filteredProblems.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleProblemSelect(p)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: selectedProblem.id === p.id ? '1px solid #818cf8' : '1px solid #334155',
                    background: selectedProblem.id === p.id ? '#6366f120' : 'transparent',
                    color: selectedProblem.id === p.id ? '#a5b4fc' : '#94a3b8',
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {STATUS_CONFIG[p.status].icon} {p.title}
                </button>
              ))}
            </div>
          )}

          <div style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 12,
            padding: 20,
            marginBottom: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{
                    fontSize: 10,
                    padding: '3px 10px',
                    borderRadius: 4,
                    background: DIFFICULTY_CONFIG[selectedProblem.difficulty].bg,
                    color: DIFFICULTY_CONFIG[selectedProblem.difficulty].color,
                    fontWeight: 600,
                  }}>
                    {DIFFICULTY_CONFIG[selectedProblem.difficulty].label}
                  </span>
                  <span style={{
                    fontSize: 10,
                    padding: '3px 10px',
                    borderRadius: 4,
                    background: STATUS_CONFIG[selectedProblem.status].color + '20',
                    color: STATUS_CONFIG[selectedProblem.status].color,
                    fontWeight: 600,
                  }}>
                    {STATUS_CONFIG[selectedProblem.status].icon} {STATUS_CONFIG[selectedProblem.status].label}
                  </span>
                  {selectedProblem.status === 'completed' && (
                    <span style={{ fontSize: 12, color: '#34d399', fontWeight: 600 }}>
                      {selectedProblem.score}分
                    </span>
                  )}
                </div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', margin: '0 0 8px 0' }}>
                  {selectedProblem.title}
                </h2>
                <FormulaRenderer formula={selectedProblem.latex} displayMode={false} style={{ margin: 0 }} />
              </div>
            </div>

            {selectedProblem.hint && selectedProblem.status !== 'completed' && (
              <div style={{
                marginTop: 12,
                padding: 10,
                background: '#fbbf2415',
                borderRadius: 8,
                border: '1px solid #fbbf2425',
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#fbbf24', marginBottom: 3 }}>
                  💡 提示
                </div>
                <div style={{ fontSize: 11, color: '#cbd5e1' }}>
                  {selectedProblem.hint}
                </div>
              </div>
            )}
          </div>

          {(showAnswer || selectedProblem.status === 'completed') && selectedProblem.steps && (
            <div style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 12,
              padding: 20,
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#34d399', marginBottom: 12 }}>
                ✅ 解题步骤
              </div>
              {selectedProblem.steps.map((step, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px 14px',
                    background: idx % 2 === 0 ? '#0f172a' : 'transparent',
                    borderRadius: 8,
                    marginBottom: 6,
                  }}
                >
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>
                    {step.title}
                  </div>
                  <FormulaRenderer formula={step.formula} displayMode={false} style={{ margin: 0 }} />
                </div>
              ))}
              {selectedProblem.answer && (
                <div style={{
                  marginTop: 10,
                  padding: '10px 14px',
                  background: '#6366f115',
                  borderRadius: 8,
                  border: '1px solid #6366f125',
                }}>
                  <span style={{ fontSize: 12, color: '#a5b4fc', fontWeight: 600 }}>答案：</span>
                  <FormulaRenderer formula={selectedProblem.answer} displayMode={false} style={{ margin: 0 }} />
                </div>
              )}
            </div>
          )}

          {selectedProblem.status !== 'completed' && (
            <button
              onClick={() => setShowAnswer(!showAnswer)}
              style={{
                width: '100%',
                padding: '12px 0',
                background: showAnswer ? '#22c55e15' : '#6366f1',
                border: showAnswer ? '1px solid #22c55e30' : 'none',
                borderRadius: 10,
                color: showAnswer ? '#34d399' : '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {showAnswer ? '隐藏解答' : '显示解答与步骤'}
            </button>
          )}

          {selectedProblem.status === 'completed' && (
            <div style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 12,
              padding: 16,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>
                📊 知识点覆盖
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedProblem.category === 'limit_def' 
                  ? ['ε-δ定义理解', 'δ的确定方法', '不等式放缩', '极限证明技巧'].map((kp) => (
                      <span
                        key={kp}
                        style={{
                          fontSize: 10,
                          padding: '4px 10px',
                          borderRadius: 12,
                          background: selectedProblem.score >= 80 ? '#22c55e15' : '#334155',
                          color: selectedProblem.score >= 80 ? '#34d399' : '#94a3b8',
                          border: `1px solid ${selectedProblem.score >= 80 ? '#22c55e30' : '#475569'}`,
                        }}
                      >
                        {selectedProblem.score >= 80 ? '✓ ' : ''}{kp}
                      </span>
                    ))
                  : ['特征方程建立', '一元二次方程求解', '特征根判别', '通解结构定理'].map((kp) => (
                      <span
                        key={kp}
                        style={{
                          fontSize: 10,
                          padding: '4px 10px',
                          borderRadius: 12,
                          background: selectedProblem.score >= 80 ? '#22c55e15' : '#334155',
                          color: selectedProblem.score >= 80 ? '#34d399' : '#94a3b8',
                          border: `1px solid ${selectedProblem.score >= 80 ? '#22c55e30' : '#475569'}`,
                        }}
                      >
                        {selectedProblem.score >= 80 ? '✓ ' : ''}{kp}
                      </span>
                    ))
                }
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
