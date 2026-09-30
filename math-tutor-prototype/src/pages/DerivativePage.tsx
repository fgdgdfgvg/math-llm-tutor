import { useState, useMemo, useCallback } from 'react';
import InteractiveCanvas, { type SliderParam, type ScenarioConfig } from '../components/InteractiveCanvas';

const FUNCTIONS: { id: string; name: string; fn: (x: number) => number; dfn: (x: number) => number; d2fn: (x: number) => number }[] = [
  { id: 'x2', name: 'x²', fn: (x) => x * x, dfn: (x) => 2 * x, d2fn: () => 2 },
  { id: 'x3', name: 'x³', fn: (x) => x * x * x, dfn: (x) => 3 * x * x, d2fn: (x) => 6 * x },
  { id: 'sin', name: 'sin(x)', fn: (x) => Math.sin(x), dfn: (x) => Math.cos(x), d2fn: (x) => -Math.sin(x) },
  { id: 'exp', name: 'eˣ', fn: (x) => Math.exp(x), dfn: (x) => Math.exp(x), d2fn: (x) => Math.exp(x) },
  { id: 'ln', name: 'ln(x)', fn: (x) => (x > 0 ? Math.log(x) : NaN), dfn: (x) => (x > 0 ? 1 / x : NaN), d2fn: (x) => (x > 0 ? -1 / (x * x) : NaN) },
];

const SCENARIO: ScenarioConfig = {
  id: 'derivative',
  title: '导数几何意义探索器',
  description: '导数 f\'(x₀) 表示函数在 x₀ 处的瞬时变化率，几何上等于该点切线的斜率。拖动滑块观察切线如何随切点移动而变化，以及割线逼近切线的过程。',
  concept: '导数定义',
  difficulty: 'medium',
};

