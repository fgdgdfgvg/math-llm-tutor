import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'

export interface CognitiveDimensions {
  conceptualUnderstanding: number
  proceduralFluency: number
  strategicCompetence: number
  adaptiveReasoning: number
}

export interface CognitiveMetrics {
  cognitiveLoad: number
  learningVelocity: number
  errorPattern: string[]
  attentionLevel: number
  frustrationLevel: number
}

export interface CognitivePredictions {
  masteryPrediction: number[]
  optimalDifficulty: number
  recommendedIntervention: string[]
}

export interface CognitiveState {
  dimensions: CognitiveDimensions
  metrics: CognitiveMetrics
  predictions: CognitivePredictions
  confidence: number
  lastUpdated: string
}

const DEFAULT_COGNITIVE: CognitiveState = {
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
    masteryPrediction: [0.45, 0.52, 0.60, 0.68, 0.75],
    optimalDifficulty: 0.6,
    recommendedIntervention: ['增加概念辨析练习', '强化证明推理训练', '减少计算量，聚焦理解'],
  },
  confidence: 0.75,
  lastUpdated: new Date().toISOString(),
}

export const useCognitiveStore = defineStore('cognitive', () => {
  const cognitiveState = reactive<CognitiveState>({ ...DEFAULT_COGNITIVE })
  const selectedDimension = ref<string | null>(null)
  const highlightedNodeIds = ref<string[]>([])
  const knowledgeAreaFilter = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const setCognitiveState = (state: Partial<CognitiveState>) => {
    if (state.dimensions) Object.assign(cognitiveState.dimensions, state.dimensions)
    if (state.metrics) Object.assign(cognitiveState.metrics, state.metrics)
    if (state.predictions) Object.assign(cognitiveState.predictions, state.predictions)
    if (state.confidence !== undefined) cognitiveState.confidence = state.confidence
    if (state.lastUpdated) cognitiveState.lastUpdated = state.lastUpdated
  }

  const resetToDefault = () => {
    Object.assign(cognitiveState, DEFAULT_COGNITIVE)
  }

  return {
    cognitiveState,
    selectedDimension,
    highlightedNodeIds,
    knowledgeAreaFilter,
    loading,
    error,
    setCognitiveState,
    resetToDefault,
  }
})
