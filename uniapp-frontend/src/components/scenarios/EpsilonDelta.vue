<template>
  <InteractiveCanvas
    :scenario="scenarioConfig"
    :params="sliderParams"
    :paramValues="paramValues"
    :chartOption="chartOption"
    :onVerify="challengeMode ? verifyDelta : undefined"
    :onAiDiagnose="aiDiagnose"
    :hint="currentFunction.hint"
    :score="score"
    :attempts="attempts"
    verifyButtonText="验证 δ"
  >
    <template #extra>
      <view class="function-selector">
        <view
          v-for="fn in EPSILON_DELTA_FUNCTIONS"
          :key="fn.id"
          class="fn-btn"
          :class="{ 'fn-active': selectedFnId === fn.id }"
          @click="selectFunction(fn.id)"
        >
          <text class="fn-name">{{ fn.name }}</text>
        </view>
      </view>
      <view class="mode-toggle">
        <view class="toggle-btn" :class="{ active: !challengeMode }" @click="challengeMode = false">
          <text>探索模式</text>
        </view>
        <view class="toggle-btn" :class="{ active: challengeMode }" @click="challengeMode = true">
          <text>挑战模式</text>
        </view>
      </view>
      <view v-if="!challengeMode" class="info-card">
        <text class="info-item">
          最大可行 δ {{ optimalDeltaPending ? '（计算中…）' : optimalDelta === null ? '：当前 ε 下未找到（函数可能不连续）' : `≈ ${optimalDelta.toFixed(4)}` }}
        </text>
        <text class="info-item">当前 ε = {{ epsilon.toFixed(2) }}</text>
      </view>
    </template>
  </InteractiveCanvas>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import InteractiveCanvas from './InteractiveCanvas.vue'
import type { SliderParam } from './InteractiveCanvas.vue'
import {
  EPSILON_DELTA_FUNCTIONS,
  checkDelta,
  evaluateDelta,
  findOptimalDelta,
} from '@/utils/math/epsilonDelta'
import { interactiveLearningApi, agentApi } from '@/services/interactiveLearning'
import { useScenarioStore } from '@/stores/scenario'

const scenarioStore = useScenarioStore()

const selectedFnId = ref('sin_x_over_x')
const epsilon = ref(0.3)
const delta = ref(0.5)
const challengeMode = ref(false)
const score = ref(0)
const attempts = ref(0)

const currentFunction = computed(() =>
  EPSILON_DELTA_FUNCTIONS.find((f) => f.id === selectedFnId.value) || EPSILON_DELTA_FUNCTIONS[0],
)

const paramValues = computed(() => {
  if (challengeMode.value) return { epsilon: epsilon.value, delta: delta.value }
  return { epsilon: epsilon.value, delta: delta.value }
})

const sliderParams = computed((): SliderParam[] => [
  {
    key: 'epsilon',
    label: 'ε (误差容忍度)',
    min: 0.01,
    max: 1,
    step: 0.01,
    defaultValue: 0.3,
    color: '#22c55e',
  },
  {
    key: 'delta',
    label: 'δ (邻域半径)',
    min: 0.01,
    max: 2,
    step: 0.01,
    defaultValue: 0.5,
    color: '#f97316',
  },
])

const scenarioConfig = {
  id: 'epsilon-delta',
  title: 'ε-δ 极限定义可视化',
  description: '通过调整 ε 和 δ，直观理解极限的严格定义：∀ε>0, ∃δ>0, 使得当 0<|x-a|<δ 时，|f(x)-L|<ε',
  concept: 'limit_definition',
  difficulty: 'medium' as const,
}

/**
 * 最大可行 δ。
 * 注意：搜索上界**不再受当前 δ 限制**（旧实现以当前 δ 为上界向下搜，
 * “最优 δ”永远≈当前值，只是自我印证）。结果可能为 null（无解），
 * 此时 UI 明确提示，而不是回填一个未验证的值。
 * 计算量较大（约 8000 次求值），因此用 watch + 防抖驱动，不放进渲染路径。
 */
const optimalDelta = ref<number | null>(null)
const optimalDeltaPending = ref(false)
let deltaSearchTimer: ReturnType<typeof setTimeout> | null = null

// 防抖 120ms，避免拖动滑块时主线程掉帧
watch(
  () => [currentFunction.value.id, epsilon.value] as const,
  () => {
    if (deltaSearchTimer) clearTimeout(deltaSearchTimer)
    optimalDeltaPending.value = true
    const fn = currentFunction.value
    deltaSearchTimer = setTimeout(() => {
      optimalDelta.value = findOptimalDelta(
        fn.fn,
        fn.limitPoint,
        fn.limitValue,
        epsilon.value,
        Math.max(1, delta.value * 2),
      )
      optimalDeltaPending.value = false
    }, 120)
  },
  { immediate: true },
)

