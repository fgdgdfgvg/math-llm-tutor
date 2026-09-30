import { useState, useMemo, useCallback } from 'react';
import InteractiveCanvas, { type SliderParam, type ScenarioConfig } from '../components/InteractiveCanvas';
import FormulaRenderer from '../components/FormulaRenderer';

const FUNCTIONS = [
  { id: 'sin_x', name: 'sin(x)/x', fn: (x: number) => (x === 0 ? 1 : Math.sin(x) / x), limitPoint: 0, limitValue: 1, description: '微积分中最重要的极限之一', hint: '尝试将 ε 设为 0.3，然后找到合适的 δ' },
  { id: 'x2_4', name: '(x²-4)/(x-2)', fn: (x: number) => (x === 2 ? 4 : (x * x - 4) / (x - 2)), limitPoint: 2, limitValue: 4, description: '函数在 x=2 处有"洞"，但极限存在', hint: '设 ε=0.5 试试' },
  { id: 'exp_1', name: '(eˣ-1)/x', fn: (x: number) => (x === 0 ? 1 : (Math.exp(x) - 1) / x), limitPoint: 0, limitValue: 1, description: 'eˣ 在 x=0 处的瞬时增长率为 1', hint: '这个极限揭示了自然对数的本质' },
  { id: 'x3', name: 'x³', fn: (x: number) => x * x * x, limitPoint: 1, limitValue: 1, description: '连续函数的极限等于函数值', hint: '连续函数是最简单的情况' },
];

const SCENARIO: ScenarioConfig = {
  id: 'epsilon-delta',
  title: 'ε-δ 极限定义探索器',
  description: '通过交互式可视化理解极限的严格定义：∀ε>0, ∃δ>0，使得当 0<|x-a|<δ 时，|f(x)-L|<ε。调整 ε 和 δ 参数，观察函数在极限点附近的行为。',
  concept: '极限定义',
  difficulty: 'medium',
};

const LIMIT_DEFINITION_STEPS = [
  {
    step: 1,
    title: '极限的直观理解',
    content: '当我们说"当 x 趋近于 a 时，f(x) 的极限是 L"，直观意思是：当 x 足够接近 a（但不等于 a）时，f(x) 可以任意接近 L。',
    formula: '\\lim_{x \\to a} f(x) = L',
    icon: '💡',
  },
  {
    step: 2,
    title: 'ε-δ 定义的提出',
    content: '为了严格化"任意接近"的概念，数学家引入了 ε（epsilon）和 δ（delta）两个正数。ε 表示函数值与极限值的允许误差，δ 表示自变量与极限点的接近程度。',
    formula: '\\varepsilon > 0, \\quad \\delta > 0',
    icon: '📐',
  },
  {
    step: 3,
    title: '定义的核心结构',
    content: 'ε-δ 定义的核心是：对于任意给定的误差容忍度 ε，我们总能找到一个邻域半径 δ，使得当 x 在这个邻域内（除去中心点）时，函数值与极限值的差距小于 ε。',
    formula: '\\forall \\varepsilon > 0, \\exists \\delta > 0',
    icon: '🎯',
  },
  {
    step: 4,
    title: '定义的完整表述',
    content: '完整定义：对于任意 ε>0，存在 δ>0，使得当 0<|x-a|<δ 时，有 |f(x)-L|<ε。',
    formula: '\\forall \\varepsilon > 0, \\exists \\delta > 0, \\text{ s.t. } 0 < |x-a| < \\delta \\Rightarrow |f(x)-L| < \\varepsilon',
    icon: '📜',
  },
  {
    step: 5,
    title: '定义的逻辑解读',
    content: '逻辑上，这是一个"∀∃→"结构：(1) 对手任选 ε；(2) 我方找到 δ；(3) 验证条件成立。关键：δ 依赖于 ε，通常 ε 越小，δ 也越小。',
    formula: '\\delta = \\delta(\\varepsilon)',
    icon: '🔄',
  },
  {
    step: 6,
    title: '几何意义',
    content: '在坐标系中，ε 定义了水平带状区域 [L-ε, L+ε]，δ 定义了垂直带状区域 (a-δ, a+δ)。定义要求：在垂直带内（除去中心），函数曲线必须落在水平带内。',
    formula: 'L - \\varepsilon < f(x) < L + \\varepsilon',
    icon: '📊',
  },
  {
    step: 7,
    title: '关键细节：0 < |x - a|',
    content: '条件 0<|x-a| 排除了 x=a 这一点。这意味着极限值 L 与 f(a) 是否存在、是否等于 L 无关。极限关注的是"趋近"过程，而非"到达"。',
    formula: 'x \\neq a \\text{ 但 } x \\to a',
    icon: '⚠️',
  },
  {
    step: 8,
    title: '定义的应用示例',
    content: '证明 lim(x→3)(2x)=6：对任意 ε>0，取 δ=ε/2。当 0<|x-3|<δ 时，|2x-6|=2|x-3|<2δ=ε。证毕。',
    formula: '\\text{取 } \\delta = \\frac{\\varepsilon}{2}, \\text{ 则 } |2x-6| = 2|x-3| < 2\\delta = \\varepsilon',
    icon: '✅',
  },
];