export default function DerivativePage() {
  const [selectedFn, setSelectedFn] = useState(0);
  const [x0, setX0] = useState(1);
  const [h, setH] = useState(0.5);
  const [showSecant, setShowSecant] = useState(false);
  const [showSecondDeriv, setShowSecondDeriv] = useState(false);

  const currentFn = FUNCTIONS[selectedFn];
  const { fn, dfn, d2fn } = currentFn;

  const params: SliderParam[] = [
    { key: 'x₀', label: '切点位置 x₀', min: -3, max: 3, step: 0.05, defaultValue: 1, color: '#6366f1' },
    ...(showSecant ? [{ key: 'h', label: '增量 h (割线→切线)', min: 0.01, max: 2, step: 0.01, defaultValue: 0.5, color: '#f97316' } as SliderParam] : []),
  ];

  const paramValues: Record<string, number> = showSecant ? { 'x₀': x0, h } : { 'x₀': x0 };

  const handleParamChange = useCallback((key: string, value: number) => {
    if (key === 'x₀') setX0(value);
    if (key === 'h') setH(value);
  }, []);

  const tangentSlope = dfn(x0);
  const tangentY0 = fn(x0) - tangentSlope * x0;
  const secantSlope = (fn(x0 + h) - fn(x0)) / h;

  const plotData = useMemo((): Plotly.Data[] => {
    const xMin = -4;
    const xMax = 4;
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

    if (showSecondDeriv) {
      const d2xs: number[] = [];
      const d2ys: number[] = [];
      const concaveUpXs: number[] = [];
      const concaveUpYs: number[] = [];
      const concaveDownXs: number[] = [];
      const concaveDownYs: number[] = [];
      for (let i = 0; i <= 500; i++) {
        const x = xMin + ((xMax - xMin) * i) / 500;
        const d2v = d2fn(x);
        if (!isNaN(d2v) && isFinite(d2v)) {
          d2xs.push(x);
          d2ys.push(d2v);
          if (d2v > 0) { concaveUpXs.push(x); concaveUpYs.push(fn(x)); }
          else { concaveDownXs.push(x); concaveDownYs.push(fn(x)); }
        }
      }
      traces.push({ x: d2xs, y: d2ys, type: 'scatter', mode: 'lines', name: "f''(x)", line: { color: '#f97316', width: 2, dash: 'dash' }, yaxis: 'y2' });
    }

    const tangentXs = [xMin, xMax];
    const tangentYs = [tangentY0 + tangentSlope * xMin, tangentY0 + tangentSlope * xMax];
    traces.push({ x: tangentXs, y: tangentYs, type: 'scatter', mode: 'lines', name: `切线 (斜率=${tangentSlope.toFixed(3)})`, line: { color: '#22c55e', width: 2 } });

    traces.push({ x: [x0], y: [fn(x0)], type: 'scatter', mode: 'markers', name: `切点 (${x0.toFixed(2)}, ${fn(x0).toFixed(2)})`, marker: { color: '#f43f5e', size: 10, symbol: 'circle', line: { width: 2 } } });

    if (showSecant) {
      const secantY0 = fn(x0) - secantSlope * x0;
      const secantXs = [x0 - 2, x0 + h + 2];
      const secantYs = [secantY0 + secantSlope * secantXs[0], secantY0 + secantSlope * secantXs[1]];
      traces.push({ x: secantXs, y: secantYs, type: 'scatter', mode: 'lines', name: `割线 (斜率=${secantSlope.toFixed(3)})`, line: { color: '#f97316', width: 2, dash: 'dot' } });
      traces.push({ x: [x0, x0 + h], y: [fn(x0), fn(x0 + h)], type: 'scatter', mode: 'markers', name: '割线端点', marker: { color: '#f97316', size: 8, symbol: 'diamond' } });
    }

    return traces;
  }, [currentFn, fn, dfn, d2fn, x0, h, tangentSlope, tangentY0, secantSlope, showSecant, showSecondDeriv]);

  const plotLayout = useMemo((): Partial<Plotly.Layout> => {
    const layout: any = {
      title: { text: `导数几何意义: f(x) = ${currentFn.name}`, font: { size: 16, color: '#e2e8f0' } },
      xaxis: { title: { text: 'x' }, gridcolor: '#334155', zerolinecolor: '#475569', range: [-4, 4] },
      yaxis: { title: { text: 'y' }, gridcolor: '#334155', zerolinecolor: '#475569' },
      legend: { bgcolor: 'rgba(15,23,42,0.8)', font: { size: 10, color: '#94a3b8' } },
    };
    if (showSecondDeriv) {
      layout.yaxis2 = { title: { text: "f''(x)" }, overlaying: 'y', side: 'right', gridcolor: '#334155', zerolinecolor: '#475569' };
    }
    return layout;
  }, [currentFn, showSecondDeriv]);

  return (
    <InteractiveCanvas
      scenario={SCENARIO}
      params={params}
      paramValues={paramValues}
      onParamChange={handleParamChange}
      plotData={plotData}
      plotLayout={plotLayout}
      hint="导数 f'(x₀) = lim(h→0) [f(x₀+h)-f(x₀)]/h，即割线斜率的极限。减小 h 观察割线如何逼近切线。"
      extraControls={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ background: '#0f172a', borderRadius: 8, padding: 10, border: '1px solid #334155' }}>
            <h4 style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>导数信息</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#64748b' }}>f'(x₀)</span>
                <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>{tangentSlope.toFixed(4)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#64748b' }}>f(x₀)</span>
                <span style={{ fontSize: 11, color: '#a5b4fc' }}>{fn(x0).toFixed(4)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#64748b' }}>切线方程</span>
                <span style={{ fontSize: 10, color: '#22c55e' }}>y = {tangentSlope.toFixed(2)}x + {(fn(x0) - tangentSlope * x0).toFixed(2)}</span>
              </div>
              {showSecant && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>割线斜率</span>
                  <span style={{ fontSize: 11, color: '#f97316' }}>{secantSlope.toFixed(4)}</span>
                </div>
              )}
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button onClick={() => setShowSecant(!showSecant)} style={{
              padding: '6px 10px', borderRadius: 6, border: showSecant ? '1px solid #f97316' : '1px solid #475569',
              background: showSecant ? 'rgba(249,115,22,0.1)' : 'transparent', color: showSecant ? '#fb923c' : '#94a3b8',
              cursor: 'pointer', fontSize: 11, fontWeight: 600,
            }}>
              {showSecant ? '📐 隐藏割线' : '📐 显示割线 (差分近似)'}
            </button>
            <button onClick={() => setShowSecondDeriv(!showSecondDeriv)} style={{
              padding: '6px 10px', borderRadius: 6, border: showSecondDeriv ? '1px solid #a855f7' : '1px solid #475569',
              background: showSecondDeriv ? 'rgba(168,85,247,0.1)' : 'transparent', color: showSecondDeriv ? '#c084fc' : '#94a3b8',
              cursor: 'pointer', fontSize: 11, fontWeight: 600,
            }}>
              {showSecondDeriv ? "📉 隐藏二阶导数" : "📉 显示二阶导数 (凸凹性)"}
            </button>
          </div>
        </div>
      }
    />
  );
}
