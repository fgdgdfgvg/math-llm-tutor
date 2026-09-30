import { Logger } from '@nestjs/common';
import { AgentContext, SolvePlan, KnowledgePoint, VerificationResult, FeedbackResult } from './agent.types';

// 解决方案步骤
export interface SolutionStep {
  stepId: string;
  stepTitle: string;
  keyPoint: string;
  formula: string;
  process: string;
  result: string;
  highlight: string;
  self_check: string;
  cot_reasoning: string;
  isValid: boolean;
}

export interface SystemState {
  problem: string;
  problemType: string;
  confidence: number;
  plan: SolvePlan | null;
  knowledgePoints: KnowledgePoint[];
  solutionSteps: SolutionStep[];
  intermediateResults: any[];
  finalAnswer: string;
  verificationResults: VerificationResult[];
  feedback: FeedbackResult | null;
  currentStepIndex: number;
  totalSteps: number;
  errors: Array<{
    step: string;
    agent: string;
    message: string;
    timestamp: number;
    severity: 'error' | 'warning' | 'info';
  }>;
  metadata: Record<string, any>;
  snapshots: SystemStateSnapshot[];
  status: 'initializing' | 'planning' | 'solving' | 'diagnosing' | 'feedback' | 'completed' | 'failed';
  iteration: number;
  maxIterations: number;
}

export interface SystemStateSnapshot {
  id: string;
  timestamp: number;
  agent: string;
  action: string;
  state: Partial<SystemState>;
  previousState?: Partial<SystemState>;
}

export interface StateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingFields: string[];
}

export class StateManager {
  private readonly logger = new Logger(StateManager.name);
  private currentState: SystemState;
  private readonly maxSnapshots: number = 50;

  constructor() {
    this.currentState = this.createInitialState();
  }

  private createInitialState(): SystemState {
    return {
      problem: '',
      problemType: 'unknown',
      confidence: 0,
      plan: null,
      knowledgePoints: [],
      solutionSteps: [],
      intermediateResults: [],
      finalAnswer: '',
      verificationResults: [],
      feedback: null,
      currentStepIndex: 0,
      totalSteps: 0,
      errors: [],
      metadata: {},
      snapshots: [],
      status: 'initializing',
      iteration: 0,
      maxIterations: 3,
    };
  }

  initialize(problem: string): SystemState {
    this.logger.log('初始化系统状态');
    this.currentState = this.createInitialState();
    this.currentState.problem = problem;
    this.currentState.status = 'initializing';
    this.takeSnapshot('system', '初始化');
    return this.getCurrentState();
  }

  getCurrentState(): SystemState {
    return { ...this.currentState };
  }

  getStateCopy(): SystemState {
    return JSON.parse(JSON.stringify(this.currentState));
  }

  updateProblemType(type: string, confidence: number = 0.8): void {
    const previousType = this.currentState.problemType;
    this.currentState.problemType = type;
    this.currentState.confidence = confidence;
    
    if (previousType !== type) {
      this.logger.log(`更新问题类型: ${previousType} → ${type} (置信度: ${confidence})`);
      this.takeSnapshot('classifier', `问题类型识别: ${type}`);
    }
  }

  updatePlan(plan: SolvePlan): void {
    const previousPlan = this.currentState.plan;
    this.currentState.plan = plan;
    this.currentState.totalSteps = plan.steps?.length || 0;
    this.currentState.status = 'planning';
    
    if (!previousPlan || JSON.stringify(previousPlan) !== JSON.stringify(plan)) {
      this.logger.log(`更新解题计划: ${plan.problemType}, ${this.currentState.totalSteps}步`);
      this.takeSnapshot('planner', '生成解题计划', { previousState: { plan: previousPlan } });
    }
  }

  addKnowledgePoints(points: KnowledgePoint[]): void {
    const existingNames = new Set(this.currentState.knowledgePoints.map(kp => kp.name));
    const newPoints = points.filter(p => !existingNames.has(p.name));
    
    if (newPoints.length > 0) {
      this.currentState.knowledgePoints.push(...newPoints);
      this.logger.log(`添加${newPoints.length}个知识点 (总计: ${this.currentState.knowledgePoints.length})`);
      this.takeSnapshot('planner', `添加知识点: ${newPoints.map(p => p.name).join(', ')}`);
    }
  }

