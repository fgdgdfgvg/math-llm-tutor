<template>
  <InteractiveCanvas
    :scenario="scenarioConfig"
    :params="sliderParams"
    :paramValues="paramValues"
    :chartOption="chartOption"
    :onAiDiagnose="aiDiagnose"
    :hint="hintText"
  >
    <template #extra>
      <view class="function-selector">
        <view
          v-for="fn in INTEGRAL_FUNCTIONS"
          :key="fn.id"
          class="fn-btn"
          :class="{ 'fn-active': selectedFnId === fn.id }"
          @click="selectFunction(fn.id)"
        >
          <text class="fn-name">{{ fn.name }}</text>
        </view>
      </view>
      <view class="riemann-type-toggle">
        <view
          v-for="rt in riemannTypes"
          :key="rt.value"
          class="toggle-btn"
          :class="{ active: method === rt.value }"
          @click="method = rt.value"
        >
          <text>{{ rt.label }}</text>
        </view>
      </view>
      <view v-if="validation.message" class="info-card warn-card">
        <text class="info-item">⚠️ {{ validation.message }}</text>
      </view>
      <view class="info-card">
        <text class="info-item">近似值 ≈ {{ formatNumber(approximation) }}</text>
        <text class="info-item">参考真值 = {{ formatNumber(referenceValue) }}<text v-if="referenceIsNumeric" class="info-note">（高精度数值参考）</text></text>
        <text class="info-item">绝对误差 = {{ formatNumber(errorValue) }}</text>
        <text class="info-item">相对误差 = {{ relativeErrorText }}</text>
        <text class="info-item">当前方法截断误差阶：{{ currentOrder }}</text>
      </view>
      <view class="info-card">
        <text class="info-item">各方法误差对比（同一 n）：</text>
        <text v-for="row in methodComparison" :key="row.method" class="info-item method-row">
          {{ methodLabel(row.method) }}：误差 {{ formatNumber(row.error) }}（{{ row.order }}）
        </text>
      </view>
    </template>
  </InteractiveCanvas>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import InteractiveCanvas from './InteractiveCanvas.vue'
import type { SliderParam } from './InteractiveCanvas.vue'
import {
  INTEGRAL_FUNCTIONS,
  computeQuadrature,
  computeExactIntegral,
  computeHighPrecisionReference,
  computeRiemannRectangles,
  validateIntegrationRange,
  compareMethods,
} from '@/utils/math/integral'
import type { QuadratureMethod, RiemannType } from '@/utils/math/integral'
import { agentApi } from '@/services/interactiveLearning'

const selectedFnId = ref('x2')
const a = ref(0)
const b = ref(2)
const n = ref(10)
/** 数值积分方法：黎曼三种取样点 + 梯形法 + 辛普森法，便于对比误差阶 */
const method = ref<QuadratureMethod>('left')

const riemannTypes = [
  { value: 'left' as QuadratureMethod, label: '左端点' },
  { value: 'right' as QuadratureMethod, label: '右端点' },
  { value: 'midpoint' as QuadratureMethod, label: '中点' },
  { value: 'trapezoid' as QuadratureMethod, label: '梯形法' },
  { value: 'simpson' as QuadratureMethod, label: '辛普森' },
]

const METHOD_BY_VALUE: Record<QuadratureMethod, RiemannType> = {
  left: 'left',
  right: 'right',
  midpoint: 'midpoint',
  trapezoid: 'left',
  simpson: 'left',
}

const METHOD_LABELS: Record<QuadratureMethod, string> = {
  left: '左端点',
  right: '右端点',
  midpoint: '中点',
  trapezoid: '梯形法',
  simpson: '辛普森',
}

const currentOrder: Record<QuadratureMethod, string> = {
  left: 'O(1/n)',
  right: 'O(1/n)',
  midpoint: 'O(1/n²)',
  trapezoid: 'O(1/n²)',
  simpson: 'O(1/n⁴)',
}

const methodLabel = (value: QuadratureMethod) => METHOD_LABELS[value]

const currentFunction = computed(() =>
  INTEGRAL_FUNCTIONS.find((f) => f.id === selectedFnId.value) || INTEGRAL_FUNCTIONS[0],
)

const paramValues = computed(() => ({
  a: a.value,
  b: b.value,
  n: n.value,
}))

const sliderParams: SliderParam[] = [
  { key: 'a', label: '积分下限 a', min: -3, max: 3, step: 0.1, defaultValue: 0, color: '#6366f1' },
  { key: 'b', label: '积分上限 b', min: -3, max: 5, step: 0.1, defaultValue: 2, color: '#22c55e' },
  { key: 'n', label: '分割数 n', min: 1, max: 50, step: 1, defaultValue: 10, color: '#f97316' },
]

const validation = computed(() =>
  validateIntegrationRange(currentFunction.value.fn, a.value, b.value, n.value),
)

/** 有解析原函数时用解析值，否则用自适应 Simpson + Richardson 外推作为高精度参考 */
const referenceValue = computed(() => {
  const analytic = computeExactIntegral(currentFunction.value.antideriv, a.value, b.value)
  if (Number.isFinite(analytic)) return analytic
  return computeHighPrecisionReference(currentFunction.value.fn, a.value, b.value) ?? NaN
})

