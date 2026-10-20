import {
  KnowledgeNode,
  KnowledgeRelation,
  KnowledgeRelationType,
} from '../../knowledge/interfaces/knowledge.interfaces';

export interface ScenarioContext {
  id: string;
  knowledgeArea:
    | 'limits'
    | 'derivatives'
    | 'integrals'
    | 'series'
    | 'differential_equations'
    | 'multivariable'
    | 'vector_calculus';
  userLevel: number;
  taskUrgency: boolean;
  currentPhase: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface RelationContext {
  scenarioId?: string;
  relationType: KnowledgeRelationType;
  frequency?: number;
  lastUsed?: Date;
}

export interface DynamicKnowledgeNode extends KnowledgeNode {
  dynamicWeight: number;
  relevanceScore: number;
  activationLevel: number;
  masteryLevel: number;
  lastAccessed?: Date;
  accessCount: number;
}

export interface DynamicKnowledgeRelation extends KnowledgeRelation {
  dynamicWeight: number;
  contextWeights: Map<string, number>;
  strengthHistory: { date: number; weight: number }[];
}

export interface CognitiveState {
  userId: string;
  timestamp: Date;

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
    recommendedIntervention: InterventionType[];
  };
}

export type InterventionType =
  | 'hint'
  | 'simplify'
  | 'challenge'
  | 'review_prerequisite'
  | 'take_break'
  | 'switch_method'
  // 数据不足/服务降级时使用，前端据此提示“多练几题再看分析”
  | 'data_unavailable';

export interface VisualizationProtocol {
  render(params: VisualizationParams): RenderHandle;
  update(params: Partial<VisualizationParams>): void;
  dispose(): void;

  onInteraction(callback: (event: InteractionEvent) => void): void;
  onError(callback: (error: Error) => void): void;

  getCapabilities(): VisualizationCapabilities;
  getPerformanceMetrics(): PerformanceMetrics;
}

export interface VisualizationParams {
  type:
    | 'dynamic_graph'
    | 'riemann_sum'
    | 'tangent_line'
    | 'slope_field'
    | 'surface_3d'
    | 'series_partial_sum'
    | 'vector_field';
  data: Record<string, any>;
  config: {
    width?: number;
    height?: number;
    interactive?: boolean;
    animated?: boolean;
    colorScheme?: string;
  };
  callbacks?: {
    onHover?: (data: any) => void;
    onClick?: (data: any) => void;
    onDrag?: (data: any) => void;
  };
}

export interface RenderHandle {
  id: string;
  container: HTMLElement;
  destroy(): void;
  exportImage(format: 'png' | 'svg' | 'pdf'): Blob;
  getData(): any;
}

export interface InteractionEvent {
  type: 'hover' | 'click' | 'drag' | 'zoom' | 'pan' | 'select';
  timestamp: Date;
  data: any;
  coordinates?: { x: number; y: number };
}

export interface VisualizationCapabilities {
  types: string[];
  interactions: string[];
  exportFormats: string[];
  performanceTier: 'basic' | 'standard' | 'advanced';
  maxDataPoints: number;
}

export interface PerformanceMetrics {
  fps: number;
  memoryUsage: number;
  renderTime: number;
  frameCount: number;
}

export interface InteractiveScenario {
  id: string;
  name: string;
  description: string;
  version: string;
  knowledgeArea: ScenarioContext['knowledgeArea'];
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedDuration: number;

  learningPath: LearningPhase[];

  interactiveElements: {
    visualizations: VisualizationConfig[];
    dynamicParameters: ParameterConfig[];
    stepByStepGuide: StepGuide[];
  };

  assessment: AssessmentConfig;

  metadata: {
    author: string;
    createdAt: Date;
    updatedAt: Date;
    tags: string[];
    prerequisites: string[];
  };
}

export interface LearningPhase {
  id: string;
  name: string;
  order: number;
  conceptIds: string[];
  objectives: string[];
  tasks: InteractiveTask[];
  duration: number;
  unlockCondition?: {
    type: 'complete_previous' | 'mastery_threshold' | 'time_based';
    value: number | string;
  };
}

export interface InteractiveTask {
  id: string;
  phaseId: string;
  title: string;
  description: string;
  type:
    | 'exploration'
    | 'guided_practice'
    | 'challenge'
    | 'application'
    | 'assessment';

  interactionMode:
    | 'drag_drop'
    | 'input'
    | 'choice'
    | 'slider'
    | 'graph_interaction'
    | 'multi_step'
    | 'proof_builder';

  content: {
    text?: string;
    formula?: string;
    visualizationId?: string;
    media?: { type: 'image' | 'video' | 'audio'; url: string }[];
  };

  validation: {
    expectedAnswer: any;
    tolerance?: number;
    acceptedFormats?: string[];
    hintSystem: HintConfig;
    feedbackMessages: {
      correct: string;
      partial: string;
      incorrect: string;
    };
  };

  scoring: {
    maxPoints: number;
    timeBonus: boolean;
    hintPenalty: number;
    attemptPenalty: number;
  };

