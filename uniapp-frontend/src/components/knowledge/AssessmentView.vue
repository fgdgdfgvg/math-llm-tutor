<template>
  <view class="assessment-view">
    <view class="page-header">
      <text class="page-title">认知状态分析</text>
      <text class="page-subtitle">四维认知模型 · 多维度学习评估 · 智能干预</text>
    </view>

    <view v-if="loading" class="state-block">
      <text class="state-text">正在分析你的学习数据...</text>
    </view>

    <view v-else-if="!hasPracticeData" class="state-block empty">
      <text class="empty-icon">🧠</text>
      <text class="state-text">还没有可用于评估的练习数据</text>
      <text class="state-subtext">完成几道专项练习后，这里会按你的真实答题记录生成认知状态分析</text>
      <button class="state-btn" @click="goPractice">去练习</button>
    </view>

    <template v-else>
      <view class="tabs">
        <view
          v-for="tab in tabs"
          :key="tab.key"
          class="tab-item"
          :class="{ 'tab-active': activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </view>
      </view>

      <view v-show="activeTab === 'overview'">
        <view class="radar-section">
          <text class="section-title">四维认知模型</text>
          <view class="radar-chart-container">
            <view id="cognitiveRadar" class="radar-chart"></view>
          </view>
          <view class="dimension-cards">
            <view
              v-for="key in dimensionKeys"
              :key="key"
              class="dimension-card"
              :style="{ borderLeftColor: getDimensionColor(cognitiveState.dimensions[key]) }"
            >
              <view class="dim-header">
                <text class="dim-name">{{ dimensionLabels[key] }}</text>
                <text class="dim-status" :style="{ color: getDimensionColor(cognitiveState.dimensions[key]) }">
                  {{ getDiagnosis(cognitiveState.dimensions[key]) }}
                </text>
              </view>
              <view class="dim-bar-container">
                <view class="dim-bar" :style="{ width: (cognitiveState.dimensions[key] * 100) + '%', background: getDimensionColor(cognitiveState.dimensions[key]) }"></view>
              </view>
              <text class="dim-value">{{ Math.round(cognitiveState.dimensions[key] * 100) }}%</text>
            </view>
          </view>
        </view>

        <view class="metrics-section">
          <text class="section-title">学习行为指标</text>
          <view class="radar-chart-container">
            <view id="metricsRadar" class="radar-chart"></view>
          </view>
        </view>
      </view>

      <view v-show="activeTab === 'knowledge'">
        <view class="metrics-section">
          <text class="section-title">知识点掌握度 vs 掌握线（80%）</text>
          <view class="comparison-chart-container">
            <view id="comparisonChart" class="comparison-chart"></view>
          </view>
        </view>

        <view class="metrics-section">
          <text class="section-title">待加强知识点</text>
          <view v-if="weakKnowledge.length === 0" class="state-text">全部练习过的知识点都已达到掌握线</view>
          <view class="pattern-list">
            <view
              v-for="item in weakKnowledge"
              :key="item.conceptId"
              class="pattern-item weak"
              @click="practiceKnowledgePoint(item.conceptId)"
            >
              <text class="pattern-icon">⚠</text>
              <text class="pattern-text">
                {{ item.conceptId }} · 掌握度 {{ item.mastery }}% · 练习 {{ item.attemptsCount }} 次（错 {{ item.incorrectCount }} 次）
              </text>
              <text class="rec-arrow">→</text>
            </view>
          </view>
        </view>
      </view>

      <view v-show="activeTab === 'patterns'">
        <view class="prediction-section">
          <text class="section-title">掌握度预测趋势（依据当前学习速度推算）</text>
          <view class="prediction-chart-container">
            <view id="predictionChart" class="prediction-chart"></view>
          </view>
        </view>

        <view class="error-patterns">
          <text class="section-title">错误模式识别</text>
          <view v-if="cognitiveState.metrics.errorPattern.length === 0" class="state-text">暂未识别到明显错误模式</view>
          <view class="pattern-list">
            <view v-for="(pattern, index) in cognitiveState.metrics.errorPattern" :key="index" class="pattern-item">
              <text class="pattern-icon">⚠</text>
              <text class="pattern-text">{{ pattern }}</text>
            </view>
          </view>
        </view>

        <view class="interventions">
          <text class="section-title">推荐干预措施</text>
          <view v-if="cognitiveState.predictions.recommendedIntervention.length === 0" class="state-text">暂无干预建议</view>
          <view class="intervention-list">
            <view v-for="(rec, index) in interventionList" :key="index" class="intervention-item">
              <text class="intervention-icon">{{ rec.icon }}</text>
              <text class="intervention-text">{{ rec.text }}</text>
            </view>
          </view>
        </view>

        <view class="scenario-recommendation">
          <text class="section-title">场景推荐</text>
          <view class="recommendation-list">
            <view
              v-for="rec in scenarioRecommendations"
              :key="rec.id"
              class="recommendation-item"
              @click="goToScenario(rec.id)"
            >
              <view class="rec-icon">{{ rec.icon }}</view>
              <view class="rec-content">
                <text class="rec-title">{{ rec.title }}</text>
                <text class="rec-desc">{{ rec.reason }}</text>
              </view>
              <text class="rec-arrow">→</text>
            </view>
          </view>
        </view>
      </view>

      <view class="confidence-card">
        <view class="confidence-row">
          <text class="confidence-label">模型置信度</text>
          <text class="confidence-value">{{ Math.round(cognitiveState.confidence * 100) }}%</text>
        </view>
        <view class="confidence-row">
          <text class="confidence-label">最优难度</text>
          <text class="confidence-value" style="color: #fbbf24;">{{ Math.round(cognitiveState.predictions.optimalDifficulty * 100) }}%</text>
        </view>
        <view class="confidence-row">
          <text class="confidence-label">练习过的知识点</text>
          <text class="confidence-value">{{ practiceRecords.length }} 个</text>
        </view>
        <view class="confidence-row">
          <text class="confidence-label">最后更新</text>
          <text class="confidence-value" style="color: #64748b; font-size: 12px;">{{ formatTime(cognitiveState.lastUpdated) }}</text>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import * as echarts from 'echarts'
