import type {
  KnowledgeGraph,
  KnowledgeNode,
  DynamicGraphResponse,
  CognitiveState,
  ScenarioSummary,
  LearningPath,
} from '../types';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
  if (!res.ok) {
    throw new Error(`API Error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const knowledgeApi = {
  getGraph: () => request<KnowledgeGraph>('/knowledge/graph'),

  getConcept: (id: string) => request<KnowledgeNode>(`/knowledge/concepts/${id}`),

  getPrerequisites: (id: string) => request<KnowledgeNode[]>(`/knowledge/concepts/${id}/prerequisites`),

  getDependents: (id: string) => request<KnowledgeNode[]>(`/knowledge/concepts/${id}/dependents`),

  getLearningPath: (id: string) => request<LearningPath>(`/knowledge/concepts/${id}/learning-path`),

  search: (q: string) => request<KnowledgeNode[]>(`/knowledge/search?q=${encodeURIComponent(q)}`),

  getCommonMistakes: (q: string) => request<{ mistake: string; tip: string }[]>(`/knowledge/common-mistakes?q=${encodeURIComponent(q)}`),

  getStatus: () => request<{ usingFallback: boolean; nodeCount: number }>('/knowledge/status'),
};

export const interactiveLearningApi = {
  getDynamicGraph: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<DynamicGraphResponse>(`/interactive-learning/graph/dynamic${query}`);
  },

  getCognitiveState: () => request<CognitiveState>('/interactive-learning/cognitive-state'),

  recordInteraction: (data: {
    nodeId: string;
    interactionType: 'view' | 'practice' | 'master' | 'review';
    scenarioId?: string;
    timeSpent?: number;
  }) =>
    request<{ success: boolean; message: string }>('/interactive-learning/interaction', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getScenarios: () => request<ScenarioSummary[]>('/interactive-learning/scenarios'),

  getScenariosByArea: (area: string) => request<ScenarioSummary[]>(`/interactive-learning/scenarios/by-area/${area}`),

  getScenario: (id: string) => request<ScenarioSummary>(`/interactive-learning/scenarios/${id}`),
};

export const authApi = {
  // 后端的登录路由是 /user/login（不是 /auth/login）——此前调错路径导致登录 404。
  // 注意：access token 现在只有 15 分钟，本前端未实现 refresh 续期，
  // 过期后需重新登录（续期能力见 uniapp-frontend 的实现）。
  login: (username: string, password: string) =>
    request<{ access_token: string; user: { id: string; username: string } }>('/user/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
};
