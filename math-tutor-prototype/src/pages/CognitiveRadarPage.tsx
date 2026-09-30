import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { interactiveLearningApi } from '../services/api';
import { MOCK_MASTERY, getMasteryColor } from '../services/mockData';
import type { CognitiveState } from '../types';

const DIMENSION_LABELS: Record<string, string> = {
  conceptualUnderstanding: '概念理解',
  proceduralFluency: '过程流畅度',
  strategicCompetence: '策略能力',
  adaptiveReasoning: '适应性推理',
};

const METRIC_LABELS: Record<string, string> = {
  cognitiveLoad: '认知负荷',
  learningVelocity: '学习速度',
  attentionLevel: '注意力水平',
  frustrationLevel: '挫败感',
};

const MOCK_COGNITIVE_STATE: CognitiveState = {
  userId: 'demo-user',
  timestamp: new Date().toISOString(),
  dimensions: {
    conceptualUnderstanding: 0.72,
    proceduralFluency: 0.58,
    strategicCompetence: 0.45,
    adaptiveReasoning: 0.38,
  },
  metrics: {
    cognitiveLoad: 0.65,
    learningVelocity: 0.55,
    errorPattern: ['符号混淆', '边界条件遗漏', '计算粗心'],
    attentionLevel: 0.7,
    frustrationLevel: 0.35,
  },
  predictions: {
    masteryPrediction: [0.72, 0.68, 0.75, 0.80, 0.82],
    optimalDifficulty: 0.6,
    recommendedIntervention: ['增加概念辨析练习', '强化证明推理训练', '减少计算量，聚焦理解'],
  },
  confidence: 0.75,
  lastUpdated: new Date().toISOString(),
};