import request from '@/utils/request'
import { useCognitiveStore } from '@/stores/cognitive'

interface CognitiveState {
  dimensions: {
    conceptualUnderstanding: number
    proceduralFluency: number
    strategicCompetence: number
    adaptiveReasoning: number
  }
  metrics: {
    cognitiveLoad: number
    learningVelocity: number
    errorPattern: string[]
    attentionLevel: number
    frustrationLevel: number
  }
  predictions: {
    masteryPrediction: number[]
    optimalDifficulty: number
    recommendedIntervention: string[]
  }
  confidence: number
  lastUpdated: string
}

interface KnowledgeRecord {
  conceptId: string
  masteryLevel: number
  attemptsCount: number
  correctCount: number
  incorrectCount: number
  lastPracticed?: string
}

const cognitiveStore = useCognitiveStore()

const dimensionLabels: Record<string, string> = {
  conceptualUnderstanding: '概念理解',
  proceduralFluency: '过程流畅度',
  strategicCompetence: '策略能力',
  adaptiveReasoning: '适应性推理',
}

const dimensionKeys = Object.keys(dimensionLabels) as (keyof typeof cognitiveState.dimensions)[]

const metricLabels: Record<string, string> = {
  cognitiveLoad: '认知负荷',
  learningVelocity: '学习速度',
  attentionLevel: '注意力水平',
  frustrationLevel: '挫败感',
}

const emptyCognitiveState: CognitiveState = {
  dimensions: {
    conceptualUnderstanding: 0,
    proceduralFluency: 0,
    strategicCompetence: 0,
    adaptiveReasoning: 0,
  },
  metrics: {
    cognitiveLoad: 0,
    learningVelocity: 0,
    errorPattern: [],
    attentionLevel: 0,
    frustrationLevel: 0,
  },
  predictions: {
    masteryPrediction: [],
    optimalDifficulty: 0.5,
    recommendedIntervention: [],
  },
  confidence: 0,
  lastUpdated: new Date().toISOString(),
}

const cognitiveState = reactive<CognitiveState>({ ...emptyCognitiveState })
const practiceRecords = ref<KnowledgeRecord[]>([])
const loading = ref(true)
const activeTab = ref('overview')

const tabs = [
  { key: 'overview', label: '总览' },
  { key: 'knowledge', label: '知识点' },
  { key: 'patterns', label: '预测与干预' },
]

