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
      <view class="series-type-toggle">
        <view class="toggle-btn" :class="{ active: seriesType === 'taylor' }" @click="seriesType = 'taylor'">
          <text>泰勒展开</text>
        </view>
        <view class="toggle-btn" :class="{ active: seriesType === 'fourier' }" @click="seriesType = 'fourier'">
          <text>傅里叶方波</text>
        </view>
      </view>
      <view v-if="seriesType === 'taylor'" class="function-selector">
        <view
          v-for="fn in TAYLOR_FUNCTIONS"
          :key="fn.id"
          class="fn-btn"
          :class="{ 'fn-active': selectedFnId === fn.id }"
          @click="selectFunction(fn.id)"
        >
          <text class="fn-name">{{ fn.name }}</text>
        </view>
      </view>
      <view class="info-card">
        <text class="info-item" v-if="seriesType === 'taylor'">
          泰勒近似({{ terms }}项) ≈ {{ taylorAtCenter.toFixed(6) }}
        </text>
        <text class="info-item" v-if="seriesType === 'taylor'">
          精确值 = {{ exactAtCenter.toFixed(6) }}
        </text>
        <text class="info-item" v-if="seriesType === 'taylor'">
          误差 = {{ Math.abs(taylorAtCenter - exactAtCenter).toExponential(4) }}
        </text>
        <text class="info-item" v-if="seriesType === 'fourier'">
          傅里叶级数用 {{ terms }} 个奇次谐波逼近方波
        </text>
        <text class="info-item" v-if="seriesType === 'fourier'">
          Gibbs 现象：在间断点附近出现过冲 ≈ 9%
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
  TAYLOR_FUNCTIONS,
  taylorApprox,
  taylorCoeffs,
  describeTermLimits,
  isWithinConvergence,
  lagrangeRemainderBound,
  measureGibbsOvershoot,
  fourierSquareWave,
  factorial,
} from '@/utils/math/series'
import { agentApi } from '@/services/interactiveLearning'

const selectedFnId = ref('exp')
const terms = ref(5)
const seriesType = ref<'taylor' | 'fourier'>('taylor')

const currentTaylorFunction = computed(() =>
  TAYLOR_FUNCTIONS.find((f) => f.id === selectedFnId.value) || TAYLOR_FUNCTIONS[0],
)

const paramValues = computed(() => ({ terms: terms.value }))

const sliderParams = computed((): SliderParam[] => [
  {
    key: 'terms',
    label: seriesType.value === 'taylor' ? '展开项数' : '谐波数',
    min: 1,
    max: 10,
    step: 1,
    defaultValue: 5,
    color: '#a855f7',
  },
])

/** 系数由解析公式生成（旧实现硬编码 11 项，超出时静默截断） */
const coeffs = computed(() => taylorCoeffs(currentTaylorFunction.value))

/** 超过可用项数时的提示（不再静默截断） */
const termLimitNotice = computed(() =>
  describeTermLimits(currentTaylorFunction.value, terms.value),
)

/** 展开点附近的收敛半径提示 */
const convergenceNotice = computed(() => {
  const fn = currentTaylorFunction.value
  return Number.isFinite(fn.convergenceRadius)
    ? `收敛域：|x - ${fn.center}| < ${fn.convergenceRadius}${fn.includeRightEndpoint ? '（右端点条件收敛）' : ''}`
    : '收敛域：全体实数（收敛半径 ∞）'
})

const taylorAtCenter = computed(() => {
  const fn = currentTaylorFunction.value
  return taylorApprox(fn.center + 1, fn.center, coeffs.value, terms.value, fn.coefficient)
})

/** 拉格朗日余项上界 vs 实测误差：理论误差与实测误差叠加才是完整的误差分析 */
const remainderAtCenter = computed(() =>
  lagrangeRemainderBound(currentTaylorFunction.value, currentTaylorFunction.value.center + 1, terms.value),
)

/** Gibbs 超调量（理想极限 8.95%，与谐波数无关） */
const gibbs = computed(() => measureGibbsOvershoot(terms.value))

const exactAtCenter = computed(() => {
  const fn = currentTaylorFunction.value
  const exactFns: Record<string, (x: number) => number> = {
    exp: Math.exp,
    sin: Math.sin,
    cos: Math.cos,
    ln: (x: number) => Math.log(1 + x),
  }
  const exactFn = exactFns[fn.id]
  return exactFn ? exactFn(1) : 0
})

const scenarioConfig = {
  id: 'series',
  title: '级数逼近可视化',
  description: '观察泰勒级数如何用多项式逼近函数，以及傅里叶级数如何用正弦波合成方波。',
  concept: 'series_convergence',
  difficulty: 'hard' as const,
}