const referenceIsNumeric = computed(() =>
  !Number.isFinite(computeExactIntegral(currentFunction.value.antideriv, a.value, b.value)),
)

const approximation = computed(() =>
  validation.value.ok
    ? computeQuadrature(currentFunction.value.fn, a.value, b.value, n.value, method.value)
    : NaN,
)

const riemannSumValue = approximation
const exactValue = referenceValue

const errorValue = computed(() => Math.abs(approximation.value - referenceValue.value))

const relativeErrorText = computed(() => {
  if (!Number.isFinite(errorValue.value) || !Number.isFinite(referenceValue.value)) return '—'
  if (Math.abs(referenceValue.value) < 1e-12) return '—'
  return `${((errorValue.value / Math.abs(referenceValue.value)) * 100).toFixed(3)}%`
})

const formatNumber = (value: number) => (Number.isFinite(value) ? value.toFixed(6) : '—')

const methodComparison = computed(() => {
  if (!validation.value.ok || !Number.isFinite(referenceValue.value)) return []
  return compareMethods(currentFunction.value.fn, a.value, b.value, n.value, referenceValue.value)
})

const scenarioConfig = {
  id: 'integral',
  title: '定积分与黎曼和',
  description: '通过调整分割数和黎曼和类型，观察矩形逼近如何趋近精确面积。理解定积分的极限定义。',
  concept: 'integral_definition',
  difficulty: 'medium' as const,
}

const hintText = '增加分割数 n 可以减小误差。中点黎曼和通常比左/右端点更精确。当 n→∞ 时，黎曼和→精确值。'

const chartOption = computed(() => {
  const fn = currentFunction.value.fn
  const xMin = Math.min(a.value, b.value) - 1
  const xMax = Math.max(a.value, b.value) + 1

  const funcData: number[][] = []
  for (let i = 0; i <= 200; i++) {
    const x = xMin + ((xMax - xMin) * i) / 200
    funcData.push([x, fn(x)])
  }

  const rectangles = computeRiemannRectangles(
    fn,
    a.value,
    b.value,
    Math.min(n.value, 200),
    METHOD_BY_VALUE[method.value],
  )

  const series: any[] = []

  rectangles.forEach((rect) => {
    const xL = rect.xLeft
    const w = rect.width
    const h = rect.height
    series.push({
      type: 'line',
      data: [[xL, 0], [xL, h], [xL + w, h], [xL + w, 0], [xL, 0]],
      lineStyle: { color: rect.isPositive ? '#6366f1' : '#ef4444', width: 1 },
      areaStyle: { color: rect.isPositive ? 'rgba(99,102,241,0.2)' : 'rgba(239,68,68,0.2)' },
      symbol: 'none',
      smooth: false,
    })
  })

  series.push({
    name: `f(x) = ${currentFunction.value.name}`,
    type: 'line',
    data: funcData,
    smooth: true,
    lineStyle: { color: '#818cf8', width: 3 },
    symbol: 'none',
    z: 10,
  })

  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 30, bottom: 40 },
    xAxis: {
      type: 'value',
      min: xMin,
      max: xMax,
      axisLine: { lineStyle: { color: '#475569' } },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#475569' } },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series,
  }
})

const selectFunction = (id: string) => {
  selectedFnId.value = id
}

const aiDiagnose = async (): Promise<string> => {
  const fn = currentFunction.value
  try {
    const result = await agentApi.diagnose({
      problem: `函数 ${fn.name} 在 [${a.value.toFixed(1)}, ${b.value.toFixed(1)}] 上的定积分。当前使用 ${METHOD_LABELS[method.value]}，n=${n.value}，近似值=${approximation.value.toFixed(6)}，参考真值=${referenceValue.value.toFixed(6)}。请解释数值积分方法与定积分的关系。`,
      context: {
        functionId: selectedFnId.value,
        riemannType: method.value,
        n: n.value,
        riemannSum: riemannSumValue.value,
        exactValue: exactValue.value,
        error: errorValue.value,
      },
    })
    return result?.diagnosis || result?.feedback || 'AI 诊断完成。'
  } catch (e: any) {
    return `AI 诊断暂不可用。\n\n提示：当前误差=${errorValue.value.toFixed(6)}，增加 n 可减小误差。中点法通常收敛更快。`
  }
}
</script>

<style scoped>
.function-selector {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.fn-btn {
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  transition: all 0.2s;
}

.fn-btn.fn-active {
  background: var(--accent-gradient);
  border-color: transparent;
}

.fn-btn.fn-active .fn-name {
  color: white;
}

.fn-name {
  font-size: 11px;
  color: var(--text-secondary);
}

.riemann-type-toggle {
  display: flex;
  gap: 4px;
  margin-bottom: 10px;
}

.toggle-btn {
  flex: 1;
  padding: 5px 8px;
  border-radius: 6px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  text-align: center;
  font-size: 11px;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.toggle-btn.active {
  background: var(--accent-gradient);
  border-color: transparent;
  color: white;
}

.info-card {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 8px;
}

.info-item {
  font-size: 13px;
  color: var(--text-primary);
  display: block;
  margin-bottom: 4px;
}

.warn-card {
  border-left: 3px solid #f59e0b;
}

.method-row {
  font-size: 12px;
  color: var(--text-secondary);
}

.info-note {
  font-size: 11px;
  color: var(--text-secondary);
}
</style>
