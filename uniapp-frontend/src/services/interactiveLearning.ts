import request from '@/utils/request'

export const knowledgeApi = {
  getGraph: () => request({ url: '/knowledge/graph', method: 'GET' }),

  searchConcepts: (query: string) =>
    request({ url: '/knowledge/search', method: 'GET', params: { q: query } }),

  getConcept: (id: string) =>
    request({ url: `/knowledge/concepts/${id}`, method: 'GET' }),

  getPrerequisites: (id: string) =>
    request({ url: `/knowledge/concepts/${id}/prerequisites`, method: 'GET' }),

  getDependents: (id: string) =>
    request({ url: `/knowledge/concepts/${id}/dependents`, method: 'GET' }),

  getLearningPath: (id: string) =>
    request({ url: `/knowledge/concepts/${id}/learning-path`, method: 'GET' }),

  getCommonMistakes: (query?: string) =>
    request({ url: '/knowledge/common-mistakes', method: 'GET', params: query ? { q: query } : {} }),
}

export const interactiveLearningApi = {
  getDynamicGraph: (params?: Record<string, any>) =>
    request({ url: '/interactive-learning/graph/dynamic', method: 'GET', params }),

  getCognitiveState: () =>
    request({ url: '/interactive-learning/cognitive-state', method: 'GET' }),

  recordInteraction: (data: {
    scenarioId: string
    interactionType: string
    parameters: Record<string, any>
    result?: any
    duration?: number
  }) => request({ url: '/interactive-learning/interaction', method: 'POST', data }),

  getScenarios: (area?: string) =>
    request({ url: '/interactive-learning/scenarios', method: 'GET', params: area ? { area } : {} }),

  getScenarioByArea: (area: string) =>
    request({ url: `/interactive-learning/scenarios/by-area/${area}`, method: 'GET' }),

  getScenario: (id: string) =>
    request({ url: `/interactive-learning/scenarios/${id}`, method: 'GET' }),
}

export const learningApi = {
  recordLearning: (data: {
    conceptId: string
    action: 'view' | 'practice' | 'master' | 'review'
    mastery?: number
    timeSpent?: number
    correct?: boolean
  }) => request({ url: '/learning/record', method: 'POST', data }),

  getStats: () => request({ url: '/learning/stats', method: 'GET' }),

  getProgress: () => request({ url: '/learning/progress', method: 'GET' }),

  getReviewList: () => request({ url: '/learning/review-list', method: 'GET' }),

  getHistory: (options?: { page?: number; limit?: number }) =>
    request({ url: '/learning/history', method: 'GET', params: options || {} }),
}

export const agentApi = {
  diagnose: (data: {
    problem: string
    studentAnswer?: string
    context?: Record<string, any>
  }) => request({ url: '/agents/diagnose', method: 'POST', data }),

  solve: (data: {
    problem: string
    context?: Record<string, any>
  }) => request({ url: '/agents/solve', method: 'POST', data }),

  feedback: (data: {
    problem: string
    studentAnswer: string
    correctAnswer?: string
    context?: Record<string, any>
  }) => request({ url: '/agents/feedback', method: 'POST', data }),
}

export const questionsApi = {
  getRandom: (params?: { conceptId?: string; difficulty?: string; count?: number }) =>
    request({ url: '/questions/random', method: 'GET', params }),

  getById: (id: string) =>
    request({ url: `/questions/${id}`, method: 'GET' }),

  getSimilar: (params: { questionId: string; count?: number }) =>
    request({ url: '/questions/similar', method: 'GET', params }),

  recordMistake: (data: {
    questionId: string
    studentAnswer: string
    errorType?: string
  }) => request({ url: '/questions/mistakes', method: 'POST', data }),

  getMistakesByCategory: () =>
    request({ url: '/questions/mistakes/by-category', method: 'GET' }),
}
