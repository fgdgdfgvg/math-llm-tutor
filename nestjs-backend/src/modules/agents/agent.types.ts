// 智能体类型定义

// 智能体输入输出基础结构
export interface AgentInput {
  problem: string;
  context?: AgentContext;
  metadata?: Record<string, any>;
}

export interface AgentOutput {
  result: any;
  context: AgentContext;
  status: 'success' | 'failure' | 'partial';
  message?: string;
  executionTime?: number;
}

// 智能体上下文
export interface AgentContext {
  problem: string;
  knowledgePoints?: KnowledgePoint[];
  plan?: SolvePlan;
  solutionSteps?: string[];
  intermediateResults?: any[];
  verificationResults?: VerificationResult[];
  feedback?: FeedbackResult;
  finalAnswer?: string;
  agentHistory: AgentExecution[];
  metadata: Record<string, any>;
  iteration?: number;
  maxIterations?: number;
}

// 知识点
export interface KnowledgePoint {
  id: string;
  name: string;
  description: string;
  formula?: string;
  latex?: string;
  difficulty: string;
  tags: string[];
}

// 解题计划
export interface SolvePlan {
  problemType: string;
  keyConditions: string[];
  macroStrategy: string;
  steps: {
    id: string;
    description: string;
    tool?: 'sympy' | 'llm' | 'calculator';
    expectedOutput?: string;
    microOperations?: string[];
  }[];
  estimatedDifficulty: 'easy' | 'medium' | 'hard';
  alternativeApproaches?: string[];
  adjusted?: boolean;
  errorStep?: number;
}

// 验证结果
export interface VerificationResult {
  stepId: string;
  isValid: boolean;
  errorMessage?: string;
  confidence: number;
}

// 反馈结果
export interface FeedbackResult {
  accuracy: number;
  completeness: number;
  clarity: number;
  suggestions: string[];
  improvements: string[];
  rating: 'excellent' | 'good' | 'average' | 'poor';
}

// 智能体执行记录
export interface AgentExecution {
  agentName: string;
  timestamp: number;
  input: any;
  output: any;
  duration: number;
  status: 'success' | 'failure' | 'partial';
}

// 智能体配置
export interface AgentConfig {
  name: string;
  model?: 'DeepSeek' | 'KatCoder' | 'GPT5.2';
  timeout?: number;
  maxRetries?: number;
  parameters?: Record<string, any>;
}

// 智能体编排配置
export interface AgentOrchestratorConfig {
  agents: AgentConfig[];
  workflow: string[]; // 智能体执行顺序
  maxExecutionTime?: number;
  fallbackStrategy?: 'retry' | 'skip' | 'use-default';
}

// 多智能体协作结果
export interface MultiAgentResult {
  finalAnswer: string;
  solutionSteps: string[];
  knowledgePoints: KnowledgePoint[];
  verificationResults: VerificationResult[];
  feedback: FeedbackResult;
  executionHistory: AgentExecution[];
  totalExecutionTime: number;
  status: 'success' | 'partial' | 'failure';
  agentDetails: AgentDetailResults;
}

// 各智能体的详细输出（用于前端展示完整工作过程）
export interface AgentDetailResults {
  planner: {
    summary: string;
    problemType: string;
    keyConditions: string[];
    planOverview: string;
    rawOutput?: any;
  };
  solver: {
    summary: string;
    stepCount: number;
    approach: string;
    rawOutput?: any;
  };
  diagnostic: {
    summary: string;
    passedSteps: number;
    totalSteps: number;
    confidence: number;
    rawOutput?: any;
  };
  feedback: {
    summary: string;
    rating: string;
    keySuggestions: string[];
    rawOutput?: any;
  };
}
