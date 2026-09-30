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
          v-for="fn in DERIVATIVE_FUNCTIONS"
          :key="fn.id"
          class="fn-btn"
          :class="{ 'fn-active': selectedFnId === fn.id }"
          @click="selectFunction(fn.id)"
        >
          <text class="fn-name">{{ fn.name }}</text>
        </view>
      </view>
      <view class="mode-toggle">
        <view class="toggle-btn" :class="{ active: !showSecant }" @click="showSecant = false">
          <text>切线</text>
        </view>
        <view class="toggle-btn" :class="{ active: showSecant }" @click="showSecant = true">
          <text>割线→切线</text>
        </view>
      </view>
      <view v-if="showSecant" class="info-card">
        <text class="info-item">割线斜率 = {{ secantSlope.toFixed(4) }}</text>
        <text class="info-item">切线斜率 = {{ tangentSlope.toFixed(4) }}</text>
        <text class="info-item">误差 = {{ Math.abs(secantSlope - tangentSlope).toFixed(4) }}</text>
      </view>
      <view class="info-card">
        <text class="info-item">f'(x₀) = {{ tangentSlope.toFixed(4) }}</text>
        <text class="info-item">f''(x₀) = {{ secondDeriv.toFixed(4) }}</text>
        <text class="info-item">凹凸性: {{ concavity }}</text>
      </view>
    </template>
  </InteractiveCanvas>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import InteractiveCanvas from './InteractiveCanvas.vue'
import type { SliderParam } from './InteractiveCanvas.vue'
import {
  DERIVATIVE_FUNCTIONS,
  computeTangentLine,
  computeSecantLine,
  getConcavityLabel,
} from '@/utils/math/derivative'
import { agentApi, interactiveLearningApi } from '@/services/interactiveLearning'

const selectedFnId = ref('x2')
const x0 = ref(1)
const h = ref(0.5)
const showSecant = ref(false)

const currentFunction = computed(() =>
  DERIVATIVE_FUNCTIONS.find((f) => f.id === selectedFnId.value) || DERIVATIVE_FUNCTIONS[0],
)

const tangentSlope = computed(() => currentFunction.value.dfn(x0.value))
const secondDeriv = computed(() => currentFunction.value.d2fn(x0.value))
const secantSlope = computed(() =>
  (currentFunction.value.fn(x0.value + h.value) - currentFunction.value.fn(x0.value)) / h.value,
)
const concavity = computed(() => getConcavityLabel(currentFunction.value.d2fn, x0.value))

const paramValues = computed((): Record<string, number> => {
  if (showSecant.value) return { x0: x0.value, h: h.value }
  return { x0: x0.value, h: 0 }
})

const sliderParams = computed((): SliderParam[] => {
  const base: SliderParam[] = [
    {
      key: 'x0',
      label: '切点位置 x₀',
      min: -3,
      max: 3,
      step: 0.1,
      defaultValue: 1,
      color: '#6366f1',
    },
  ]
  if (showSecant.value) {
    base.push({
      key: 'h',
      label: '增量 h (→0 时割线→切线)',
      min: 0.01,
      max: 2,
      step: 0.01,
      defaultValue: 0.5,
      color: '#f97316',
    })
  }
  return base
})

const scenarioConfig = {
  id: 'derivative',
  title: '导数几何意义',
  description: '观察割线如何逼近切线，理解导数是函数在某点的瞬时变化率。调整 h→0 观察割线斜率趋近切线斜率。',
  concept: 'derivative_definition',
  difficulty: 'medium' as const,
}

const hintText = '导数 f\'(x₀) 是割线斜率在 h→0 时的极限。将 h 滑块拖向 0，观察割线如何"旋转"逼近切线。二阶导数 f\'\'(x₀) 的正负决定凹凸性。'

const chartOption = computed(() => {
  const fn = currentFunction.value
  const xMin = -5
  const xMax = 5
  const xRange: [number, number] = [xMin, xMax]

  const funcData: number[][] = []
  for (let i = 0; i <= 200; i++) {
    const x = xMin + ((xMax - xMin) * i) / 200
    const y = fn.fn(x)
    if (isFinite(y)) funcData.push([x, y])
  }

  const tangent = computeTangentLine(fn.fn, fn.dfn, x0.value, xRange)
  const tangentData = tangent.xs.map((x, i) => [x, tangent.ys[i]])

  const series: any[] = [
    {
      name: `f(x) = ${fn.name}`,
      type: 'line',
      data: funcData,
      smooth: true,
      lineStyle: { color: '#818cf8', width: 3 },
      symbol: 'none',
    },
    {
      name: '切线',
      type: 'line',
      data: tangentData,
      lineStyle: { color: '#f97316', width: 2, type: 'dashed' },
      symbol: 'none',
    },
    {
      name: '切点',
      type: 'scatter',
      data: [[x0.value, fn.fn(x0.value)]],
      symbolSize: 10,
      itemStyle: { color: '#f43f5e' },
    },
  ]

  if (showSecant.value) {
    const secant = computeSecantLine(fn.fn, x0.value, h.value, xRange)
    const secantData = secant.xs.map((x, i) => [x, secant.ys[i]])
    series.push(
      {
        name: '割线',
        type: 'line',
        data: secantData,
        lineStyle: { color: '#22c55e', width: 2, type: 'dotted' },
        symbol: 'none',
      },
      {
        name: '割线端点',
        type: 'scatter',
        data: [[x0.value, fn.fn(x0.value)], [x0.value + h.value, fn.fn(x0.value + h.value)]],
        symbolSize: 8,
        itemStyle: { color: '#22c55e' },
        symbol: 'diamond',
      },
    )
  }

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
  x0.value = 1
  h.value = 0.5
}

const aiDiagnose = async (): Promise<string> => {
  const fn = currentFunction.value
  try {
    const result = await agentApi.diagnose({
      problem: `在函数 ${fn.name} 中，x₀=${x0.value.toFixed(1)} 处的导数 f'(x₀)=${tangentSlope.value.toFixed(4)}，二阶导数 f''(x₀)=${secondDeriv.value.toFixed(4)}。请解释导数的几何意义，以及当前点的凹凸性。`,
      context: {
        functionId: selectedFnId.value,
        x0: x0.value,
        tangentSlope: tangentSlope.value,
        secondDeriv: secondDeriv.value,
        concavity: concavity.value,
      },
    })
    return result?.diagnosis || result?.feedback || 'AI 诊断完成。'
  } catch (e: any) {
    return `AI 诊断暂不可用。\n\n提示：f'(x₀)=${tangentSlope.value.toFixed(4)} 表示曲线在 x₀ 处的切线斜率。f''(x₀)=${secondDeriv.value.toFixed(4)} ${secondDeriv.value > 0 ? '> 0，曲线凹向上' : secondDeriv.value < 0 ? '< 0，曲线凸向下' : '= 0，可能是拐点'}。`
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

.mode-toggle {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}

.toggle-btn {
  flex: 1;
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  text-align: center;
  font-size: 12px;
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
</style>