  addSolutionStep(step: SolutionStep, index?: number): void {
    if (index !== undefined) {
      this.currentState.solutionSteps[index] = step;
    } else {
      this.currentState.solutionSteps.push(step);
    }
    this.currentState.currentStepIndex = this.currentState.solutionSteps.length - 1;
    this.currentState.status = 'solving';
    
    this.logger.log(`添加解题步骤 #${this.currentState.currentStepIndex + 1}: ${step.stepTitle}`);
    this.takeSnapshot('solver', `执行步骤${this.currentState.currentStepIndex + 1}`);
  }

  updateIntermediateResults(results: any[]): void {
    this.currentState.intermediateResults = results;
  }

  updateFinalAnswer(answer: string): void {
    this.currentState.finalAnswer = answer;
    this.logger.log(`更新最终答案: ${answer.substring(0, 50)}...`);
    this.takeSnapshot('solver', '生成最终答案');
  }

  updateVerificationResults(results: VerificationResult[]): void {
    this.currentState.verificationResults = results;
    this.currentState.status = 'diagnosing';
    
    const passedCount = results.filter(r => r.isValid).length;
    this.logger.log(`验证结果: ${passedCount}/${results.length} 通过`);
    this.takeSnapshot('diagnostic', `步骤验证完成 (${passedCount}/${results.length})`);
  }

  updateFeedback(feedback: FeedbackResult): void {
    this.currentState.feedback = feedback;
    this.currentState.status = 'feedback';
    this.logger.log(`更新反馈: 准确率${Math.round((feedback.accuracy || 0) * 100)}%`);
    this.takeSnapshot('feedback', '生成反馈');
  }

  addError(error: Omit<SystemState['errors'][0], 'timestamp'>): void {
    const errorEntry = { ...error, timestamp: Date.now() };
    this.currentState.errors.push(errorEntry);
    this.logger.error(`[${error.severity.toUpperCase()}] ${error.agent}: ${error.message}`);
  }

  setStatus(status: SystemState['status']): void {
    this.currentState.status = status;
  }

  incrementIteration(): void {
    this.currentState.iteration++;
    this.logger.log(`迭代次数: ${this.currentState.iteration}/${this.currentState.maxIterations}`);
  }

  validateState(): StateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingFields: string[] = [];

    if (!this.currentState.problem || this.currentState.problem.trim().length === 0) {
      missingFields.push('problem');
      errors.push('问题描述为空');
    }

    if (this.currentState.problemType === 'unknown') {
      warnings.push('问题类型未识别');
    }

    if (!this.currentState.plan) {
      warnings.push('解题计划缺失');
    } else if (!this.currentState.plan.steps || this.currentState.plan.steps.length === 0) {
      errors.push('解题计划无步骤');
      missingFields.push('plan.steps');
    }

    if (this.currentState.solutionSteps.length === 0 && this.currentState.status !== 'initializing' && this.currentState.status !== 'planning') {
      warnings.push('暂无解题步骤');
    }

    if (!this.currentState.finalAnswer && this.currentState.status === 'completed') {
      warnings.push('最终答案为空');
    }

    if (this.currentState.knowledgePoints.length === 0) {
      warnings.push('知识点分析缺失');
    }

    const isValid = errors.length === 0;