/** 只有真实练习过的知识点才参与评估 */
const hasPracticeData = computed(() =>
  practiceRecords.value.some((record) => (record.attemptsCount || 0) > 0),
)

/**
 * 后端给出的是干预代码（take_break / hint ...），直接展示会露出一串英文
 * 代码。这里翻译成可执行的中文建议，未知代码保留原文方便排查。
 */
const INTERVENTION_TEXTS: Record<string, { icon: string; text: string }> = {
  take_break: { icon: '☕', text: '认知负荷偏高：先休息 10 分钟，再继续下一组练习' },
  review_prerequisite: { icon: '🔙', text: '概念理解偏弱：回到前置知识点（如极限的定义、导数的定义）重新看一遍' },
  hint: { icon: '💡', text: '解题过程不够流畅：先看提示，再独立完整地做一遍同类题' },
  challenge: { icon: '🚀', text: '理解与技巧都已达标：可以尝试更高难度的综合题' },
  switch_method: { icon: '🔄', text: '当前方法效果一般：换一种思路（如换元积分、分部积分）重做一次' },
  data_unavailable: { icon: '📉', text: '练习数据不足，多完成几道题后再查看分析' },
}

const interventionList = computed(() =>
  cognitiveState.predictions.recommendedIntervention.map((code) =>
    INTERVENTION_TEXTS[code] || { icon: '💡', text: code },
  ),
)

const weakKnowledge = computed(() =>
  practiceRecords.value
    .filter((record) => (record.attemptsCount || 0) > 0 && (record.masteryLevel || 0) < 0.8)
    .sort((a, b) => (a.masteryLevel || 0) - (b.masteryLevel || 0))
    .map((record) => ({
      conceptId: record.conceptId,
      mastery: Math.round((record.masteryLevel || 0) * 100),
      attemptsCount: record.attemptsCount || 0,
      incorrectCount: record.incorrectCount || 0,
    })),
)

const scenarioRecommendations = computed(() => {
  const recs: { id: string; icon: string; title: string; reason: string }[] = []
  const dims = cognitiveState.dimensions

  if (dims.conceptualUnderstanding < 0.6) {
    recs.push({
      id: 'epsilon-delta',
      icon: '📐',
      title: 'ε-δ 极限探索',
      reason: '概念理解不足，建议通过交互式可视化加深对极限定义的理解',
    })
  }
  if (dims.proceduralFluency < 0.6) {
    recs.push({
      id: 'derivative',
      icon: '📈',
      title: '导数几何意义',
      reason: '过程流畅度较低，建议通过割线→切线动画练习导数计算',
    })
  }
  if (dims.strategicCompetence < 0.5) {
    recs.push({
      id: 'integral',
      icon: '∫',
      title: '黎曼和与积分',
      reason: '策略能力需加强，建议通过调整分割数理解积分策略',
    })
  }
  if (dims.adaptiveReasoning < 0.5) {
    recs.push({
      id: 'series',
      icon: 'Σ',
      title: '级数逼近',
      reason: '适应性推理薄弱，建议通过泰勒/傅里叶展开培养推理能力',
    })
  }

  if (recs.length === 0) {
    recs.push({
      id: 'epsilon-delta',
      icon: '🎯',
      title: '自由探索',
      reason: '各项指标良好，可以自由选择任意场景深入学习',
    })
  }
  return recs
})

let cognitiveRadarInstance: echarts.ECharts | null = null
let metricsRadarInstance: echarts.ECharts | null = null
let predictionChartInstance: echarts.ECharts | null = null
let comparisonChartInstance: echarts.ECharts | null = null

// 图表容器包在 v-show 里，隐藏时宽高为 0，ECharts 只能画出空白；
// 用 ResizeObserver 等容器真正可见（宽度 > 0）时补画。
const drawnWidths = new Map<string, number>()
let visibilityObserver: ResizeObserver | null = null

const CHART_IDS = ['cognitiveRadar', 'metricsRadar', 'predictionChart', 'comparisonChart'] as const

// 按需分发（不能提前用对象字面量引用下面的 const 函数，会命中 TDZ）
const drawChartById = (id: (typeof CHART_IDS)[number]) => {
  if (id === 'cognitiveRadar') drawCognitiveRadar()
  else if (id === 'metricsRadar') drawMetricsRadar()
  else if (id === 'predictionChart') drawPredictionChart()
  else drawComparisonChart()
}