  adaptiveDifficulty: {
    enabled: boolean;
    adjustmentFactor: number;
    minDifficulty: number;
    maxDifficulty: number;
  };

  dependencies?: string[];
}

export interface HintConfig {
  maxHints: number;
  progressiveReveal: boolean;
  hints: {
    level: number;
    content: string;
    cost: number;
    type: 'text' | 'visual' | 'step' | 'example';
  }[];
}

export interface VisualizationConfig {
  id: string;
  type: VisualizationParams['type'];
  title: string;
  description: string;

  dataBinding: {
    source: 'static' | 'dynamic' | 'user_input' | 'api';
    dataSource?: string;
    refreshInterval?: number;
  };

  parameters: ParameterConfig[];

  interactions: {
    enabled: boolean;
    modes: InteractionEvent['type'][];
    callbacks: string[];
  };

  styling: {
    theme: 'light' | 'dark' | 'auto';
    colorPalette?: string[];
    fontSize?: number;
    showGrid?: boolean;
    showAxes?: boolean;
  };
}

export interface ParameterConfig {
  id: string;
  name: string;
  label: string;
  type: 'slider' | 'dropdown' | 'input' | 'toggle' | 'range';

  constraints: {
    min?: number;
    max?: number;
    step?: number;
    defaultValue: any;
    options?: { label: string; value: any }[];
  };

  binding: {
    target: string;
    transform?: (value: any) => any;
    unit?: string;
  };

  visibility?: {
    showIf?: {
      param: string;
      condition: 'equals' | 'greater' | 'less';
      value: any;
    };
  };
}

export interface StepGuide {
  id: string;
  taskId: string;
  steps: {
    id: string;
    title: string;
    content: string;
    visualization?: string;
    interaction?: {
      type: string;
      required: boolean;
      validate: (result: any) => boolean;
    };
    hint?: string;
  }[];

  navigation: {
    allowSkip: boolean;
    allowBack: boolean;
    progressIndicator: boolean;
  };
}

export interface AssessmentConfig {
  formativeChecks: FormativeCheck[];
  summativeTask?: InteractiveTask;
  adaptiveDifficulty: boolean;

  masteryThreshold: number;
  retryPolicy: {
    maxAttempts: number;
    cooldownPeriod: number;
    showExplanationAfter: number;
  };

  analytics: {
    trackTimeSpent: boolean;
    trackHintUsage: boolean;
    trackErrorPatterns: boolean;
    generateReport: boolean;
  };
}

export interface FormativeCheck {
  id: string;
  phaseId: string;
  title: string;
  checkPoint: 'after_task' | 'after_phase' | 'on_demand';
  questions: FormativeQuestion[];

  passingCriteria: {
    minCorrectRate: number;
    timeLimit?: number;
  };

  feedback: {
    showImmediateFeedback: boolean;
    detailedExplanations: boolean;
    suggestReviewTopics: boolean;
  };
}

export interface FormativeQuestion {
  id: string;
  type: 'multiple_choice' | 'short_answer' | 'calculation' | 'concept_map';
  question: string;
  options?: string[];
  expectedAnswer: any;
  explanation: string;
  difficulty: number;
  conceptIds: string[];
}

export interface ScenarioSession {
  id: string;
  scenarioId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  status: 'in_progress' | 'completed' | 'abandoned' | 'paused';

  currentPhase: string;
  currentTask: string;
  progress: {
    phasesCompleted: string[];
    tasksCompleted: string[];
    totalPoints: number;
    maxPossiblePoints: number;
  };

  cognitiveState: CognitiveState;
  interactions: InteractionEvent[];
  performance: {
    totalTimeSpent: number;
    averageTaskTime: number;
    hintUsageCount: number;
    errorCount: number;
    retryCount: number;
  };
}

// YAML配置相关类型（简化嵌套）
export interface YamlTask {
  id: string;
  type: string;
  title: string;
  [key: string]: any;
}

export interface YamlPhase {
  id: string;
  name: string;
  concept_ids: string[];
  tasks: YamlTask[];
}

export interface YamlQuestion {
  id: string;
  type: string;
  question: string;
  [key: string]: any;
}

export interface YamlFormativeCheck {
  id: string;
  questions: YamlQuestion[];
  check_point?: 'after_task' | 'after_phase' | 'on_demand';
  passing_criteria?: {
    min_correct_rate?: number;
    time_limit?: number;
  };
  feedback?: {
    show_immediate_feedback?: boolean;
    detailed_explanations?: boolean;
    suggest_review_topics?: boolean;
  };
}

export interface YamlVisualization {
  id: string;
  type: string;
  [key: string]: any;
}

export interface ScenarioYamlConfig {
  scenario: {
    id: string;
    name: string;
    description?: string;
    version: string;
    knowledge_area: string;
    difficulty: string;
    estimated_duration: number;
  };

  metadata?: {
    author?: string;
    tags?: string[];
    prerequisites?: string[];
  };

  learning_path?: YamlPhase[];

  visualizations?: YamlVisualization[];

  assessment?: {
    mastery_threshold?: number;
    formative_checks?: YamlFormativeCheck[];
  };
}