const hintText = '泰勒级数在展开点附近收敛最快，远离展开点时误差增大。增加项数可提高精度，但收敛半径有限。傅里叶级数在间断点存在 Gibbs 现象。'

const chartOption = computed(() => {
  if (seriesType.value === 'taylor') {
    return buildTaylorChart()
  }
  return buildFourierChart()
})

const buildTaylorChart = () => {
  const fn = currentTaylorFunction.value
  const xMin = -4
  const xMax = 4
  const exactFns: Record<string, (x: number) => number> = {
    exp: Math.exp,
    sin: Math.sin,
    cos: Math.cos,
    ln: (x: number) => (x > -1 ? Math.log(1 + x) : NaN),
  }
  const exactFn = exactFns[fn.id] || (() => 0)

  const exactData: number[][] = []
  const approxData: number[][] = []
  for (let i = 0; i <= 200; i++) {
    const x = xMin + ((xMax - xMin) * i) / 200
    const yExact = exactFn(x)
    // 收敛域外的部分不绘制近似曲线（否则画出的是无意义的振荡）
    const yApprox = isWithinConvergence(fn, x)
      ? taylorApprox(x, fn.center, coeffs.value, terms.value, fn.coefficient)
      : NaN
    if (isFinite(yExact)) exactData.push([x, yExact])
    if (isFinite(yApprox) && Math.abs(yApprox) < 100) approxData.push([x, yApprox])
  }

  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: {
      data: [`${fn.name} 精确`, `泰勒近似(${terms.value}项)`],
      top: 0,
      textStyle: { color: '#94a3b8' },
    },
    grid: { left: 50, right: 20, top: 40, bottom: 40 },
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
    series: [
      {
        name: `${fn.name} 精确`,
        type: 'line',
        data: exactData,
        smooth: true,
        lineStyle: { color: '#818cf8', width: 3 },
        symbol: 'none',
      },
      {
        name: `泰勒近似(${terms.value}项)`,
        type: 'line',
        data: approxData,
        smooth: true,
        lineStyle: { color: '#f97316', width: 2, type: 'dashed' },
        symbol: 'none',
      },
    ],
  }
}

const buildFourierChart = () => {
  const xMin = -Math.PI * 2
  const xMax = Math.PI * 2
  const squareWaveData: number[][] = []
  const fourierData: number[][] = []

  for (let i = 0; i <= 300; i++) {
    const x = xMin + ((xMax - xMin) * i) / 300
    const sq = ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
    const squareVal = sq < Math.PI ? 1 : -1
    squareWaveData.push([x, squareVal])
    fourierData.push([x, fourierSquareWave(x, terms.value)])
  }

  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: {
      data: ['方波', `傅里叶近似(${terms.value}项)`],
      top: 0,
      textStyle: { color: '#94a3b8' },
    },
    grid: { left: 50, right: 20, top: 40, bottom: 40 },
    xAxis: {
      type: 'value',
      min: xMin,
      max: xMax,
      axisLine: { lineStyle: { color: '#475569' } },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    yAxis: {
      type: 'value',
      min: -1.5,
      max: 1.5,
      axisLine: { lineStyle: { color: '#475569' } },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [
      {
        name: '方波',
        type: 'line',
        data: squareWaveData,
        lineStyle: { color: '#818cf8', width: 2 },
        symbol: 'none',
        step: 'middle',
      },
      {
        name: `傅里叶近似(${terms.value}项)`,
        type: 'line',
        data: fourierData,
        smooth: true,
        lineStyle: { color: '#f97316', width: 2 },
        symbol: 'none',
      },
    ],
  }
}

const selectFunction = (id: string) => {
  selectedFnId.value = id
}

const aiDiagnose = async (): Promise<string> => {
  const fn = currentTaylorFunction.value
  try {
    const problem = seriesType.value === 'taylor'
      ? `函数 ${fn.name} 的泰勒展开在 x=${fn.center} 处，取 ${terms.value} 项。请解释泰勒展开的收敛性和余项。`
      : `方波的傅里叶级数展开，取 ${terms.value} 个奇次谐波。请解释 Gibbs 现象和收敛性。`
    const result = await agentApi.diagnose({
      problem,
      context: {
        seriesType: seriesType.value,
        functionId: selectedFnId.value,
        terms: terms.value,
      },
    })
    return result?.diagnosis || result?.feedback || 'AI 诊断完成。'
  } catch (e: any) {
    if (seriesType.value === 'taylor') {
      return `AI 诊断暂不可用。\n\n提示：泰勒展开在展开点附近收敛快，远离展开点时误差增大。增加项数可提高精度。`
    }
    return `AI 诊断暂不可用。\n\n提示：傅里叶级数在间断点存在约9%的过冲（Gibbs现象），这是所有傅里叶逼近的固有特征。`
  }
}
</script>

<style scoped>
.series-type-toggle {
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
