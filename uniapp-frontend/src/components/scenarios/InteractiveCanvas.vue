<template>
  <view class="interactive-canvas">
    <view class="canvas-layout">
      <view class="chart-area">
        <view :id="chartId" class="chart-container"></view>
        <view v-if="verifyMessage" class="verify-overlay" :class="verifySuccess ? 'success' : 'fail'">
          <text class="verify-overlay-text">{{ verifyMessage }}</text>
        </view>
      </view>

      <view class="control-panel">
        <view class="panel-header">
          <text class="scenario-title">{{ scenario.title }}</text>
          <view class="difficulty-tag" :class="'difficulty-' + scenario.difficulty">
            {{ difficultyLabel }}
          </view>
        </view>

        <text class="scenario-desc">{{ scenario.description }}</text>

        <view class="param-group">
          <view v-for="param in params" :key="param.key" class="param-row">
            <view class="param-header">
              <text class="param-label">{{ param.label }}</text>
              <text class="param-value" :style="{ color: param.color || '#6366f1' }">
                {{ formatParamValue(paramValues[param.key], param) }}
              </text>
            </view>
            <slider
              :min="param.min * paramScale"
              :max="param.max * paramScale"
              :step="param.step * paramScale"
              :value="paramValues[param.key] * paramScale"
              @change="onSliderChange(param.key, $event)"
              :activeColor="param.color || '#6366f1'"
              backgroundColor="#334155"
            />
          </view>
        </view>

        <view v-if="onVerify" class="verify-section">
          <button class="verify-btn" @click="handleVerify">
            {{ verifyButtonText }}
          </button>
        </view>

        <view v-if="$slots.extra" class="extra-controls">
          <slot name="extra"></slot>
        </view>

        <view v-if="hint" class="hint-section">
          <button class="hint-btn" @click="showHint = !showHint">
            {{ showHint ? '隐藏提示' : '💡 显示提示' }}
          </button>
          <view v-if="showHint" class="hint-card">
            <text class="hint-text">{{ hint }}</text>
          </view>
        </view>

        <view v-if="onAiDiagnose" class="ai-section">
          <button class="ai-btn" @click="handleAiDiagnose" :disabled="aiLoading">
            {{ aiLoading ? 'AI 分析中...' : '🤖 AI 智能诊断' }}
          </button>
          <view v-if="aiResult" class="ai-result-card">
            <text class="ai-result-text">{{ aiResult }}</text>
          </view>
        </view>

        <view v-if="score !== undefined" class="score-section">
          <view class="score-row">
            <text class="score-label">得分</text>
            <text class="score-value">{{ score }}</text>
          </view>
          <view v-if="attempts !== undefined" class="score-row">
            <text class="score-label">尝试次数</text>
            <text class="score-value">{{ attempts }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as echarts from 'echarts'

export interface ScenarioConfig {
  id: string
  title: string
  description: string
  concept: string
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface SliderParam {
  key: string
  label: string
  min: number
  max: number
  step: number
  defaultValue: number
  color?: string
}

const props = withDefaults(defineProps<{
  scenario: ScenarioConfig
  params: SliderParam[]
  paramValues: Record<string, number>
  chartOption: Record<string, any>
  onVerify?: () => { success: boolean; message: string }
  onAiDiagnose?: () => Promise<string>
  hint?: string
  score?: number
  attempts?: number
  verifyButtonText?: string
}>(), {
  verifyButtonText: '验证',
})

const emit = defineEmits<{
  (e: 'paramChange', key: string, value: number): void
}>()

const chartId = computed(() => `chart-${props.scenario.id}-${Date.now()}`)
const showHint = ref(false)
const verifyMessage = ref('')
const verifySuccess = ref(false)
const aiLoading = ref(false)
const aiResult = ref('')
let chartInstance: echarts.ECharts | null = null
const paramScale = 100

const difficultyLabel = computed(() => {
  const map: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难' }
  return map[props.scenario.difficulty] || props.scenario.difficulty
})

const formatParamValue = (value: number, param: SliderParam): string => {
  if (value === undefined) return '--'
  const decimals = param.step < 0.1 ? 3 : param.step < 1 ? 2 : 1
  return value.toFixed(decimals)
}

const onSliderChange = (key: string, e: any) => {
  const value = e.detail.value / paramScale
  emit('paramChange', key, value)
}

const handleVerify = () => {
  if (!props.onVerify) return
  const result = props.onVerify()
  verifySuccess.value = result.success
  verifyMessage.value = result.message
  setTimeout(() => { verifyMessage.value = '' }, 3000)
}

const handleAiDiagnose = async () => {
  if (!props.onAiDiagnose || aiLoading.value) return
  aiLoading.value = true
  aiResult.value = ''
  try {
    aiResult.value = await props.onAiDiagnose()
  } catch (e: any) {
    aiResult.value = 'AI 诊断失败: ' + (e.message || '未知错误')
  } finally {
    aiLoading.value = false
  }
}

const drawChart = () => {
  const chartDom = document.getElementById(chartId.value)
  if (!chartDom) return

  if (chartInstance) chartInstance.dispose()
  chartInstance = echarts.init(chartDom)
  chartInstance.setOption(props.chartOption)
}

const handleResize = () => {
  chartInstance?.resize()
}

watch(() => props.chartOption, () => {
  nextTick(() => drawChart())
}, { deep: true })

onMounted(() => {
  window.addEventListener('resize', handleResize)
  nextTick(() => drawChart())
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance?.dispose()
})
</script>

<style scoped>
.interactive-canvas {
  background: var(--bg-card);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.canvas-layout {
  display: flex;
  flex-direction: column;
}

.chart-area {
  position: relative;
  background: #0f172a;
  min-height: 320px;
}

.chart-container {
  width: 100%;
  height: 320px;
}

.verify-overlay {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: bold;
  z-index: 10;
  animation: fadeIn 0.3s ease;
}

.verify-overlay.success {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.verify-overlay.fail {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.verify-overlay-text {
  font-size: 13px;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

.control-panel {
  padding: 16px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.scenario-title {
  font-size: 18px;
  font-weight: bold;
  color: var(--text-primary);
}

.difficulty-tag {
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: bold;
  color: white;
}

.difficulty-easy { background: #22c55e; }
.difficulty-medium { background: #f97316; }
.difficulty-hard { background: #ef4444; }

.scenario-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 12px;
  display: block;
}

.param-group {
  margin-bottom: 12px;
}

.param-row {
  margin-bottom: 10px;
}

.param-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.param-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.param-value {
  font-size: 14px;
  font-weight: bold;
}

.verify-section {
  margin: 12px 0;
}

.verify-btn {
  width: 100%;
  height: 44px;
  line-height: 44px;
  background: var(--accent-gradient);
  color: white;
  border-radius: 10px;
  font-size: 15px;
  font-weight: bold;
  border: none;
}

.extra-controls {
  margin: 12px 0;
}

.hint-section {
  margin: 12px 0;
}

.hint-btn {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 13px;
  width: 100%;
}

.hint-card {
  background: #1c1917;
  border: 1px solid #92400e;
  border-radius: 8px;
  padding: 12px;
  margin-top: 8px;
}

.hint-text {
  font-size: 13px;
  color: #fbbf24;
  line-height: 1.6;
}

.ai-section {
  margin: 12px 0;
}

.ai-btn {
  width: 100%;
  height: 44px;
  line-height: 44px;
  background: linear-gradient(135deg, #6366f1, #a855f7);
  color: white;
  border-radius: 10px;
  font-size: 15px;
  font-weight: bold;
  border: none;
}

.ai-btn[disabled] {
  opacity: 0.6;
}

.ai-result-card {
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 8px;
  padding: 12px;
  margin-top: 8px;
}

.ai-result-text {
  font-size: 13px;
  color: #a5b4fc;
  line-height: 1.6;
  white-space: pre-wrap;
}

.score-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.score-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.score-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.score-value {
  font-size: 16px;
  font-weight: bold;
  color: var(--accent-color);
}
</style>
