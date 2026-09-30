import { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useCognitiveStore, useGraphStore } from '../stores';
import { useCognitiveState, useRecordInteraction } from '../hooks/useQueries';
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

const MOCK_COGNITIVE: CognitiveState = {
  userId: 'demo-user',
  timestamp: new Date().toISOString(),
  dimensions: { conceptualUnderstanding: 0.72, proceduralFluency: 0.58, strategicCompetence: 0.45, adaptiveReasoning: 0.38 },
  metrics: { cognitiveLoad: 0.65, learningVelocity: 0.55, errorPattern: ['符号混淆', '边界条件遗漏', '计算粗心'], attentionLevel: 0.7, frustrationLevel: 0.35 },
  predictions: { masteryPrediction: [0.72, 0.68, 0.75, 0.80, 0.82, 0.85, 0.88], optimalDifficulty: 0.6, recommendedIntervention: ['增加概念辨析练习', '强化证明推理训练', '减少计算量，聚焦理解'] },
  confidence: 0.75,
  lastUpdated: new Date().toISOString(),
};

const PREVIOUS_COGNITIVE = {
  conceptualUnderstanding: 0.65,
  proceduralFluency: 0.50,
  strategicCompetence: 0.40,
  adaptiveReasoning: 0.32,
};

export default function CognitiveDashboard() {
  const { cognitiveState, setCognitiveState, selectedDimension, setSelectedDimension } = useCognitiveStore();
  const { mastery } = useGraphStore();
  const { data: apiState, isLoading } = useCognitiveState();
  const recordInteraction = useRecordInteraction();
  const [useRealApi, setUseRealApi] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'prediction' | 'patterns'>('overview');

  const state = useMemo(() => {
    if (useRealApi && apiState) return apiState;
    return cognitiveState || MOCK_COGNITIVE;
  }, [useRealApi, apiState, cognitiveState]);

  const currentMastery = Object.keys(mastery).length > 0 ? mastery : MOCK_MASTERY;

  const dimensionRadarOption = useMemo(() => ({
    tooltip: { trigger: 'item' as const, backgroundColor: 'rgba(15,23,42,0.9)', borderColor: '#334155', textStyle: { color: '#e2e8f0' } },
    legend: { data: ['当前水平', '上次评估'], bottom: 0, textStyle: { color: '#94a3b8', fontSize: 11 } },
    radar: {
      indicator: Object.keys(DIMENSION_LABELS).map((key) => ({ name: DIMENSION_LABELS[key], max: 1 })),
      shape: 'polygon' as const,
      splitNumber: 5,
      axisName: { color: '#94a3b8', fontSize: 11 },
      splitLine: { lineStyle: { color: '#334155' } },
      splitArea: { areaStyle: { color: ['rgba(15,23,42,0.3)', 'rgba(30,41,59,0.3)'] } },
      axisLine: { lineStyle: { color: '#475569' } },
    },
    series: [{
      type: 'radar',
      data: [
        {
          value: Object.values(state.dimensions),
          name: '当前水平',
          lineStyle: { color: '#6366f1', width: 2 },
          areaStyle: { color: 'rgba(99,102,241,0.2)' },
          itemStyle: { color: '#6366f1' },
          symbol: 'circle',
          symbolSize: 6,
        },
        {
          value: Object.values(PREVIOUS_COGNITIVE),
          name: '上次评估',
          lineStyle: { color: '#6366f1', width: 1, type: 'dashed' as const },
          areaStyle: { color: 'rgba(99,102,241,0.05)' },
          itemStyle: { color: '#6366f1', opacity: 0.5 },
          symbol: 'circle',
          symbolSize: 4,
        },
      ],
    }],
  }), [state]);

  const metricRadarOption = useMemo(() => ({
    tooltip: { trigger: 'item' as const, backgroundColor: 'rgba(15,23,42,0.9)', borderColor: '#334155', textStyle: { color: '#e2e8f0' } },
    radar: {
      indicator: [
        { name: '认知负荷', max: 1 },
        { name: '学习速度', max: 1 },
        { name: '注意力', max: 1 },
        { name: '挫败感', max: 1 },
      ],
      shape: 'polygon' as const,
      splitNumber: 5,
      axisName: { color: '#94a3b8', fontSize: 11 },
      splitLine: { lineStyle: { color: '#334155' } },
      splitArea: { areaStyle: { color: ['rgba(15,23,42,0.3)', 'rgba(30,41,59,0.3)'] } },
      axisLine: { lineStyle: { color: '#475569' } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: [state.metrics.cognitiveLoad, state.metrics.learningVelocity, state.metrics.attentionLevel, state.metrics.frustrationLevel],
        name: '学习行为指标',
        lineStyle: { color: '#f97316', width: 2 },
        areaStyle: { color: 'rgba(249,115,22,0.2)' },
        itemStyle: { color: '#f97316' },
        symbol: 'circle',
        symbolSize: 6,
      }],
    }],
  }), [state]);

  const predictionOption = useMemo(() => {
    const weeks = state.predictions.masteryPrediction.map((_, i) => `第${i + 1}周`);
    const upper = state.predictions.masteryPrediction.map((v) => Math.min(1, v + 0.05));
    const lower = state.predictions.masteryPrediction.map((v) => Math.max(0, v - 0.05));
    return {
      tooltip: { trigger: 'axis' as const, backgroundColor: 'rgba(15,23,42,0.9)', borderColor: '#334155', textStyle: { color: '#e2e8f0' } },
      legend: { data: ['预测掌握度', '置信区间'], bottom: 0, textStyle: { color: '#94a3b8', fontSize: 11 } },
      grid: { top: 30, right: 20, bottom: 40, left: 50 },
      xAxis: { type: 'category' as const, data: weeks, axisLine: { lineStyle: { color: '#475569' } }, axisLabel: { color: '#94a3b8' } },
      yAxis: { type: 'value' as const, min: 0, max: 1, axisLine: { lineStyle: { color: '#475569' } }, axisLabel: { color: '#94a3b8', formatter: (v: number) => `${Math.round(v * 100)}%` }, splitLine: { lineStyle: { color: '#334155' } } },
      series: [
        {
          name: '置信区间',
          type: 'line',
          data: upper,
          lineStyle: { opacity: 0 },
          areaStyle: { color: 'rgba(99,102,241,0.15)' },
          stack: 'confidence',
          symbol: 'none',
        },
        {
          name: '置信下界',
          type: 'line',
          data: lower,
          lineStyle: { opacity: 0 },
          areaStyle: { color: '#1e293b' },
          stack: 'confidence',
          symbol: 'none',
        },
        {
          name: '预测掌握度',
          type: 'line',
          data: state.predictions.masteryPrediction,
          lineStyle: { color: '#6366f1', width: 3 },
          itemStyle: { color: '#6366f1' },
          symbol: 'circle',
          symbolSize: 8,
          markLine: {
            silent: true,
            data: [{ yAxis: state.predictions.optimalDifficulty, name: '建议难度', lineStyle: { color: '#fbbf24', type: 'dashed' as const }, label: { formatter: '建议难度', color: '#fbbf24', fontSize: 10 } }],
          },
        },
      ],
    };
  }, [state]);

  const masteryHeatmapOption = useMemo(() => {
    const entries = Object.entries(currentMastery);
    const areas = ['极限', '导数', '积分', '级数', '微分方程', '多元微积分'];
    const areaData: { name: string; value: number; children: { name: string; value: number }[] }[] = [];
    const areaMap: Record<string, string[]> = {
      '极限': ['limit_definition', 'limit_properties', 'limit_computation'],
      '导数': ['derivative_definition', 'derivative_rules'],
      '积分': ['integral_definition', 'integral_techniques'],
      '级数': ['series_convergence'],
      '微分方程': [],
      '多元微积分': [],
    };
    areas.forEach((area) => {
      const ids = areaMap[area] || [];
      const children = ids.map((id) => {
        const entry = entries.find(([k]) => k === id);
        return { name: id.replace(/_/g, ' '), value: entry ? entry[1] : 0 };
      });
      const avg = children.length > 0 ? children.reduce((s, c) => s + c.value, 0) / children.length : 0;
      areaData.push({ name: area, value: avg, children });
    });
    return {
      tooltip: { backgroundColor: 'rgba(15,23,42,0.9)', borderColor: '#334155', textStyle: { color: '#e2e8f0' } },
      series: [{
        type: 'treemap',
        data: areaData,
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        label: { show: true, color: '#e2e8f0', fontSize: 12, formatter: (params: any) => `${params.name}\n${Math.round(params.value * 100)}%` },
        itemStyle: { borderColor: '#1e293b', borderWidth: 2, gapWidth: 2 },
        colorMappingBy: 'value',
        color: ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'],
        visualMin: 0,
        visualMax: 1,
        levels: [{ itemStyle: { borderColor: '#334155', borderWidth: 2, gapWidth: 2 } }],
      }],
    };
  }, [currentMastery]);

  const comparisonOption = useMemo(() => {
    const dims = Object.keys(DIMENSION_LABELS);
    const labels = dims.map((k) => DIMENSION_LABELS[k]);
    const personal = dims.map((k) => Math.round((state.dimensions as any)[k] * 100));
    const classAvg = [65, 60, 55, 50];
    return {
      tooltip: { trigger: 'axis' as const, backgroundColor: 'rgba(15,23,42,0.9)', borderColor: '#334155', textStyle: { color: '#e2e8f0' } },
      legend: { data: ['个人', '班级平均'], bottom: 0, textStyle: { color: '#94a3b8', fontSize: 11 } },
      grid: { top: 20, right: 20, bottom: 40, left: 50 },
      xAxis: { type: 'category' as const, data: labels, axisLine: { lineStyle: { color: '#475569' } }, axisLabel: { color: '#94a3b8', fontSize: 10 } },
      yAxis: { type: 'value' as const, max: 100, axisLine: { lineStyle: { color: '#475569' } }, axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: '#334155' } } },
      series: [
        { name: '个人', type: 'bar', data: personal, itemStyle: { color: '#6366f1', borderRadius: [4, 4, 0, 0] }, barWidth: 20 },
        { name: '班级平均', type: 'bar', data: classAvg, itemStyle: { color: '#475569', borderRadius: [4, 4, 0, 0] }, barWidth: 20 },
      ],
    };
  }, [state]);

  const getDiagnosis = (value: number): string => {
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>学习分析舱</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', background: '#1e293b', borderRadius: 8, overflow: 'hidden', border: '1px solid #334155' }}>
              {(['overview', 'prediction', 'patterns'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '6px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: activeTab === tab ? '#6366f1' : 'transparent',
                    color: activeTab === tab ? '#fff' : '#94a3b8',
                  }}
                >
                  {tab === 'overview' ? '总览' : tab === 'prediction' ? '预测' : '模式'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setUseRealApi(false)} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: !useRealApi ? '#6366f1' : '#334155', color: !useRealApi ? '#fff' : '#94a3b8', fontSize: 12, fontWeight: 600 }}>本地</button>
              <button onClick={() => setUseRealApi(true)} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: useRealApi ? '#6366f1' : '#334155', color: useRealApi ? '#fff' : '#94a3b8', fontSize: 12, fontWeight: 600 }}>API</button>
            </div>
          </div>
        </div>

        {activeTab === 'overview' && (
          <>
            <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
              <div style={{ background: '#1e293b', borderRadius: 12, padding: 16, flex: 1, border: '1px solid #334155' }}>
                <h3 style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>四维认知模型</h3>
                <ReactECharts option={dimensionRadarOption} style={{ height: 280 }} />
              </div>
              <div style={{ background: '#1e293b', borderRadius: 12, padding: 16, flex: 1, border: '1px solid #334155' }}>
                <h3 style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>学习行为指标</h3>
                <ReactECharts option={metricRadarOption} style={{ height: 280 }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 20 }}>
              <div style={{ background: '#1e293b', borderRadius: 12, padding: 16, flex: 1, border: '1px solid #334155' }}>
                <h3 style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>知识掌握度分布</h3>
                <ReactECharts option={masteryHeatmapOption} style={{ height: 240 }} />
              </div>
              <div style={{ background: '#1e293b', borderRadius: 12, padding: 16, flex: 1, border: '1px solid #334155' }}>
                <h3 style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>个人 vs 班级平均</h3>
                <ReactECharts option={comparisonOption} style={{ height: 240 }} />
              </div>
            </div>
          </>
        )}

        {activeTab === 'prediction' && (
          <div style={{ background: '#1e293b', borderRadius: 12, padding: 20, border: '1px solid #334155' }}>
            <h3 style={{ fontSize: 14, color: '#94a3b8', marginBottom: 12 }}>掌握度预测趋势（7周）</h3>
            <ReactECharts option={predictionOption} style={{ height: 360 }} />
          </div>
        )}

        {activeTab === 'patterns' && (
          <div style={{ display: 'flex', gap: 20 }}>
            <div style={{ background: '#1e293b', borderRadius: 12, padding: 20, flex: 1, border: '1px solid #334155' }}>
              <h3 style={{ fontSize: 14, color: '#94a3b8', marginBottom: 12 }}>错误模式识别</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {state.metrics.errorPattern.map((pattern, i) => (
                  <div key={i} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 20, padding: '6px 14px', fontSize: 12, color: '#fca5a5' }}>
                    ⚠ {pattern}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: '#1e293b', borderRadius: 12, padding: 20, flex: 1, border: '1px solid #334155' }}>
              <h3 style={{ fontSize: 14, color: '#94a3b8', marginBottom: 12 }}>推荐干预措施</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {state.predictions.recommendedIntervention.map((rec, i) => (
                  <div key={i} style={{ background: '#0f172a', borderRadius: 8, padding: '10px 14px', border: '1px solid #1e3a5f', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>💡</span>
                    <span style={{ fontSize: 12, color: '#93c5fd' }}>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ width: 320, background: '#1e293b', borderLeft: '1px solid #334155', padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 12 }}>认知维度诊断</h3>
          {Object.entries(state.dimensions).map(([key, value]) => (
            <div
              key={key}
              onClick={() => setSelectedDimension(selectedDimension === key ? null : key)}
              style={{
                background: '#0f172a', borderRadius: 8, padding: 12, marginBottom: 8,
                border: selectedDimension === key ? '1px solid #6366f1' : '1px solid #334155',
                cursor: 'pointer', transition: 'border-color 0.2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#cbd5e1' }}>{DIMENSION_LABELS[key]}</span>
                <span style={{ fontSize: 12, color: getDiagnosisColor(value), fontWeight: 600 }}>{getDiagnosis(value)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#334155', overflow: 'hidden' }}>
                  <div style={{ width: `${value * 100}%`, height: '100%', background: getDiagnosisColor(value), borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 700 }}>{Math.round(value * 100)}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: '#0f172a', borderRadius: 8, padding: 12, border: '1px solid #334155' }}>
          <h4 style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>知识点掌握度</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries(currentMastery).map(([id, m]) => {
              const nameMap: Record<string, string> = {
                limit_definition: '极限定义', limit_properties: '极限性质', limit_computation: '极限计算',
                derivative_definition: '导数定义', derivative_rules: '求导法则',
                integral_definition: '积分定义', integral_techniques: '积分技巧',
                series_convergence: '级数收敛',
              };
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: '#cbd5e1', minWidth: 60 }}>{nameMap[id] || id}</span>
                  <div style={{ flex: 1, height: 5, borderRadius: 3, background: '#334155', overflow: 'hidden' }}>
                    <div style={{ width: `${m * 100}%`, height: '100%', background: getMasteryColor(m), borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 10, color: getMasteryColor(m), fontWeight: 600, minWidth: 30 }}>{Math.round(m * 100)}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ background: '#0f172a', borderRadius: 8, padding: 12, border: '1px solid #334155', marginTop: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>模型置信度</span>
            <span style={{ fontSize: 14, color: '#a5b4fc', fontWeight: 700 }}>{Math.round(state.confidence * 100)}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>最优难度</span>
            <span style={{ fontSize: 14, color: '#fbbf24', fontWeight: 700 }}>{Math.round(state.predictions.optimalDifficulty * 100)}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>最后更新</span>
            <span style={{ fontSize: 11, color: '#64748b' }}>{new Date(state.lastUpdated).toLocaleTimeString('zh-CN')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