const chartOption = computed(() => {
  const fn = currentFunction.value
  const { limitPoint, limitValue } = fn
  const spread = Math.max(delta.value * 3, 1)
  const xMin = limitPoint - spread
  const xMax = limitPoint + spread
  const ySpread = Math.max(epsilon.value * 3, 1)

  const funcData: number[][] = []
  const steps = 300
  for (let i = 0; i <= steps; i++) {
    const x = xMin - 1 + ((xMax - xMin + 2) * i) / steps
    funcData.push([x, fn.fn(x)])
  }

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const x = params[0]?.data?.[0]
        const y = params[0]?.data?.[1]
        if (x === undefined) return ''
        return `x = ${x.toFixed(4)}<br/>f(x) = ${y?.toFixed(4)}`
      },
    },
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
      min: limitValue - ySpread,
      max: limitValue + ySpread,
      axisLine: { lineStyle: { color: '#475569' } },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [
      {
        name: 'f(x)',
        type: 'line',
        data: funcData,
        smooth: true,
        lineStyle: { color: '#818cf8', width: 3 },
        symbol: 'none',
      },
      {
        name: 'L+ε',
        type: 'line',
        data: [[xMin - 1, limitValue + epsilon.value], [xMax + 1, limitValue + epsilon.value]],
        lineStyle: { color: '#22c55e', width: 1, type: 'dashed' },
        symbol: 'none',
      },
      {
        name: 'L-ε',
        type: 'line',
        data: [[xMin - 1, limitValue - epsilon.value], [xMax + 1, limitValue - epsilon.value]],
        lineStyle: { color: '#22c55e', width: 1, type: 'dashed' },
        symbol: 'none',
      },
      {
        name: 'a-δ',
        type: 'line',
        data: [[limitPoint - delta.value, limitValue - ySpread], [limitPoint - delta.value, limitValue + ySpread]],
        lineStyle: { color: '#f97316', width: 1, type: 'dotted' },
        symbol: 'none',
      },
      {
        name: 'a+δ',
        type: 'line',
        data: [[limitPoint + delta.value, limitValue - ySpread], [limitPoint + delta.value, limitValue + ySpread]],
        lineStyle: { color: '#f97316', width: 1, type: 'dotted' },
        symbol: 'none',
      },
      {
        name: '极限点',
        type: 'scatter',
        data: [[limitPoint, limitValue]],
        symbolSize: 12,
        itemStyle: { color: '#f43f5e', borderColor: '#fff', borderWidth: 2 },
      },
    ],
  }
})

const selectFunction = (id: string) => {
  selectedFnId.value = id
  const fn = EPSILON_DELTA_FUNCTIONS.find((f) => f.id === id)
  if (fn) {
    epsilon.value = 0.3
    delta.value = 0.5
  }
}

watch([epsilon, delta, selectedFnId], (newVal, oldVal) => {
  if (newVal[2] !== oldVal[2]) {
    const fn = EPSILON_DELTA_FUNCTIONS.find((f) => f.id === newVal[2])
    if (fn) {
      epsilon.value = 0.3
      delta.value = 0.5
    }
  }
})

const verifyDelta = (): { success: boolean; message: string } => {
  const fn = currentFunction.value
  // 用带诊断信息的判定，区分“不满足”与“无法判定”（旧实现两者都返回 false，
  // 而且在 δ < 1e-4 时错误地一律返回 true）
  const evaluation = evaluateDelta(fn.fn, fn.limitPoint, fn.limitValue, epsilon.value, delta.value)
  const result = evaluation.satisfied
  attempts.value++
  if (result) {
    score.value = Math.max(score.value, Math.round(100 * (1 - delta.value / 2)))
  }
  scenarioStore.updateProgress('epsilon-delta', result, score.value)
  try {
    interactiveLearningApi.recordInteraction({
      scenarioId: 'epsilon-delta',
      interactionType: 'verify',
      parameters: { epsilon: epsilon.value, delta: delta.value, functionId: selectedFnId.value },
      result: { success: result },
    })
  } catch (e) {
    console.error('记录交互失败:', e)
  }
  if (evaluation.degenerate) {
    return {
      success: false,
      message: '⚠️ 当前 δ 过小（或邻域内函数无定义），数值采样无法判定，请增大 δ',
    }
  }

  return {
    success: result,
    message: result
      ? `✅ 验证通过！（去心邻域 ${evaluation.checked} 点采样均满足 |f(x)-L|<ε）`
      : `❌ 验证失败：在 x=${evaluation.worst?.x.toFixed(4)} 处 |f(x)-L|=${evaluation.worst?.deviation.toFixed(4)} ≥ ε，试试减小 δ`,
  }
}

const aiDiagnose = async (): Promise<string> => {
  const fn = currentFunction.value
  try {
    const result = await agentApi.diagnose({
      problem: `在ε-δ极限定义中，函数 ${fn.name} 在 x→${fn.limitPoint} 时的极限为 ${fn.limitValue}。当前 ε=${epsilon.value.toFixed(2)}, δ=${delta.value.toFixed(2)}。请分析当前 δ 是否满足条件，如果不满足，给出建议的 δ 值。`,
      context: {
        functionId: selectedFnId.value,
        epsilon: epsilon.value,
        delta: delta.value,
        optimalDelta: optimalDelta.value,
      },
    })
    return result?.diagnosis || result?.feedback || 'AI 诊断完成，请查看详细结果。'
  } catch (e: any) {
    const hint =
      optimalDelta.value === null
        ? `当前 ε=${epsilon.value.toFixed(2)} 下未找到可行 δ（函数可能在趋近点不连续）`
        : `当前最优 δ ≈ ${optimalDelta.value.toFixed(4)}，你的 δ = ${delta.value.toFixed(2)}${delta.value > optimalDelta.value ? ' 偏大' : ' 合适'}`
    return `AI 诊断暂不可用。\n\n提示：${hint}。`
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