const drawChartsWhenVisible = () => {
  for (const id of CHART_IDS) {
    const dom = document.getElementById(id)
    if (!dom) continue
    const width = dom.clientWidth
    if (width <= 0 || drawnWidths.get(id) === width) continue
    drawnWidths.set(id, width)
    drawChartById(id)
  }
}

const redrawAllCharts = () => {
  drawnWidths.clear()
  drawChartsWhenVisible()
}

const observeChartVisibility = () => {
  if (typeof ResizeObserver === 'undefined') return
  visibilityObserver?.disconnect()
  visibilityObserver = new ResizeObserver(() => drawChartsWhenVisible())
  for (const id of CHART_IDS) {
    const dom = document.getElementById(id)
    if (dom) visibilityObserver.observe(dom)
  }
  drawChartsWhenVisible()
}

const getDimensionColor = (value: number): string => {
  if (value >= 0.7) return '#22c55e'
  if (value >= 0.5) return '#eab308'
  if (value >= 0.3) return '#f97316'
  return '#ef4444'
}

const getDiagnosis = (value: number): string => {
  if (value >= 0.7) return '良好'
  if (value >= 0.5) return '一般'
  if (value >= 0.3) return '需加强'
  return '薄弱'
}

const formatTime = (dateStr: string): string => {
  try {
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return '--'
    return date.toLocaleString('zh-CN', { hour12: false })
  } catch {
    return '--'
  }
}

const goToScenario = (_id: string) => {
  uni.navigateTo({ url: '/pages/scenario/index' })
}

const goPractice = () => {
  uni.navigateTo({ url: '/pages/practice/index' })
}

const practiceKnowledgePoint = (conceptId: string) => {
  uni.navigateTo({
    url: `/pages/practice/index?conceptId=${encodeURIComponent(conceptId)}&conceptName=${encodeURIComponent(conceptId)}`,
  })
}

const loadData = async () => {
  loading.value = true
  try {
    const [knowledge, state] = await Promise.all([
      request<any>({ url: '/student/knowledge/all', method: 'GET' }).catch(() => []),
      request<any>({ url: '/interactive-learning/cognitive-state', method: 'GET' }).catch(() => null),
    ])

    practiceRecords.value = Array.isArray(knowledge) ? knowledge : []

    if (state) {
      Object.assign(cognitiveState.dimensions, state.dimensions || {})
      Object.assign(cognitiveState.metrics, state.metrics || {})
      Object.assign(cognitiveState.predictions, state.predictions || {})
      cognitiveState.confidence = state.confidence ?? 0
      cognitiveState.lastUpdated = state.lastUpdated || state.timestamp || new Date().toISOString()
      cognitiveStore.setCognitiveState(state)
    } else {
      Object.assign(cognitiveState, emptyCognitiveState)
    }
  } catch (error) {
    console.error('加载认知评估数据失败:', error)
  } finally {
    loading.value = false
    nextTick(() => observeChartVisibility())
  }
}

const drawCognitiveRadar = () => {
  const chartDom = document.getElementById('cognitiveRadar')
  if (!chartDom) return
  if (cognitiveRadarInstance) cognitiveRadarInstance.dispose()
  cognitiveRadarInstance = echarts.init(chartDom)

  const indicator = Object.entries(dimensionLabels).map(([, label]) => ({ name: label, max: 1 }))
  const values = Object.keys(dimensionLabels).map(key => cognitiveState.dimensions[key as keyof typeof cognitiveState.dimensions])

  cognitiveRadarInstance.setOption({
    backgroundColor: 'transparent',
    radar: {
      indicator,
      shape: 'polygon',
      splitNumber: 5,
      axisName: { color: '#94a3b8', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,0.25)' } },
      splitArea: { areaStyle: { color: ['rgba(99,102,241,0.02)', 'rgba(99,102,241,0.05)'] } },
      axisLine: { lineStyle: { color: 'rgba(148,163,184,0.3)' } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: values,
        name: '认知维度',
        areaStyle: { color: 'rgba(99,102,241,0.2)' },
        lineStyle: { color: '#6366f1', width: 2 },
        itemStyle: { color: '#6366f1' },
        symbol: 'circle',
        symbolSize: 6,
      }],
    }],
  })
  cognitiveRadarInstance.resize()
}