    return {
      isValid,
      errors,
      warnings,
      missingFields,
    };
  }

  hasErrors(): boolean {
    return this.currentState.errors.some(e => e.severity === 'error');
  }

  getErrors(severity?: SystemState['errors'][0]['severity']): SystemState['errors'] {
    if (severity) {
      return this.currentState.errors.filter(e => e.severity === severity);
    }
    return [...this.currentState.errors];
  }

  canContinue(): boolean {
    const validation = this.validateState();
    if (!validation.isValid && validation.errors.some(e => e.includes('为空'))) {
      return false;
    }
    if (this.currentState.iteration >= this.currentState.maxIterations) {
      this.logger.warn(`达到最大迭代次数(${this.currentState.maxIterations})`);
      return false;
    }
    return true;
  }

  takeSnapshot(agent: string, action: string, extraData?: { previousState?: Partial<SystemState> }): SystemStateSnapshot {
    const snapshot: SystemStateSnapshot = {
      id: `snap_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
      agent,
      action,
      state: this.getStateCopy(),
      ...extraData,
    };

    this.currentState.snapshots.push(snapshot);

    if (this.currentState.snapshots.length > this.maxSnapshots) {
      this.currentState.snapshots = this.currentState.snapshots.slice(-this.maxSnapshots);
    }

    return snapshot;
  }

  getSnapshots(agent?: string): SystemStateSnapshot[] {
    if (agent) {
      return this.currentState.snapshots.filter(s => s.agent === agent);
    }
    return [...this.currentState.snapshots];
  }

  rollbackToSnapshot(snapshotId: string): boolean {
    const snapshotIndex = this.currentState.snapshots.findIndex(s => s.id === snapshotId);
    if (snapshotIndex === -1) {
      this.logger.warn(`快照不存在: ${snapshotId}`);
      return false;
    }

    const snapshot = this.currentState.snapshots[snapshotIndex];
    this.logger.log(`回滚到快照: ${snapshot.action} (${new Date(snapshot.timestamp).toLocaleString()})`);

    Object.assign(this.currentState, snapshot.state);
    this.currentState.snapshots = this.currentState.snapshots.slice(0, snapshotIndex + 1);

    return true;
  }

  generateFallbackForAgent(agentName: string): Partial<SystemState> {
    const fallback: Record<string, Partial<SystemState>> = {
      planner: {
        plan: {
          problemType: this.classifyProblemQuick(this.currentState.problem),
          keyConditions: [this.currentState.problem],
          macroStrategy: '通用求解策略',
          steps: [
            { id: 'step1', description: '理解题意', tool: 'llm' },
            { id: 'step2', description: '选择方法并计算', tool: 'sympy' },
            { id: 'step3', description: '验证结果', tool: 'llm' },
          ],
          estimatedDifficulty: 'medium',
        },
        knowledgePoints: [{ name: '数学分析基础', description: '相关数学概念' } as KnowledgePoint],
      },
      solver: {
        solutionSteps: [
          {
            stepId: 'step1',
            stepTitle: '问题分析',
            keyPoint: '识别问题类型与关键信息',
            formula: '',
            process: `分析问题"${this.currentState.problem}": 确定问题所属数学领域，提取已知条件和求解目标，判断适用的定理和方法`,
            result: '明确解题方向',
            highlight: '正确理解问题是解题成功的关键第一步',
            self_check: '检查是否充分理解了问题中的所有条件',
            cot_reasoning: '通过审题确定问题类型，避免方向性错误',
            isValid: false,
          },
          {
            stepId: 'step2',
            stepTitle: '选择方法',
            keyPoint: '根据问题类型选择恰当的数学方法',
            formula: '',
            process: `选择适合"${(this.currentState as any).metadata?.problemCategory || this.currentState.problemType || '上述问题'}"的求解方法，考虑计算效率和准确性`,
            result: '确定解题方法',
            highlight: '方法选择决定了后续计算的方向和效率',
            self_check: '确保所选方法适用于当前问题类型',
            cot_reasoning: '根据问题特征匹配最佳求解策略',
            isValid: false,
          },
          {
            stepId: 'step3',
            stepTitle: '执行求解',
            keyPoint: '按步骤执行计算并验证',
            formula: '',
            process: '按照选定的方法逐步求解，注意中间步骤的准确性',
            result: '（计算结果）',
            highlight: '计算过程中每一步都需逻辑验证',
            self_check: '验证计算过程是否有遗漏或错误',
            cot_reasoning: '逐步推进计算，每步都需逻辑验证',
            isValid: false,
          },
          {
            stepId: 'step4',
            stepTitle: '结果验证',
            keyPoint: '验证最终结果的正确性',
            formula: '',
            process: '将结果代入原问题验证，检查单位、符号、边界条件等',
            result: '验证通过/需修正',
            highlight: '最终验证是确保答案正确性的关键环节',
            self_check: '确认答案在数学和实际意义上都合理',
            cot_reasoning: '最终检查确保答案的完整性和准确性',
            isValid: false,
          },
        ],
        metadata: {
          fallbackReason: '各模型API未配置或不可达。请在.env中配置至少一个模型API密钥以获取完整求解能力。本地规则引擎已尽力提供结构化分析框架。',
        },
      },
      diagnostic: {
        verificationResults: Array.from(
          { length: Math.max(this.currentState.solutionSteps.length, 1) },
          (_, i) => ({
            stepId: `step${i + 1}`,
            isValid: false,
            errorMessage: '解析失败：无法验证此步骤的正确性（请检查AI模型配置）',
            confidence: 0.0,
            isFallback: true,
          })
        ),
      },
      feedback: {
        feedback: {
          accuracy: 0.6,
          completeness: Math.min(1, (this.currentState.solutionSteps?.length || 0) / 4),
          clarity: 0.7,
          suggestions: ['建议配置AI模型以获得更精准的诊断反馈'],
          improvements: ['加强基础知识学习'],
          rating: 'average',
        },
      },
    };

    return fallback[agentName] || {};
  }

  private classifyProblemQuick(problem: string): string {
    if (!problem) return '未知类型';
    const p = problem.toLowerCase();
    if (p.includes('极限') || p.includes('limit')) return '极限计算';
    if (p.includes('导数') || p.includes('derivative')) return '导数求解';
    if (p.includes('积分') || p.includes('integral')) return '积分计算';
    return '综合数学问题';
  }

  toAgentContext(): AgentContext {
    return {
      problem: this.currentState.problem,
      plan: this.currentState.plan as any,
      solutionSteps: this.currentState.solutionSteps.map(s => JSON.stringify(s)),
      finalAnswer: this.currentState.finalAnswer,
      knowledgePoints: this.currentState.knowledgePoints,
      verificationResults: this.currentState.verificationResults,
      feedback: this.currentState.feedback as any,
      agentHistory: [],
      intermediateResults: this.currentState.intermediateResults,
      metadata: this.currentState.metadata,
      iteration: this.currentState.iteration,
      maxIterations: this.currentState.maxIterations,
    };
  }

  fromAgentContext(context: AgentContext): void {
    if (context.problem) this.currentState.problem = context.problem;
    if (context.plan) this.currentState.plan = context.plan;
    if (context.solutionSteps) {
      this.currentState.solutionSteps = context.solutionSteps.map(s => {
        try {
          return typeof s === 'string' ? JSON.parse(s) : s;
        } catch {
          return { stepTitle: s, keyPoint: '', formula: '', process: s, result: '', highlight: '' };
        }
      });
    }
    if (context.finalAnswer) this.currentState.finalAnswer = context.finalAnswer;
    if (context.knowledgePoints) this.currentState.knowledgePoints = context.knowledgePoints;
    if (context.verificationResults) this.currentState.verificationResults = context.verificationResults;
    if (context.feedback) this.currentState.feedback = context.feedback;
    if (context.intermediateResults) this.currentState.intermediateResults = context.intermediateResults;
    if (context.metadata) this.currentState.metadata = { ...this.currentState.metadata, ...context.metadata };
  }

  getDebugInfo(): any {
    return {
      status: this.currentState.status,
      problemType: this.currentState.problemType,
      confidence: this.currentState.confidence,
      stepCount: this.currentState.solutionSteps.length,
      totalSteps: this.currentState.totalSteps,
      knowledgePointCount: this.currentState.knowledgePoints.length,
      errorCount: this.currentState.errors.length,
      snapshotCount: this.currentState.snapshots.length,
      iteration: this.currentState.iteration,
      validation: this.validateState(),
    };
  }

  reset(): void {
    this.logger.log('重置系统状态');
    this.currentState = this.createInitialState();
  }

  exportState(): string {
    return JSON.stringify(this.getStateCopy(), null, 2);
  }

  importState(stateJson: string): boolean {
    try {
      const imported = JSON.parse(stateJson) as SystemState;
      
      const requiredFields: (keyof SystemState)[] = ['problem', 'problemType', 'status'];
      for (const field of requiredFields) {
        if (!(field in imported)) {
          this.logger.error(`导入的状态缺少必要字段: ${field}`);
          return false;
        }
      }

      this.currentState = imported;
      this.logger.log('成功导入系统状态');
      return true;
    } catch (error) {
      this.logger.error('导入状态失败', error.message);
      return false;
    }
  }
}
