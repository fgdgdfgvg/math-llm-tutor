import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ScenarioProgress {
  completed: boolean
  score: number
  attempts: number
  lastAttempt?: string
}

export const useScenarioStore = defineStore('scenario', () => {
  const activeScenario = ref<string | null>(null)
  const scenarioProgress = ref<Record<string, ScenarioProgress>>({})
  const diagnosisResult = ref<any>(null)
  const diagnosisLoading = ref(false)

  const setActiveScenario = (id: string | null) => {
    activeScenario.value = id
  }

  const updateProgress = (id: string, completed: boolean, score: number) => {
    const existing = scenarioProgress.value[id]
    scenarioProgress.value[id] = {
      completed,
      score: Math.max(score, existing?.score || 0),
      attempts: (existing?.attempts || 0) + 1,
      lastAttempt: new Date().toISOString(),
    }
    try {
      uni.setStorageSync('scenarioProgress', JSON.stringify(scenarioProgress.value))
    } catch (e) {
      console.error('保存场景进度失败:', e)
    }
  }

  const loadProgress = () => {
    try {
      const saved = uni.getStorageSync('scenarioProgress')
      if (saved) {
        scenarioProgress.value = JSON.parse(saved)
      }
    } catch (e) {
      console.error('加载场景进度失败:', e)
    }
  }

  const setDiagnosisResult = (result: any) => {
    diagnosisResult.value = result
  }

  const setDiagnosisLoading = (loading: boolean) => {
    diagnosisLoading.value = loading
  }

  return {
    activeScenario,
    scenarioProgress,
    diagnosisResult,
    diagnosisLoading,
    setActiveScenario,
    updateProgress,
    loadProgress,
    setDiagnosisResult,
    setDiagnosisLoading,
  }
})