const drawMetricsRadar = () => {
  const chartDom = document.getElementById('metricsRadar')
  if (!chartDom) return
  if (metricsRadarInstance) metricsRadarInstance.dispose()
  metricsRadarInstance = echarts.init(chartDom)

  const indicator = Object.entries(metricLabels).map(([, label]) => ({ name: label, max: 1 }))
  const values = [
    cognitiveState.metrics.cognitiveLoad,
    cognitiveState.metrics.learningVelocity,
    cognitiveState.metrics.attentionLevel,
    cognitiveState.metrics.frustrationLevel,
  ]

  metricsRadarInstance.setOption({
    backgroundColor: 'transparent',
    radar: {
      indicator,
      shape: 'polygon',
      splitNumber: 5,
      axisName: { color: '#94a3b8', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,0.25)' } },
      splitArea: { areaStyle: { color: ['rgba(249,115,22,0.02)', 'rgba(249,115,22,0.05)'] } },
      axisLine: { lineStyle: { color: 'rgba(148,163,184,0.3)' } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: values,
        name: '行为指标',
        areaStyle: { color: 'rgba(249,115,22,0.2)' },
        lineStyle: { color: '#f97316', width: 2 },
        itemStyle: { color: '#f97316' },
        symbol: 'circle',
        symbolSize: 6,
      }],
    }],
  })
  metricsRadarInstance.resize()
}

const drawPredictionChart = () => {
  const chartDom = document.getElementById('predictionChart')
  if (!chartDom) return
  if (predictionChartInstance) predictionChartInstance.dispose()
  predictionChartInstance = echarts.init(chartDom)

  const prediction = cognitiveState.predictions.masteryPrediction || []
  const weeks = prediction.map((_, i) => `第${i + 1}周`)

  predictionChartInstance.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: weeks,
      axisLine: { lineStyle: { color: 'rgba(148,163,184,0.4)' } },
      axisLabel: { color: '#94a3b8' },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 1,
      axisLine: { lineStyle: { color: 'rgba(148,163,184,0.4)' } },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,0.2)' } },
      axisLabel: { color: '#94a3b8' },
    },
    series: [{
      type: 'bar',
      data: prediction.map((v) => ({
        value: v,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#6366f1' },
            { offset: 1, color: '#a855f7' },
          ]),
        },
      })),
      barWidth: '40%',
    }],
  })
  predictionChartInstance.resize()
}

/** 真实对比：本人掌握度 vs 掌握线 80% */
const drawComparisonChart = () => {
  const chartDom = document.getElementById('comparisonChart')
  if (!chartDom) return
  if (comparisonChartInstance) comparisonChartInstance.dispose()
  comparisonChartInstance = echarts.init(chartDom)

  const studied = practiceRecords.value.filter((record) => (record.attemptsCount || 0) > 0)
  const names = studied.map((record) => record.conceptId)
  const personal = studied.map((record) => Math.round((record.masteryLevel || 0) * 100))
  const target = studied.map(() => 80)

  comparisonChartInstance.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: { data: ['我的掌握度', '掌握线'], top: 0, textStyle: { color: '#94a3b8' } },
    grid: { left: 50, right: 20, top: 40, bottom: 40, containLabel: true },
    xAxis: {
      type: 'category',
      data: names,
      axisLine: { lineStyle: { color: 'rgba(148,163,184,0.4)' } },
      axisLabel: { color: '#94a3b8', fontSize: 10, interval: 0, rotate: names.length > 3 ? 20 : 0 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLine: { lineStyle: { color: 'rgba(148,163,184,0.4)' } },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,0.2)' } },
      axisLabel: { color: '#94a3b8' },
    },
    series: [
      { name: '我的掌握度', type: 'bar', data: personal, itemStyle: { color: '#6366f1' }, barMaxWidth: 32 },
      {
        name: '掌握线',
        type: 'line',
        data: target,
        symbol: 'none',
        lineStyle: { color: '#f97316', type: 'dashed', width: 2 },
      },
    ],
  })
  comparisonChartInstance.resize()
}

const handleResize = () => {
  cognitiveRadarInstance?.resize()
  metricsRadarInstance?.resize()
  predictionChartInstance?.resize()
  comparisonChartInstance?.resize()
  drawChartsWhenVisible()
}

