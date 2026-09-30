import { useState, useMemo, useCallback } from 'react';
import InteractiveCanvas, { type SliderParam, type ScenarioConfig } from '../components/InteractiveCanvas';

type RiemannType = 'left' | 'right' | 'midpoint';

const FUNCTIONS: { id: string; name: string; fn: (x: number) => number; antideriv: (x: number) => number }[] = [
  { id: 'x2', name: 'x²', fn: (x) => x * x, antideriv: (x) => (x * x * x) / 3 },
  { id: 'sin', name: 'sin(x)', fn: (x) => Math.sin(x), antideriv: (x) => -Math.cos(x) },
  { id: 'exp', name: 'eˣ', fn: (x) => Math.exp(x), antideriv: (x) => Math.exp(x) },
  { id: 'linear', name: '2x+1', fn: (x) => 2 * x + 1, antideriv: (x) => x * x + x },
];

const SCENARIO: ScenarioConfig = {
  id: 'integral',
  title: '黎曼和与定积分探索器',
  description: '定积分 ∫ₐᵇ f(x)dx 是黎曼和的极限。通过调整矩形数量和类型，观察黎曼和如何逼近精确积分值。当矩形数趋于无穷时，黎曼和即为定积分。',
  concept: '定积分定义',
  difficulty: 'hard',
};

