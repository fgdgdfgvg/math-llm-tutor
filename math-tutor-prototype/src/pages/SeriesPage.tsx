import { useState, useMemo, useCallback } from 'react';
import InteractiveCanvas, { type SliderParam, type ScenarioConfig } from '../components/InteractiveCanvas';

type SeriesType = 'taylor' | 'fourier';

const TAYLOR_FUNCTIONS: { id: string; name: string; fn: (x: number) => number; center: number; taylorCoeffs: number[] }[] = [
  { id: 'exp', name: 'eˣ', fn: (x) => Math.exp(x), center: 0, taylorCoeffs: [1, 1, 1 / 2, 1 / 6, 1 / 24, 1 / 120, 1 / 720, 1 / 5040, 1 / 40320, 1 / 362880, 1 / 3628800] },
  { id: 'sin', name: 'sin(x)', fn: (x) => Math.sin(x), center: 0, taylorCoeffs: [0, 1, 0, -1 / 6, 0, 1 / 120, 0, -1 / 5040, 0, 1 / 362880, 0] },
  { id: 'cos', name: 'cos(x)', fn: (x) => Math.cos(x), center: 0, taylorCoeffs: [1, 0, -1 / 2, 0, 1 / 24, 0, -1 / 720, 0, 1 / 40320, 0, -1 / 3628800] },
  { id: 'ln', name: 'ln(1+x)', fn: (x) => (x > -1 ? Math.log(1 + x) : NaN), center: 0, taylorCoeffs: [0, 1, -1 / 2, 1 / 3, -1 / 4, 1 / 5, -1 / 6, 1 / 7, -1 / 8, 1 / 9, -1 / 10] },
];

const SCENARIO: ScenarioConfig = {
  id: 'series',
  title: '级数收敛与逼近探索器',
  description: '泰勒级数用多项式逼近函数，随着项数增加，近似曲线逐渐逼近原函数。观察收敛半径、误差分布，以及傅里叶级数如何合成方波。',
  concept: '级数收敛',
  difficulty: 'hard',
};

function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function taylorApprox(x: number, center: number, coeffs: number[], terms: number): number {
  let sum = 0;
  for (let k = 0; k < terms && k < coeffs.length; k++) {
    sum += coeffs[k] * Math.pow(x - center, k);
  }
  return sum;
}

function fourierSquareWave(x: number, terms: number): number {
  let sum = 0;
  for (let k = 0; k < terms; k++) {
    const n = 2 * k + 1;
    sum += (4 / (n * Math.PI)) * Math.sin(n * x);
  }
  return sum;
}