function drawRadarChart(
  svgEl: SVGSVGElement,
  data: { axis: string; value: number; fullMark: number }[],
  color: string,
  size: number,
) {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const width = size;
  const height = size;
  const margin = 40;
  const radius = (Math.min(width, height) / 2) - margin;
  const levels = 5;

  const g = svg
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${width / 2},${height / 2})`);

  const allAxis = data.map((d) => d.axis);
  const total = allAxis.length;
  const angleSlice = (Math.PI * 2) / total;

  const rScale = d3.scaleLinear().domain([0, 1]).range([0, radius]);

  for (let level = 0; level < levels; level++) {
    const levelValue = (level + 1) / levels;
    g.append('circle')
      .attr('r', rScale(levelValue))
      .style('fill', '#0f172a')
      .style('stroke', '#334155')
      .style('stroke-width', 0.5);
  }

  const axis = g.selectAll('.axis').data(allAxis).enter().append('g').attr('class', 'axis');

  axis.append('line')
    .attr('x1', 0).attr('y1', 0)
    .attr('x2', (_d, i) => rScale(1) * Math.cos(angleSlice * i - Math.PI / 2))
    .attr('y2', (_d, i) => rScale(1) * Math.sin(angleSlice * i - Math.PI / 2))
    .style('stroke', '#475569')
    .style('stroke-width', 1);

  axis.append('text')
    .attr('class', 'legend')
    .style('font-size', '11px')
    .style('fill', '#94a3b8')
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .attr('x', (_d, i) => (rScale(1) + 20) * Math.cos(angleSlice * i - Math.PI / 2))
    .attr('y', (_d, i) => (rScale(1) + 20) * Math.sin(angleSlice * i - Math.PI / 2))
    .text((d) => d);

  const radarLine = d3
    .lineRadial<{ axis: string; value: number }>()
    .radius((d) => rScale(d.value))
    .angle((_d, i) => i * angleSlice);

  g.append('path')
    .datum(data)
    .attr('d', radarLine as unknown as string)
    .style('fill', color)
    .style('fill-opacity', 0.2)
    .style('stroke', color)
    .style('stroke-width', 2);

  g.selectAll('.dot')
    .data(data)
    .enter()
    .append('circle')
    .attr('r', 5)
    .attr('cx', (_d, i) => rScale(data[i].value) * Math.cos(angleSlice * i - Math.PI / 2))
    .attr('cy', (_d, i) => rScale(data[i].value) * Math.sin(angleSlice * i - Math.PI / 2))
    .style('fill', color)
    .style('fill-opacity', 0.8)
    .style('stroke', '#fff')
    .style('stroke-width', 1.5);
}

export default function CognitiveRadarPage() {
  const radarRef1 = useRef<SVGSVGElement>(null);
  const radarRef2 = useRef<SVGSVGElement>(null);
  const [cognitiveState, setCognitiveState] = useState<CognitiveState>(MOCK_COGNITIVE_STATE);
  const [useRealApi, setUseRealApi] = useState(false);
  const [selectedDimension, setSelectedDimension] = useState<string | null>(null);
  const [conceptMastery, setConceptMastery] = useState(MOCK_MASTERY);

  const loadData = useCallback(async () => {
    if (useRealApi) {
      try {
        const state = await interactiveLearningApi.getCognitiveState();
        setCognitiveState(state);
      } catch {
        setCognitiveState(MOCK_COGNITIVE_STATE);
      }
      try {
        const dynamicData = await interactiveLearningApi.getDynamicGraph();
        const mastery: Record<string, number> = {};
        dynamicData.nodes.forEach((n) => {
          mastery[n.id] = n.masteryLevel;
        });
        setConceptMastery(mastery);
      } catch {
        setConceptMastery(MOCK_MASTERY);
      }
    } else {
      setCognitiveState(MOCK_COGNITIVE_STATE);
      setConceptMastery(MOCK_MASTERY);
    }
  }, [useRealApi]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!radarRef1.current || !radarRef1.current) return;

    const dimensionData = Object.entries(cognitiveState.dimensions).map(([key, value]) => ({
      axis: DIMENSION_LABELS[key] || key,
      value,
      fullMark: 1,
    }));
    drawRadarChart(radarRef1.current, dimensionData, '#6366f1', 340);

    const metricData = [
      { axis: METRIC_LABELS.cognitiveLoad, value: cognitiveState.metrics.cognitiveLoad, fullMark: 1 },
      { axis: METRIC_LABELS.learningVelocity, value: cognitiveState.metrics.learningVelocity, fullMark: 1 },
      { axis: METRIC_LABELS.attentionLevel, value: cognitiveState.metrics.attentionLevel, fullMark: 1 },
      { axis: METRIC_LABELS.frustrationLevel, value: cognitiveState.metrics.frustrationLevel, fullMark: 1 },
    ];
    drawRadarChart(radarRef2.current!, metricData, '#f97316', 300);
  }, [cognitiveState]);

  const getDiagnosis = (dim: string, value: number): string => {
    if (value >= 0.7) return '良好';
    if (value >= 0.5) return '一般';
    if (value >= 0.3) return '需加强';
    return '薄弱';
  };

  const getDiagnosisColor = (value: number): string => {
    if (value >= 0.7) return '#22c55e';
    if (value >= 0.5) return '#eab308';
    if (value >= 0.3) return '#f97316';
    return '#ef4444';
  };

  return (
    <div style={{ display: 'flex', height: '100%', gap: 0 }}>
      <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20,
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>认知状态仪表盘</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setUseRealApi(false)}
              style={{
                padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: !useRealApi ? '#6366f1' : '#334155', color: !useRealApi ? '#fff' : '#94a3b8',
                fontSize: 12, fontWeight: 600,
              }}
            >
              本地数据
            </button>
            <button
              onClick={() => setUseRealApi(true)}
              style={{
                padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: useRealApi ? '#6366f1' : '#334155', color: useRealApi ? '#fff' : '#94a3b8',
                fontSize: 12, fontWeight: 600,
              }}
            >
              后端API
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
          <div style={{
            background: '#1e293b', borderRadius: 12, padding: 20, flex: 1,
            border: '1px solid #334155',
          }}>
            <h3 style={{ fontSize: 14, color: '#94a3b8', marginBottom: 12 }}>四维认知模型</h3>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <svg ref={radarRef1} />
            </div>
          </div>

          <div style={{
            background: '#1e293b', borderRadius: 12, padding: 20, flex: 1,
            border: '1px solid #334155',
          }}>
            <h3 style={{ fontSize: 14, color: '#94a3b8', marginBottom: 12 }}>学习行为指标</h3>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <svg ref={radarRef2} />
            </div>
          </div>
        </div>

        <div style={{
          background: '#1e293b', borderRadius: 12, padding: 20,
          border: '1px solid #334155', marginBottom: 24,
        }}>
          <h3 style={{ fontSize: 14, color: '#94a3b8', marginBottom: 12 }}>知识点掌握度分布</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(conceptMastery).map(([id, mastery]) => {
              const nameMap: Record<string, string> = {
                limit_definition: '极限的定义',
                limit_properties: '极限的性质',
                limit_computation: '极限的计算',
                derivative_definition: '导数的定义',
                derivative_rules: '求导法则',
                integral_definition: '积分的定义',
                integral_techniques: '积分技巧',
                series_convergence: '级数收敛',
              };
              return (
                <div
                  key={id}
                  onClick={() => setSelectedDimension(selectedDimension === id ? null : id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                    padding: '6px 8px', borderRadius: 6,
                    background: selectedDimension === id ? 'rgba(99,102,241,0.1)' : 'transparent',
                  }}
                >
                  <span style={{ fontSize: 12, color: '#cbd5e1', minWidth: 80 }}>
                    {nameMap[id] || id}
                  </span>
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#334155', overflow: 'hidden' }}>
                    <div style={{
                      width: `${mastery * 100}%`, height: '100%',
                      background: getMasteryColor(mastery), borderRadius: 4,
                      transition: 'width 0.3s',
                    }} />
                  </div>
                  <span style={{ fontSize: 12, color: getMasteryColor(mastery), fontWeight: 600, minWidth: 40 }}>
                    {Math.round(mastery * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {cognitiveState.predictions.masteryPrediction.length > 0 && (
          <div style={{
            background: '#1e293b', borderRadius: 12, padding: 20,
            border: '1px solid #334155',
          }}>
            <h3 style={{ fontSize: 14, color: '#94a3b8', marginBottom: 12 }}>掌握度预测趋势</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 80 }}>
              {cognitiveState.predictions.masteryPrediction.map((val, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: '100%', height: `${val * 100}%`,
                    background: `linear-gradient(to top, #6366f1, #a855f7)`,
                    borderRadius: 4, minHeight: 4,
                  }} />
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>第{i + 1}周</span>
                  <span style={{ fontSize: 10, color: '#a5b4fc' }}>{Math.round(val * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{
        width: 320, background: '#1e293b', borderLeft: '1px solid #334155',
        padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 12 }}>认知维度诊断</h3>
          {Object.entries(cognitiveState.dimensions).map(([key, value]) => (
            <div key={key} style={{
              background: '#0f172a', borderRadius: 8, padding: 12, marginBottom: 8,
              border: selectedDimension === key ? '1px solid #6366f1' : '1px solid #334155',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#cbd5e1' }}>{DIMENSION_LABELS[key]}</span>
                <span style={{ fontSize: 12, color: getDiagnosisColor(value), fontWeight: 600 }}>
                  {getDiagnosis(key, value)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#334155', overflow: 'hidden' }}>
                  <div style={{
                    width: `${value * 100}%`, height: '100%',
                    background: getDiagnosisColor(value), borderRadius: 3,
                  }} />
                </div>
                <span style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 700 }}>
                  {Math.round(value * 100)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 12 }}>错误模式</h3>
          {cognitiveState.metrics.errorPattern.map((pattern, i) => (
            <div key={i} style={{
              background: '#0f172a', borderRadius: 6, padding: '8px 12px', marginBottom: 4,
              border: '1px solid #7f1d1d',
            }}>
              <span style={{ fontSize: 12, color: '#fca5a5' }}>⚠ {pattern}</span>
            </div>
          ))}
        </div>

        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 12 }}>推荐干预</h3>
          {cognitiveState.predictions.recommendedIntervention.map((rec, i) => (
            <div key={i} style={{
              background: '#0f172a', borderRadius: 6, padding: '8px 12px', marginBottom: 4,
              border: '1px solid #1e3a5f',
            }}>
              <span style={{ fontSize: 12, color: '#93c5fd' }}>💡 {rec}</span>
            </div>
          ))}
        </div>

        <div style={{
          background: '#0f172a', borderRadius: 8, padding: 12,
          border: '1px solid #334155', marginTop: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>模型置信度</span>
            <span style={{ fontSize: 14, color: '#a5b4fc', fontWeight: 700 }}>
              {Math.round(cognitiveState.confidence * 100)}%
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>最优难度</span>
            <span style={{ fontSize: 14, color: '#fbbf24', fontWeight: 700 }}>
              {Math.round(cognitiveState.predictions.optimalDifficulty * 100)}%
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>最后更新</span>
            <span style={{ fontSize: 11, color: '#64748b' }}>
              {new Date(cognitiveState.lastUpdated).toLocaleTimeString('zh-CN')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
