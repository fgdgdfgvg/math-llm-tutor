export interface KnowledgeNode {
  id: string;
  name: string;
  type: 'Concept' | 'Theorem' | 'Formula' | 'Method' | 'Example' | 'Prerequisite';
  description: string;
  formula?: string;
  latex?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  examples?: string[];
}

export interface KnowledgeRelation {
  fromId: string;
  toId: string;
  type: 'PREREQUISITE' | 'RELATED_TO' | 'APPLIES_TO' | 'DERIVES_FROM' | 'EXAMPLE_OF' | 'USES_METHOD' | 'CONTAINS';
  weight?: number;
  description?: string;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeRelation[];
}

export interface DynamicGraphNode {
  id: string;
  name: string;
  type: string;
  dynamicWeight: number;
  relevanceScore: number;
  activationLevel: number;
  masteryLevel: number;
  tags: string[];
}

export interface DynamicGraphResponse {
  nodes: DynamicGraphNode[];
  relations: KnowledgeRelation[];
  filtered: boolean;
  totalNodes: number;
  statistics: Record<string, unknown>;
}

export interface CognitiveState {
  userId: string;
  timestamp: string;
  dimensions: {
    conceptualUnderstanding: number;
    proceduralFluency: number;
    strategicCompetence: number;
    adaptiveReasoning: number;
  };
  metrics: {
    cognitiveLoad: number;
    learningVelocity: number;
    errorPattern: string[];
    attentionLevel: number;
    frustrationLevel: number;
  };
  predictions: {
    masteryPrediction: number[];
    optimalDifficulty: number;
    recommendedIntervention: string[];
  };
  confidence: number;
  lastUpdated: string;
}

export interface ScenarioSummary {
  id: string;
  name: string;
  description: string;
  knowledgeArea: string;
  difficulty: string;
  estimatedDuration: number;
  version: string;
  phaseCount: number;
  taskCount: number;
  isValid: boolean;
  validationErrors: string[];
}

export interface LearningPath {
  conceptId: string;
  path: KnowledgeNode[];
  estimatedTime: number;
  prerequisites: KnowledgeNode[];
}