const KEY_POINTS = [
  'ε 是任意小的正数，表示"误差容忍度"',
  'δ 依赖于 ε，ε 越小 δ 通常也越小',
  '0<|x-a| 排除了 x=a 点本身',
  '极限存在与函数在该点是否有定义无关',
];

const COMMON_LIMITS = [
  { name: '常数极限', formula: '\\lim_{x \\to a} c = c' },
  { name: '幂函数', formula: '\\lim_{x \\to a} x^n = a^n' },
  { name: '指数函数', formula: '\\lim_{x \\to 0} \\frac{e^x - 1}{x} = 1' },
];

export default function EpsilonDeltaPage() {
  const [selectedFn, setSelectedFn] = useState(0);
  const [epsilon, setEpsilon] = useState(0.3);
  const [delta, setDelta] = useState(0.5);
  const [attempts, setAttempts] = useState<{ epsilon: number; delta: number; success: boolean }[]>([]);
  const [challengeMode, setChallengeMode] = useState(false);
  const [challengeEpsilon, setChallengeEpsilon] = useState(0);
  const [challengeFnIdx, setChallengeFnIdx] = useState(0);
  const [showDefinitionPanel, setShowDefinitionPanel] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const currentFn = FUNCTIONS[challengeMode ? challengeFnIdx : selectedFn];
  const currentEpsilon = challengeMode ? challengeEpsilon : epsilon;
  const { limitPoint, limitValue, fn } = currentFn;

  const params: SliderParam[] = challengeMode
    ? [{ key: 'δ', label: '邻域半径 δ', min: 0.01, max: 2, step: 0.01, defaultValue: 0.5, color: '#f97316' }]
    : [
        { key: 'ε', label: '误差容忍度 ε', min: 0.01, max: 1, step: 0.01, defaultValue: 0.3, color: '#22c55e' },
        { key: 'δ', label: '邻域半径 δ', min: 0.01, max: 2, step: 0.01, defaultValue: 0.5, color: '#f97316' },
      ];

  const paramValues: Record<string, number> = challengeMode ? { 'δ': delta } : { 'ε': epsilon, 'δ': delta };

  const handleParamChange = useCallback((key: string, value: number) => {
    if (key === 'ε') setEpsilon(value);
    if (key === 'δ') setDelta(value);
  }, []);

  const checkDelta = useCallback(() => {
    const testPoints: number[] = [];
    const steps = 200;
    for (let i = 0; i <= steps; i++) {
      const x = limitPoint - delta + (2 * delta * i) / steps;
      if (Math.abs(x - limitPoint) < 0.0001) continue;
      testPoints.push(x);
    }
    const allWithin = testPoints.every((x) => Math.abs(fn(x) - limitValue) < currentEpsilon);
    const result = { epsilon: currentEpsilon, delta, success: allWithin };
    setAttempts((prev) => [...prev, result]);
    return { success: allWithin, message: allWithin ? '✅ 验证通过！δ 满足条件' : '❌ 验证失败，存在 x 使得 |f(x)-L|≥ε，试试减小 δ' };
  }, [delta, currentEpsilon, fn, limitPoint, limitValue]);

  const optimalDelta = useMemo(() => {
    let optDelta = delta;
    for (let d = delta; d > 0.001; d -= delta / 1000) {
      let valid = true;
      for (let i = 0; i <= 200; i++) {
        const x = limitPoint - d + (2 * d * i) / 200;
        if (Math.abs(x - limitPoint) < 0.0001) continue;
        if (Math.abs(fn(x) - limitValue) >= currentEpsilon) { valid = false; break; }
      }
      if (valid) { optDelta = d; break; }
    }
    return optDelta;
  }, [delta, currentEpsilon, fn, limitPoint, limitValue]);

  const startChallenge = useCallback(() => {
    setChallengeMode(true);
    setChallengeFnIdx(Math.floor(Math.random() * FUNCTIONS.length));
    setChallengeEpsilon(0.1 + Math.random() * 0.5);
    setDelta(0.5);
  }, []);

  const plotData = useMemo((): Plotly.Data[] => {
    const spread = Math.max(delta * 3, 1);
    const xMin = limitPoint - spread - 1;
    const xMax = limitPoint + spread + 1;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i <= 500; i++) {
      const x = xMin + ((xMax - xMin) * i) / 500;
      xs.push(x);
      ys.push(fn(x));
    }

    const ySpread = Math.max(currentEpsilon * 3, 1);

    return [
      { x: xs, y: ys, type: 'scatter', mode: 'lines', name: `f(x) = ${currentFn.name}`, line: { color: '#818cf8', width: 3 } },
      { x: [limitPoint], y: [limitValue], type: 'scatter', mode: 'markers', name: `极限点`, marker: { color: '#f43f5e', size: 12, symbol: 'circle-open', line: { width: 3 } } },
      { x: [xMin, xMax], y: [limitValue + currentEpsilon, limitValue + currentEpsilon], type: 'scatter', mode: 'lines', name: `L+ε`, line: { color: '#22c55e', width: 1, dash: 'dash' } },
      { x: [xMin, xMax], y: [limitValue - currentEpsilon, limitValue - currentEpsilon], type: 'scatter', mode: 'lines', name: `L-ε`, line: { color: '#22c55e', width: 1, dash: 'dash' } },
      { x: [limitPoint - delta, limitPoint - delta], y: [limitValue - ySpread - 1, limitValue + ySpread + 1], type: 'scatter', mode: 'lines', name: `a-δ`, line: { color: '#f97316', width: 1, dash: 'dot' } },
      { x: [limitPoint + delta, limitPoint + delta], y: [limitValue - ySpread - 1, limitValue + ySpread + 1], type: 'scatter', mode: 'lines', name: `a+δ`, line: { color: '#f97316', width: 1, dash: 'dot' } },
    ];
  }, [currentFn, currentEpsilon, delta, fn, limitPoint, limitValue]);

  const plotLayout = useMemo((): Partial<Plotly.Layout> => {
    const spread = Math.max(delta * 3, 1);
    const ySpread = Math.max(currentEpsilon * 3, 1);
    return {
      title: { text: `ε-δ 极限定义: lim(x→${limitPoint}) ${currentFn.name} = ${limitValue}`, font: { size: 16, color: '#e2e8f0' } },
      xaxis: { title: { text: 'x' }, gridcolor: '#334155', zerolinecolor: '#475569', range: [limitPoint - spread - 1, limitPoint + spread + 1] },
      yaxis: { title: { text: 'f(x)' }, gridcolor: '#334155', zerolinecolor: '#475569', range: [limitValue - ySpread - 1, limitValue + ySpread + 1] },
      legend: { bgcolor: 'rgba(15,23,42,0.8)', font: { size: 10, color: '#94a3b8' } },
      shapes: [{
        type: 'rect', xref: 'x', yref: 'y',
        x0: limitPoint - delta, x1: limitPoint + delta,
        y0: limitValue - currentEpsilon, y1: limitValue + currentEpsilon,
        fillcolor: 'rgba(99,102,241,0.1)', line: { color: '#6366f1', width: 1, dash: 'dot' },
      }],
    };
  }, [currentFn, currentEpsilon, delta, limitPoint, limitValue]);

  const score = attempts.filter((a) => a.success).length * 10;

  return (
    <div style={{ height: '100%', display: 'flex', background: '#0f172a' }}>
      {showDefinitionPanel && (
        <div style={{
          width: 380,
          borderRight: '1px solid #334155',
          background: '#1e293b',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>
                📚 极限定义详解
              </div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                ε-δ 语言的严格定义
              </div>
            </div>
            <button
              onClick={() => setShowDefinitionPanel(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                fontSize: 18,
                cursor: 'pointer',
                padding: 4,
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            <div style={{
              background: '#0f172a',
              borderRadius: 10,
              padding: 14,
              marginBottom: 12,
              border: '1px solid #334155',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#818cf8', marginBottom: 8 }}>
                核心定义
              </div>
              <FormulaRenderer formula='\lim_{x \to a} f(x) = L \Leftrightarrow \forall \varepsilon > 0, \exists \delta > 0, \text{ s.t. } 0 < |x-a| < \delta \Rightarrow |f(x)-L| < \varepsilon' displayMode={true} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>
                步骤详解 ({currentStep + 1}/{LIMIT_DEFINITION_STEPS.length})
              </div>
              {LIMIT_DEFINITION_STEPS.map((step, idx) => (
                <div
                  key={step.step}
                  onClick={() => setCurrentStep(idx)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    marginBottom: 6,
                    background: currentStep === idx ? '#6366f120' : '#0f172a',
                    border: currentStep === idx ? '1px solid #6366f140' : '1px solid #334155',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 14 }}>{step.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: currentStep === idx ? '#a5b4fc' : '#cbd5e1' }}>
                      步骤 {step.step}: {step.title}
                    </span>
                  </div>
                  {currentStep === idx && (
                    <>
                      <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6, marginBottom: 8 }}>
                        {step.content}
                      </div>
                      <div style={{
                        padding: '8px 10px',
                        background: '#1e293b',
                        borderRadius: 6,
                        border: '1px solid #475569',
                      }}>
                        <FormulaRenderer formula={step.formula} displayMode={true} />
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div style={{
              background: '#0f172a',
              borderRadius: 10,
              padding: 12,
              marginBottom: 12,
              border: '1px solid #334155',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#22c55e', marginBottom: 8 }}>
                ✅ 关键要点
              </div>
              {KEY_POINTS.map((point, idx) => (
                <div key={idx} style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4, paddingLeft: 8 }}>
                  • {point}
                </div>
              ))}
            </div>

            <div style={{
              background: '#0f172a',
              borderRadius: 10,
              padding: 12,
              border: '1px solid #334155',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b', marginBottom: 8 }}>
                📐 常用极限
              </div>
              {COMMON_LIMITS.map((limit, idx) => (
                <div key={idx} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>{limit.name}</div>
                  <FormulaRenderer formula={limit.formula} displayMode={false} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          padding: '10px 16px',
          background: '#1e293b',
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          {!showDefinitionPanel && (
            <button
              onClick={() => setShowDefinitionPanel(true)}
              style={{
                padding: '6px 12px',
                background: '#6366f120',
                border: '1px solid #6366f140',
                borderRadius: 6,
                color: '#a5b4fc',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              📚 极限定义详解
            </button>
          )}
          <div style={{ fontSize: 10, color: '#64748b' }}>
            点击左侧按钮查看极限定义的详细解释
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          <InteractiveCanvas
            scenario={SCENARIO}
            params={params}
            paramValues={paramValues}
            onParamChange={handleParamChange}
            plotData={plotData}
            plotLayout={plotLayout}
            onVerify={checkDelta}
            hint={currentFn.hint}
            score={score}
            attempts={attempts.length}
            extraControls={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ background: '#0f172a', borderRadius: 8, padding: 10, border: '1px solid #334155' }}>
                  <h4 style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>最优 δ</h4>
                  <span style={{ fontSize: 16, color: '#a5b4fc', fontWeight: 700 }}>δ* ≈ {optimalDelta.toFixed(4)}</span>
                  <p style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>给定 ε={currentEpsilon.toFixed(2)} 的最小 δ</p>
                </div>

                {!challengeMode && (
                  <>
                    <h4 style={{ fontSize: 12, color: '#94a3b8' }}>选择函数</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {FUNCTIONS.map((f, i) => (
                        <button key={f.id} onClick={() => { setSelectedFn(i); setAttempts([]); }} style={{
                          padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                          background: i === selectedFn ? '#6366f1' : '#334155', color: i === selectedFn ? '#fff' : '#94a3b8',
                          fontSize: 11, fontWeight: 600, textAlign: 'left',
                        }}>
                          {f.name} (x→{f.limitPoint})
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <button onClick={challengeMode ? () => setChallengeMode(false) : startChallenge} style={{
                  padding: '8px 12px', borderRadius: 8, border: '1px solid #f97316',
                  background: challengeMode ? 'rgba(249,115,22,0.1)' : 'transparent',
                  color: challengeMode ? '#fb923c' : '#f97316', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                }}>
                  {challengeMode ? '退出挑战' : '🎯 挑战模式'}
                </button>

                {attempts.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>尝试记录</h4>
                    <div style={{ maxHeight: 100, overflowY: 'auto' }}>
                      {attempts.slice(-5).map((a, i) => (
                        <div key={i} style={{
                          fontSize: 10, padding: '3px 6px', marginBottom: 2, borderRadius: 4,
                          background: a.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                          color: a.success ? '#22c55e' : '#ef4444',
                        }}>
                          {a.success ? '✅' : '❌'} ε={a.epsilon.toFixed(2)}, δ={a.delta.toFixed(2)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}