watch(activeTab, () => {
  nextTick(() => drawChartsWhenVisible())
})

watch(hasPracticeData, () => {
  nextTick(() => redrawAllCharts())
})

onMounted(() => {
  window.addEventListener('resize', handleResize)
  loadData()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  visibilityObserver?.disconnect()
  visibilityObserver = null
  cognitiveRadarInstance?.dispose()
  metricsRadarInstance?.dispose()
  predictionChartInstance?.dispose()
  comparisonChartInstance?.dispose()
})
</script>

<style scoped>
.assessment-view {
  padding: 15px;
}

.page-header {
  background: var(--accent-gradient);
  padding: 30px 20px;
  color: white;
  border-radius: 12px;
  margin-bottom: 15px;
}

.page-title {
  font-size: 24px;
  font-weight: bold;
  display: block;
}

.page-subtitle {
  font-size: 14px;
  opacity: 0.8;
  margin-top: 5px;
  display: block;
}

.state-block {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 30px 20px;
  text-align: center;
  margin-bottom: 15px;
}

.state-block.empty .empty-icon {
  font-size: 36px;
  display: block;
  margin-bottom: 10px;
}

.state-text {
  font-size: 14px;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 6px;
}

.state-subtext {
  font-size: 12px;
  color: var(--text-muted);
  display: block;
  margin-bottom: 14px;
}

.state-btn {
  height: 36px;
  line-height: 36px;
  padding: 0 24px;
  border-radius: 18px;
  font-size: 13px;
  background: var(--accent-color);
  color: white;
  border: none;
}

.tabs {
  display: flex;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 15px;
  border-radius: 8px 8px 0 0;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 12px 0;
  font-size: 14px;
  color: var(--text-secondary);
  position: relative;
}

.tab-item.tab-active {
  color: var(--accent-color);
  font-weight: bold;
}

.tab-item.tab-active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 30px;
  height: 3px;
  background: var(--accent-color);
  border-radius: 2px;
}

.section-title {
  font-size: 16px;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 12px;
  display: block;
}

.radar-section,
.metrics-section,
.error-patterns,
.interventions,
.prediction-section,
.scenario-recommendation {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 15px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.radar-chart-container {
  margin: 10px 0;
}

.radar-chart {
  width: 100%;
  height: 280px;
}

.dimension-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.dimension-card {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 12px;
  border-left: 4px solid;
}

.dim-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.dim-name {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}

.dim-status {
  font-size: 12px;
  font-weight: bold;
}

.dim-bar-container {
  height: 6px;
  background: var(--bg-primary);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 4px;
}

.dim-bar {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.dim-value {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: right;
}

.pattern-list,
.intervention-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pattern-item,
.intervention-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.pattern-item {
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.intervention-item {
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.pattern-item.weak:active {
  background: rgba(239, 68, 68, 0.08);
}

.pattern-icon {
  font-size: 14px;
  color: #fca5a5;
}

.pattern-text {
  font-size: 13px;
  color: var(--text-primary);
  flex: 1;
}

.intervention-icon {
  font-size: 14px;
}

.intervention-text {
  font-size: 13px;
  color: var(--text-secondary);
}

.recommendation-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.recommendation-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 10px;
  border: 1px solid var(--border-color);
  transition: all 0.2s;
}

.recommendation-item:active {
  transform: scale(0.98);
  background: rgba(99, 102, 241, 0.05);
}

.rec-icon {
  font-size: 28px;
  width: 40px;
  text-align: center;
}

.rec-content {
  flex: 1;
}

.rec-title {
  font-size: 14px;
  font-weight: bold;
  color: var(--text-primary);
  display: block;
  margin-bottom: 4px;
}

.rec-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.rec-arrow {
  font-size: 18px;
  color: var(--accent-color);
}

.prediction-chart-container,
.comparison-chart-container {
  margin-top: 10px;
}

.prediction-chart,
.comparison-chart {
  width: 100%;
  height: 250px;
}

.confidence-card {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 15px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.confidence-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color);
}

.confidence-row:last-child {
  border-bottom: none;
}

.confidence-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.confidence-value {
  font-size: 15px;
  font-weight: bold;
  color: var(--accent-color);
}
</style>
