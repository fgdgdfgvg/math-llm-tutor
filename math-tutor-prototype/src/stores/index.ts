import { create } from 'zustand';
import type { CognitiveState, DynamicGraphResponse, KnowledgeNode, KnowledgeRelation } from '../types';

interface AuthState {
  token: string | null;
  userId: string | null;
  username: string | null;
  isAuthenticated: boolean;
  login: (token: string, userId: string, username: string) => void;
  logout: () => void;
  restoreSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  userId: null,
  username: null,
  isAuthenticated: false,
  login: (token, userId, username) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_userId', userId);
    localStorage.setItem('auth_username', username);
    set({ token, userId, username, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_userId');
    localStorage.removeItem('auth_username');
    set({ token: null, userId: null, username: null, isAuthenticated: false });
  },
  restoreSession: () => {
    const token = localStorage.getItem('auth_token');
    const userId = localStorage.getItem('auth_userId');
    const username = localStorage.getItem('auth_username');
    if (token) {
      set({ token, userId, username, isAuthenticated: true });
    }
  },
}));

interface CognitiveStore {
  cognitiveState: CognitiveState | null;
  setCognitiveState: (state: CognitiveState) => void;
  selectedDimension: string | null;
  setSelectedDimension: (dim: string | null) => void;
  highlightedNodeIds: string[];
  setHighlightedNodeIds: (ids: string[]) => void;
  knowledgeAreaFilter: string | null;
  setKnowledgeAreaFilter: (area: string | null) => void;
}

const DEFAULT_COGNITIVE: CognitiveState = {
  userId: 'demo-user',
  timestamp: new Date().toISOString(),
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
    masteryPrediction: [0.72, 0.68, 0.75, 0.80, 0.82],
    optimalDifficulty: 0.6,
    recommendedIntervention: ['增加概念辨析练习', '强化证明推理训练', '减少计算量，聚焦理解'],
  },
  confidence: 0.75,
  lastUpdated: new Date().toISOString(),
};

export const useCognitiveStore = create<CognitiveStore>((set) => ({
  cognitiveState: DEFAULT_COGNITIVE,
  setCognitiveState: (state) => {
    localStorage.setItem('cognitive_state', JSON.stringify(state));
    set({ cognitiveState: state });
  },
  selectedDimension: null,
  setSelectedDimension: (dim) => set({ selectedDimension: dim }),
  highlightedNodeIds: [],
  setHighlightedNodeIds: (ids) => set({ highlightedNodeIds: ids }),
  knowledgeAreaFilter: null,
  setKnowledgeAreaFilter: (area) => set({ knowledgeAreaFilter: area }),
}));

interface GraphStore {
  nodes: KnowledgeNode[];
  edges: KnowledgeRelation[];
  mastery: Record<string, number>;
  dynamicData: DynamicGraphResponse | null;
  setGraphData: (nodes: KnowledgeNode[], edges: KnowledgeRelation[]) => void;
  setMastery: (mastery: Record<string, number>) => void;
  setDynamicData: (data: DynamicGraphResponse) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  pathStartId: string | null;
  pathEndId: string | null;
  setPathEndpoints: (start: string | null, end: string | null) => void;
}

export const useGraphStore = create<GraphStore>((set) => ({
  nodes: [],
  edges: [],
  mastery: {},
  dynamicData: null,
  setGraphData: (nodes, edges) => set({ nodes, edges }),
  setMastery: (mastery) => set({ mastery }),
  setDynamicData: (data) => set({ dynamicData: data }),
  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  pathStartId: null,
  pathEndId: null,
  setPathEndpoints: (start, end) => set({ pathStartId: start, pathEndId: end }),
}));

interface ScenarioStore {
  activeScenario: string | null;
  scenarioProgress: Record<string, { completed: boolean; score: number }>;
  setActiveScenario: (id: string | null) => void;
  updateProgress: (id: string, completed: boolean, score: number) => void;
}

export const useScenarioStore = create<ScenarioStore>((set, get) => ({
  activeScenario: null,
  scenarioProgress: JSON.parse(localStorage.getItem('scenario_progress') || '{}'),
  setActiveScenario: (id) => set({ activeScenario: id }),
  updateProgress: (id, completed, score) => {
    const progress = { ...get().scenarioProgress, [id]: { completed, score } };
    localStorage.setItem('scenario_progress', JSON.stringify(progress));
    set({ scenarioProgress: progress });
  },
}));
