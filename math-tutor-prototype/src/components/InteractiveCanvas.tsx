import { type ReactNode, useState } from 'react';
import Plot from 'react-plotly.js';

export interface ScenarioConfig {
  id: string;
  title: string;
  description: string;
  concept: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface SliderParam {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  color?: string;
}

export interface InteractiveCanvasProps {
  scenario: ScenarioConfig;
  params: SliderParam[];
  paramValues: Record<string, number>;
  onParamChange: (key: string, value: number) => void;
  plotData: Plotly.Data[];
  plotLayout: Partial<Plotly.Layout>;
  onVerify?: () => { success: boolean; message: string };
  hint?: string;
  extraControls?: ReactNode;
  score?: number;
  attempts?: number;
}

export default function InteractiveCanvas({
  scenario,
  params,
  paramValues,
  onParamChange,
  plotData,
  plotLayout,
  onVerify,
  hint,
  extraControls,
  score,
  attempts,
}: InteractiveCanvasProps) {
  const [showHint, setShowHint] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleVerify = () => {
    if (!onVerify) return;
    const result = onVerify();
    setVerifyResult(result);
    setTimeout(() => setVerifyResult(null), 3000);
  };

  const difficultyColor = scenario.difficulty === 'easy' ? '#22c55e' : scenario.difficulty === 'medium' ? '#eab308' : '#ef4444';
  const difficultyLabel = scenario.difficulty === 'easy' ? '基础' : scenario.difficulty === 'medium' ? '中等' : '困难';

  return (
    <div style={{ display: 'flex', height: '100%', gap: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <Plot
          data={plotData}
          layout={{
            paper_bgcolor: '#0f172a',
            plot_bgcolor: '#1e293b',
            font: { color: '#94a3b8', family: 'system-ui' },
            margin: { t: 50, r: 20, b: 50, l: 60 },
            ...plotLayout,
          }}
          config={{ responsive: true, displayModeBar: false }}
          style={{ width: '100%', flex: 1 }}
        />
        {verifyResult && (
          <div style={{
            position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 20,
            background: verifyResult.success ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)',
            color: '#fff', padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 700,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', animation: 'fadeIn 0.3s',
          }}>
            {verifyResult.message}
          </div>
        )}
      </div>

      <div style={{
        width: 340, background: '#1e293b', borderLeft: '1px solid #334155',
        padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: difficultyColor,
              background: `${difficultyColor}20`, padding: '2px 8px', borderRadius: 4,
            }}>
              {difficultyLabel}
            </span>
            <span style={{ fontSize: 10, color: '#64748b' }}>{scenario.concept}</span>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>{scenario.title}</h2>
        </div>

        <div style={{ background: '#0f172a', borderRadius: 8, padding: 12, border: '1px solid #334155' }}>
          <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.6 }}>{scenario.description}</p>
        </div>

        <div>
          <h3 style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>参数调节</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {params.map((p) => (
              <div key={p.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{p.label}</span>
                  <span style={{ fontSize: 13, color: p.color || '#a5b4fc', fontWeight: 700 }}>
                    {p.key} = {paramValues[p.key]?.toFixed(p.step < 0.1 ? 3 : 2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  value={paramValues[p.key] ?? p.defaultValue}
                  onChange={(e) => onParamChange(p.key, parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: p.color || '#6366f1' }}
                />
              </div>
            ))}
          </div>
        </div>

        {onVerify && (
          <button
            onClick={handleVerify}
            style={{
              padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff',
              fontSize: 14, fontWeight: 700, transition: 'transform 0.1s',
            }}
          >
            验证结果
          </button>
        )}

        {extraControls}

        {hint && (
          <button
            onClick={() => setShowHint(!showHint)}
            style={{
              padding: '8px 12px', borderRadius: 6, border: '1px solid #475569',
              background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 12,
            }}
          >
            {showHint ? '隐藏提示' : '💡 显示提示'}
          </button>
        )}

        {showHint && hint && (
          <div style={{
            background: '#1c1917', borderRadius: 8, padding: 12, border: '1px solid #92400e',
          }}>
            <p style={{ fontSize: 12, color: '#fbbf24', lineHeight: 1.6 }}>💡 {hint}</p>
          </div>
        )}

        {(score !== undefined || attempts !== undefined) && (
          <div style={{ background: '#0f172a', borderRadius: 8, padding: 12, border: '1px solid #334155', marginTop: 'auto' }}>
            {score !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>得分</span>
                <span style={{ fontSize: 14, color: '#a5b4fc', fontWeight: 700 }}>{score}</span>
              </div>
            )}
            {attempts !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>尝试次数</span>
                <span style={{ fontSize: 14, color: '#fbbf24', fontWeight: 700 }}>{attempts}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