export default function IntegralPage() {
  const [selectedFn, setSelectedFn] = useState(0);
  const [a, setA] = useState(0);
  const [b, setB] = useState(3);
  const [n, setN] = useState(10);
  const [riemannType, setRiemannType] = useState<RiemannType>('left');
  const [showFTC, setShowFTC] = useState(false);

  const currentFn = FUNCTIONS[selectedFn];
  const { fn, antideriv } = currentFn;

  const params: SliderParam[] = [
    { key: 'a', label: '积分下限 a', min: -5, max: 4, step: 0.1, defaultValue: 0, color: '#6366f1' },
    { key: 'b', label: '积分上限 b', min: -4, max: 5, step: 0.1, defaultValue: 3, color: '#8b5cf6' },
    { key: 'n', label: '矩形数量 n', min: 1, max: 100, step: 1, defaultValue: 10, color: '#22c55e' },
  ];

  const paramValues = { a, b, n };

  const handleParamChange = useCallback((key: string, value: number) => {
    if (key === 'a') setA(value);
    if (key === 'b') setB(value);
    if (key === 'n') setN(Math.round(value));
  }, []);

  const dx = (b - a) / n;
  const exactValue = antideriv(b) - antideriv(a);

  const riemannSum = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const xi = riemannType === 'left' ? a + i * dx : riemannType === 'right' ? a + (i + 1) * dx : a + (i + 0.5) * dx;
      sum += fn(xi) * dx;
    }
    return sum;
  }, [a, b, n, dx, fn, riemannType]);

  const error = Math.abs(riemannSum - exactValue);

  const plotData = useMemo((): Plotly.Data[] => {
    const xMin = Math.min(a, b) - 1;
    const xMax = Math.max(a, b) + 1;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i <= 500; i++) {
      const x = xMin + ((xMax - xMin) * i) / 500;
      xs.push(x);
      ys.push(fn(x));
    }

    const traces: Plotly.Data[] = [
      { x: xs, y: ys, type: 'scatter', mode: 'lines', name: `f(x) = ${currentFn.name}`, line: { color: '#818cf8', width: 3 } },
    ];

    for (let i = 0; i < n; i++) {
      const xLeft = a + i * dx;
      const xi = riemannType === 'left' ? xLeft : riemannType === 'right' ? xLeft + dx : xLeft + dx / 2;
      const height = fn(xi);
      traces.push({
        x: [xLeft, xLeft, xLeft + dx, xLeft + dx, xLeft],
        y: [0, height, height, 0, 0],
        type: 'scatter',
        mode: 'lines',
        fill: 'tozeroy',
        fillcolor: height >= 0 ? 'rgba(99,102,241,0.2)' : 'rgba(239,68,68,0.2)',
        line: { color: height >= 0 ? '#6366f1' : '#ef4444', width: 1 },
        showlegend: i === 0,
        name: riemannType === 'left' ? '左黎曼和' : riemannType === 'right' ? '右黎曼和' : '中点黎曼和',
      });
    }

    if (showFTC) {
      const ftcXs: number[] = [];
      const ftcYs: number[] = [];
      const ftcStart = Math.min(a, b) - 1;
      const ftcEnd = Math.max(a, b) + 1;
      for (let i = 0; i <= 200; i++) {
        const x = ftcStart + ((ftcEnd - ftcStart) * i) / 200;
        ftcXs.push(x);
        ftcYs.push(antideriv(x) - antideriv(a));
      }
      traces.push({ x: ftcXs, y: ftcYs, type: 'scatter', mode: 'lines', name: 'F(x)-F(a)', line: { color: '#f97316', width: 2, dash: 'dash' }, yaxis: 'y2' });
    }

    return traces;
  }, [currentFn, fn, antideriv, a, b, n, dx, riemannType, showFTC]);

  const plotLayout = useMemo((): Partial<Plotly.Layout> => {
    const layout: any = {
      title: { text: `黎曼和: ∫[${a.toFixed(1)},${b.toFixed(1)}] ${currentFn.name} dx`, font: { size: 16, color: '#e2e8f0' } },
      xaxis: { title: { text: 'x' }, gridcolor: '#334155', zerolinecolor: '#475569' },
      yaxis: { title: { text: 'f(x)' }, gridcolor: '#334155', zerolinecolor: '#475569' },
      legend: { bgcolor: 'rgba(15,23,42,0.8)', font: { size: 10, color: '#94a3b8' } },
    };
    if (showFTC) {
      layout.yaxis2 = { title: { text: 'F(x)-F(a)' }, overlaying: 'y', side: 'right', gridcolor: '#334155' };
    }
    return layout;
  }, [currentFn, a, b, showFTC]);

  return (
    <InteractiveCanvas
      scenario={SCENARIO}
      params={params}
      paramValues={paramValues}
      onParamChange={handleParamChange}
      plotData={plotData}
      plotLayout={plotLayout}
      hint="增大 n 观察黎曼和如何逼近精确值。左/右黎曼和分别用矩形左/右端点的函数值作为高度，中点黎曼和精度更高。"
      extraControls={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ background: '#0f172a', borderRadius: 8, padding: 10, border: '1px solid #334155' }}>
            <h4 style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>积分信息</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#64748b' }}>精确值</span>
                <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>{exactValue.toFixed(6)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#64748b' }}>黎曼和</span>
                <span style={{ fontSize: 11, color: '#a5b4fc', fontWeight: 700 }}>{riemannSum.toFixed(6)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#64748b' }}>误差</span>
                <span style={{ fontSize: 11, color: error < 0.1 ? '#22c55e' : error < 1 ? '#eab308' : '#ef4444' }}>{error.toFixed(6)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#64748b' }}>Δx</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{dx.toFixed(4)}</span>
              </div>
            </div>
          </div>

          <h4 style={{ fontSize: 12, color: '#94a3b8' }}>选择函数</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {FUNCTIONS.map((f, i) => (
              <button key={f.id} onClick={() => setSelectedFn(i)} style={{
                padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: i === selectedFn ? '#6366f1' : '#334155', color: i === selectedFn ? '#fff' : '#94a3b8',
                fontSize: 11, fontWeight: 600, textAlign: 'left',
              }}>
                f(x) = {f.name}
              </button>
            ))}
          </div>

          <h4 style={{ fontSize: 12, color: '#94a3b8' }}>黎曼和类型</h4>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['left', 'right', 'midpoint'] as const).map((type) => (
              <button key={type} onClick={() => setRiemannType(type)} style={{
                flex: 1, padding: '6px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: riemannType === type ? '#6366f1' : '#334155', color: riemannType === type ? '#fff' : '#94a3b8',
                fontSize: 10, fontWeight: 600,
              }}>
                {type === 'left' ? '左端点' : type === 'right' ? '右端点' : '中点'}
              </button>
            ))}
          </div>

          <button onClick={() => setShowFTC(!showFTC)} style={{
            padding: '6px 10px', borderRadius: 6, border: showFTC ? '1px solid #f97316' : '1px solid #475569',
            background: showFTC ? 'rgba(249,115,22,0.1)' : 'transparent', color: showFTC ? '#fb923c' : '#94a3b8',
            cursor: 'pointer', fontSize: 11, fontWeight: 600,
          }}>
            {showFTC ? '隐藏微积分基本定理' : '📐 微积分基本定理'}
          </button>
        </div>
      }
    />
  );
}