export default function SeriesPage() {
  const [seriesType, setSeriesType] = useState<SeriesType>('taylor');
  const [selectedFn, setSelectedFn] = useState(0);
  const [terms, setTerms] = useState(3);
  const [showError, setShowError] = useState(false);
  const [fourierTerms, setFourierTerms] = useState(3);

  const currentFn = TAYLOR_FUNCTIONS[selectedFn];

  const params: SliderParam[] = seriesType === 'taylor'
    ? [{ key: 'n', label: '泰勒展开项数', min: 1, max: 10, step: 1, defaultValue: 3, color: '#6366f1' }]
    : [{ key: 'n', label: '傅里叶谐波数', min: 1, max: 20, step: 1, defaultValue: 3, color: '#f97316' }];

  const paramValues = { n: seriesType === 'taylor' ? terms : fourierTerms };

  const handleParamChange = useCallback((key: string, value: number) => {
    if (key === 'n') {
      if (seriesType === 'taylor') setTerms(Math.round(value));
      else setFourierTerms(Math.round(value));
    }
  }, [seriesType]);

  const plotData = useMemo((): Plotly.Data[] => {
    if (seriesType === 'taylor') {
      const { fn, center, taylorCoeffs } = currentFn;
      const xMin = center - 5;
      const xMax = center + 5;
      const xs: number[] = [];
      const exactYs: number[] = [];
      const approxYs: number[] = [];
      const errorYs: number[] = [];
      for (let i = 0; i <= 500; i++) {
        const x = xMin + ((xMax - xMin) * i) / 500;
        xs.push(x);
        const exact = fn(x);
        const approx = taylorApprox(x, center, taylorCoeffs, terms);
        exactYs.push(exact);
        approxYs.push(approx);
        errorYs.push(Math.abs(exact - approx));
      }

      const traces: Plotly.Data[] = [
        { x: xs, y: exactYs, type: 'scatter', mode: 'lines', name: `f(x) = ${currentFn.name}`, line: { color: '#818cf8', width: 3 } },
        { x: xs, y: approxYs, type: 'scatter', mode: 'lines', name: `泰勒近似 (n=${terms})`, line: { color: '#22c55e', width: 2, dash: 'dash' } },
      ];

      if (showError) {
        traces.push({ x: xs, y: errorYs, type: 'scatter', mode: 'lines', name: '绝对误差', line: { color: '#ef4444', width: 1 }, fill: 'tozeroy', fillcolor: 'rgba(239,68,68,0.1)', yaxis: 'y2' });
      }

      return traces;
    } else {
      const xs: number[] = [];
      const squareYs: number[] = [];
      const approxYs: number[] = [];
      for (let i = 0; i <= 500; i++) {
        const x = -3 * Math.PI + (6 * Math.PI * i) / 500;
        xs.push(x);
        squareYs.push(x % (2 * Math.PI) >= 0 && x % (2 * Math.PI) < Math.PI ? 1 : -1);
        approxYs.push(fourierSquareWave(x, fourierTerms));
      }

      return [
        { x: xs, y: squareYs, type: 'scatter', mode: 'lines', name: '方波', line: { color: '#818cf8', width: 2 } },
        { x: xs, y: approxYs, type: 'scatter', mode: 'lines', name: `傅里叶近似 (n=${fourierTerms})`, line: { color: '#f97316', width: 2 } },
      ];
    }
  }, [seriesType, currentFn, terms, fourierTerms, showError]);

  const plotLayout = useMemo((): Partial<Plotly.Layout> => {
    if (seriesType === 'taylor') {
      const layout: any = {
        title: { text: `泰勒级数逼近: ${currentFn.name}`, font: { size: 16, color: '#e2e8f0' } },
        xaxis: { title: { text: 'x' }, gridcolor: '#334155', zerolinecolor: '#475569', range: [currentFn.center - 5, currentFn.center + 5] },
        yaxis: { title: { text: 'y' }, gridcolor: '#334155', zerolinecolor: '#475569' },
        legend: { bgcolor: 'rgba(15,23,42,0.8)', font: { size: 10, color: '#94a3b8' } },
      };
      if (showError) {
        layout.yaxis2 = { title: { text: '误差' }, overlaying: 'y', side: 'right', gridcolor: '#334155' };
      }
      return layout;
    }
    return {
      title: { text: '傅里叶级数: 方波合成', font: { size: 16, color: '#e2e8f0' } },
      xaxis: { title: { text: 'x' }, gridcolor: '#334155', zerolinecolor: '#475569', range: [-3 * Math.PI, 3 * Math.PI] },
      yaxis: { title: { text: 'y' }, gridcolor: '#334155', zerolinecolor: '#475569', range: [-1.5, 1.5] },
      legend: { bgcolor: 'rgba(15,23,42,0.8)', font: { size: 10, color: '#94a3b8' } },
    };
  }, [seriesType, currentFn, showError]);

  return (
    <InteractiveCanvas
      scenario={SCENARIO}
      params={params}
      paramValues={paramValues}
      onParamChange={handleParamChange}
      plotData={plotData}
      plotLayout={plotLayout}
      hint={seriesType === 'taylor'
        ? '泰勒级数 f(x) = Σ f⁽ᵏ⁾(a)/k! · (x-a)ᵏ。增加项数观察近似曲线如何逼近原函数，注意收敛半径外的发散行为。'
        : '傅里叶级数将周期函数分解为正弦和余弦函数的叠加。方波的吉布斯现象：在不连续点附近总是有过冲。'}
      extraControls={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setSeriesType('taylor')} style={{
              flex: 1, padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: seriesType === 'taylor' ? '#6366f1' : '#334155', color: seriesType === 'taylor' ? '#fff' : '#94a3b8',
              fontSize: 11, fontWeight: 600,
            }}>
              泰勒级数
            </button>
            <button onClick={() => setSeriesType('fourier')} style={{
              flex: 1, padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: seriesType === 'fourier' ? '#f97316' : '#334155', color: seriesType === 'fourier' ? '#fff' : '#94a3b8',
              fontSize: 11, fontWeight: 600,
            }}>
              傅里叶级数
            </button>
          </div>

          {seriesType === 'taylor' && (
            <>
              <div style={{ background: '#0f172a', borderRadius: 8, padding: 10, border: '1px solid #334155' }}>
                <h4 style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>泰勒公式</h4>
                <p style={{ fontSize: 10, color: '#a5b4fc', lineHeight: 1.5 }}>
                  f(x) = Σ f⁽ᵏ⁾({currentFn.center})/k! · (x-{currentFn.center})ᵏ
                </p>
                <p style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                  当前展开至第 {terms} 阶
                </p>
              </div>

              <h4 style={{ fontSize: 12, color: '#94a3b8' }}>选择函数</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {TAYLOR_FUNCTIONS.map((f, i) => (
                  <button key={f.id} onClick={() => setSelectedFn(i)} style={{
                    padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: i === selectedFn ? '#6366f1' : '#334155', color: i === selectedFn ? '#fff' : '#94a3b8',
                    fontSize: 11, fontWeight: 600, textAlign: 'left',
                  }}>
                    f(x) = {f.name}
                  </button>
                ))}
              </div>

              <button onClick={() => setShowError(!showError)} style={{
                padding: '6px 10px', borderRadius: 6, border: showError ? '1px solid #ef4444' : '1px solid #475569',
                background: showError ? 'rgba(239,68,68,0.1)' : 'transparent', color: showError ? '#fca5a5' : '#94a3b8',
                cursor: 'pointer', fontSize: 11, fontWeight: 600,
              }}>
                {showError ? '隐藏误差分布' : '📊 显示误差分布'}
              </button>
            </>
          )}

          {seriesType === 'fourier' && (
            <div style={{ background: '#0f172a', borderRadius: 8, padding: 10, border: '1px solid #334155' }}>
              <h4 style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>傅里叶公式</h4>
              <p style={{ fontSize: 10, color: '#f97316', lineHeight: 1.5 }}>
                f(x) = Σ (4/(nπ))·sin(nx), n=1,3,5,...
              </p>
              <p style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                当前 {fourierTerms} 个谐波叠加
              </p>
            </div>
          )}
        </div>
      }
    />
  );
}
