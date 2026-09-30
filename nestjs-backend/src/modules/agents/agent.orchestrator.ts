import { Logger } from '@nestjs/common';
import { Subject } from 'rxjs';
import { AgentInput, AgentOutput, AgentOrchestratorConfig, MultiAgentResult, AgentExecution, AgentDetailResults, AgentContext } from './agent.types';
import { BaseAgent } from './agent.base';
import { StateManager } from './state-manager.service';
import { InputPreprocessor } from './input-preprocessor.service';
import { StepExecutionEngine } from './step-execution.service';
import { OutputStandardizer } from './output-standardizer.service';

// 智能体执行统计信息
interface AgentStats {
  successCount: number;
  totalCount: number;
  averageExecutionTime: number;
  lastExecutionTime: number;
  errorRate: number;
}

// 智能体编排器
export interface AgentProgressEvent {
  type: 'agent_start' | 'agent_complete' | 'agent_error' | 'step_update' | 'complete';
  agentName?: string;
  message: string;
  timestamp: number;
  data?: any;
}

const MAX_EXECUTION_HISTORY = 100;

export class AgentOrchestrator {
  private readonly logger: Logger;
  private config: AgentOrchestratorConfig;
  private readonly agents: Map<string, BaseAgent>;
  private agentStats: Map<string, AgentStats>;
  private problemTypeCache: Map<string, string[]>;
  private stateManager: StateManager;
  private inputPreprocessor: InputPreprocessor;
  private stepExecutionEngine: StepExecutionEngine;
  private outputStandardizer: OutputStandardizer;
  public progressEvents = new Subject<AgentProgressEvent>();

  constructor(config: AgentOrchestratorConfig, agents: BaseAgent[]) {
    this.logger = new Logger(AgentOrchestrator.name);
    this.config = config;
    this.agents = new Map();
    this.agentStats = new Map();
    this.problemTypeCache = new Map();

    // 注册智能体
    agents.forEach((agent) => {
      this.agents.set(agent.name, agent);
      this.agentStats.set(agent.name, {
        successCount: 0,
        totalCount: 0,
        averageExecutionTime: 0,
        lastExecutionTime: 0,
        errorRate: 0,
      });
    });

    // 初始化服务
    this.stateManager = new StateManager();
    this.inputPreprocessor = new InputPreprocessor();
    this.stepExecutionEngine = new StepExecutionEngine(this.stateManager);
    this.outputStandardizer = new OutputStandardizer();
  }

  // 执行多智能体协作流程
  async execute(input: AgentInput): Promise<MultiAgentResult> {
    const startTime = Date.now();
    this.logger.log('开始执行多智能体协作流程（中心化状态管理）');

    // 初始化状态管理器
    this.stateManager.initialize(input.problem);
    
    const executionHistory: AgentExecution[] = [];
    let status: 'success' | 'partial' | 'failure' = 'success';

    try {
      // 1. 输入预处理和问题分类
      this.logger.log('执行输入预处理...');
      const validation = this.inputPreprocessor.validateInput(input.problem);
      if (!validation.isValid) {
        this.logger.warn(`输入验证失败: ${validation.errors.join(', ')}`);
        return this.generateErrorResult('输入验证失败', startTime, validation.errors);
      }

      const { normalized, transformations } = this.inputPreprocessor.normalizeInput(input.problem);
      this.logger.log(`输入标准化: ${transformations.join(', ')}`);

      const classification = await this.inputPreprocessor.classifyProblem(normalized);
      this.logger.log(`问题分类: ${classification.primaryType} (置信度: ${classification.confidence})`);
      this.stateManager.updateProblemType(classification.primaryType, classification.confidence);

      // 2. 智能体执行流程
      await this.executeAgentFlow(input, executionHistory, classification);

      // 3. 状态验证
      const stateValidation = this.stateManager.validateState();
      if (!stateValidation.isValid) {
        this.logger.warn(`状态验证失败: ${stateValidation.errors.join(', ')}`);
        for (const error of stateValidation.errors) {
          this.stateManager.addError({
            step: 'state-validation',
            agent: 'system',
            message: error,
            severity: 'error',
          });
        }
        status = 'partial';
      }

      // 4. 生成标准化输出
      this.logger.log('生成标准化输出...');
      const standardOutput = this.outputStandardizer.generateStandardOutput(
        this.stateManager.getCurrentState(),
        classification
      );

      // 5. 构建最终结果
      const totalExecutionTime = Date.now() - startTime;
      const sanitizedExecutionHistory = this.sanitizeExecutionHistory(executionHistory);
      const agentDetails = this.buildAgentDetails(executionHistory, this.stateManager.toAgentContext());

      const result: MultiAgentResult = {
        finalAnswer: standardOutput.finalAnswer,
        solutionSteps: standardOutput.solutionSteps.map(s => JSON.stringify(s)),
        knowledgePoints: standardOutput.knowledgePoints.map((kp, index) => ({
          ...kp,
          id: `kp_${index + 1}`,
          tags: [standardOutput.problemType],
        })),
        verificationResults: this.stateManager.getCurrentState().verificationResults || [],
        feedback: {
          accuracy: 0.8,
          completeness: 0.9,
          clarity: 0.7,
          suggestions: [standardOutput.learningAdvice],
          improvements: [],
          rating: 'good',
        },
        executionHistory: sanitizedExecutionHistory,
        agentDetails,
        totalExecutionTime,
        status: this.stateManager.hasErrors() ? 'partial' : status,
      };

      this.logger.log(`多智能体协作流程执行完成 (${totalExecutionTime}ms)`);
      return result;
    } catch (error) {
      const totalExecutionTime = Date.now() - startTime;
      this.logger.error('多智能体协作流程执行失败', error);

      // 生成降级输出
      const fallbackOutput = this.outputStandardizer.generateFallbackOutput(input.problem);
      
      const result: MultiAgentResult = {
        finalAnswer: fallbackOutput.finalAnswer,
        solutionSteps: fallbackOutput.solutionSteps.map(s => JSON.stringify(s)),
        knowledgePoints: fallbackOutput.knowledgePoints.map((kp, index) => ({
          ...kp,
          id: `kp_${index + 1}`,
          tags: ['general'],
        })),
        verificationResults: [],
        feedback: {
          accuracy: 0.5,
          completeness: 0.5,
          clarity: 0.5,
          suggestions: [fallbackOutput.learningAdvice],
          improvements: [],
          rating: 'poor',
        },
        executionHistory: [],
        agentDetails: {
          planner: { summary: '规划阶段未执行', problemType: 'unknown', keyConditions: [], planOverview: '' },
          solver: { summary: '求解阶段未执行', stepCount: 0, approach: '' },
          diagnostic: { summary: '诊断阶段未执行', passedSteps: 0, totalSteps: 0, confidence: 0 },
          feedback: { summary: '反馈阶段未执行', rating: 'poor', keySuggestions: [] },
        },
        totalExecutionTime,
        status: 'failure',
      };

      return result;
    }
  }

  private async executeAgentFlow(
    input: AgentInput,
    executionHistory: AgentExecution[],
    classification: any
  ): Promise<void> {
    const agents = ['planner', 'solver', 'diagnostic', 'feedback'];
    
    for (const agentName of agents) {
      this.logger.log(`执行智能体: ${agentName}`);
      
      this.progressEvents.next({
        type: 'agent_start',
        agentName,
        message: `正在调用${agentName}智能体...`,
        timestamp: Date.now(),
      });
      
      const agent = this.agents.get(agentName);
      if (!agent) {
        this.logger.warn(`智能体不存在: ${agentName}`);
        this.stateManager.addError({
          step: agentName,
          agent: 'system',
          message: `智能体 ${agentName} 未找到`,
          severity: 'warning',
        });
        continue;
      }

      const agentInput: AgentInput = {
        problem: input.problem,
        context: this.stateManager.toAgentContext(),
        metadata: { ...input.metadata, classification },
      };

      try {
        const agentStartTime = Date.now();
        const agentOutput = await agent.execute(agentInput);
        const agentExecutionTime = Date.now() - agentStartTime;

        // 更新状态
        this.stateManager.fromAgentContext(agentOutput.context);

        // 记录执行历史
        executionHistory.push({
          agentName,
          timestamp: Date.now(),
          input: agentInput,
          output: agentOutput,
          duration: agentExecutionTime,
          status: agentOutput.status,
        });

        if (executionHistory.length > MAX_EXECUTION_HISTORY) {
          executionHistory.splice(0, executionHistory.length - MAX_EXECUTION_HISTORY);
        }

        if (agentOutput.status === 'success') {
          this.updateAgentStats(agentName, true, agentExecutionTime);
          this.progressEvents.next({
            type: 'agent_complete',
            agentName,
            message: `${agentName}智能体执行成功 (${agentExecutionTime}ms)`,
            timestamp: Date.now(),
            data: { duration: agentExecutionTime },
          });
        } else {
          this.updateAgentStats(agentName, false, agentExecutionTime);
          this.stateManager.addError({
            step: agentName,
            agent: agentName,
            message: `智能体执行失败: ${agentOutput.status}`,
            severity: 'warning',
          });
        }

      } catch (error) {
        this.logger.warn(`智能体执行出错: ${agentName}`, error.message);
        this.updateAgentStats(agentName, false, 0);
        
        this.stateManager.addError({
          step: agentName,
          agent: agentName,
          message: error.message,
          severity: 'error',
        });

        this.progressEvents.next({
          type: 'agent_error',
          agentName,
          message: `${agentName}智能体执行出错: ${error.message}`,
          timestamp: Date.now(),
        });

        // 应用降级策略 - 直接调用 stateManager 的方法更新内部状态
        const fallbackData = this.stateManager.generateFallbackForAgent(agentName);
        this.applyFallbackToStateManager(fallbackData, agentName);
      }

      // 状态验证
      const validation = this.stateManager.validateState();
      if (!validation.isValid) {
        this.logger.warn(`智能体 ${agentName} 执行后状态验证失败: ${validation.errors.join(', ')}`);
      }

      // 检查是否可以继续
      if (!this.stateManager.canContinue()) {
        this.logger.warn('状态验证失败，停止执行');
        break;
      }
    }
  }

  private sanitizeExecutionHistory(executionHistory: AgentExecution[]): AgentExecution[] {
    return executionHistory.map((exec) => {
      let safeOutput: any;
      if (typeof exec.output === 'object' && exec.output !== null) {
        const { context, ...rest } = exec.output;
        safeOutput = {
          status: exec.output.status || 'success',
          result: exec.output.result ?? null,
          hasContext: !!context,
          stepCount: context?.solutionSteps?.length || 0,
        };
      } else {
        safeOutput = exec.output;
      }
      return {
        agentName: exec.agentName,
        timestamp: exec.timestamp || Date.now(),
        input: typeof exec.input === 'object' ? { problem: exec.input.problem || '' } : exec.input,
        output: safeOutput,
        duration: exec.duration,
        status: exec.status,
      };
    });
  }

  private generateErrorResult(
    errorMessage: string,
    startTime: number,
    errors: string[]
  ): MultiAgentResult {
    const totalExecutionTime = Date.now() - startTime;
    
    return {
      finalAnswer: '无法生成最终答案',
      solutionSteps: [],
      knowledgePoints: [],
      verificationResults: [],
      feedback: {
        accuracy: 0,
        completeness: 0,
        clarity: 0,
        suggestions: ['检查输入格式是否正确'],
        improvements: errors,
        rating: 'poor',
      },
      executionHistory: [],
      agentDetails: {
        planner: { summary: '规划阶段未执行', problemType: '', keyConditions: [], planOverview: '' },
        solver: { summary: '求解阶段未执行', stepCount: 0, approach: '' },
        diagnostic: { summary: '诊断阶段未执行', passedSteps: 0, totalSteps: 0, confidence: 0 },
        feedback: { summary: '反馈阶段未执行', rating: 'poor', keySuggestions: [] },
      },
      totalExecutionTime,
      status: 'failure',
    };
  }

  // 应用降级数据到状态管理器（修复Object.assign副本问题）
  private applyFallbackToStateManager(fallbackData: any, agentName: string): void {
    if (fallbackData.plan) {
      this.stateManager.updatePlan(fallbackData.plan);
    }
    if (fallbackData.knowledgePoints) {
      this.stateManager.addKnowledgePoints(fallbackData.knowledgePoints);
    }
    if (fallbackData.solutionSteps) {
      fallbackData.solutionSteps.forEach((step: any) => {
        this.stateManager.addSolutionStep(step);
      });
    }
    if (fallbackData.finalAnswer) {
      this.stateManager.updateFinalAnswer(fallbackData.finalAnswer);
    }
    if (fallbackData.verificationResults) {
      this.stateManager.updateVerificationResults(fallbackData.verificationResults);
    }
    if (fallbackData.feedback) {
      this.stateManager.updateFeedback(fallbackData.feedback);
    }
    this.logger.log(`已应用${agentName}的降级策略`);
  }

  // 执行单个智能体
  private async executeSingleAgent(
    agentName: string,
    input: AgentInput,
    context: AgentContext,
    executionHistory: AgentExecution[]
  ): Promise<{ agentName: string; context: AgentContext; status: 'success' | 'failure' | 'partial' }> {
    const agent = this.agents.get(agentName);
    if (!agent) {
      this.logger.error(`智能体不存在: ${agentName}`);
      return { agentName, context, status: 'failure' };
    }

    this.logger.log(`执行智能体: ${agentName}`);

    // 执行智能体
    const agentInput: AgentInput = {
      problem: input.problem,
      context: context,
      metadata: input.metadata,
    };

    const agentStartTime = Date.now();
    let agentOutput;
    try {
      // 设置智能体执行超时
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`智能体执行超时: ${agentName}`)), this.getAgentTimeout(agentName))
      );
      
      agentOutput = await Promise.race([
        agent.execute(agentInput),
        timeoutPromise
      ]);
    } catch (error) {
      this.logger.warn(`智能体执行出错: ${agentName}`, error.message);
      return { 
        agentName, 
        context: this.injectFallbackContext(agentName, context), 
        status: 'failure' 
      };
    }
    
    const agentExecutionTime = Date.now() - agentStartTime;

    // 更新智能体统计信息
    this.updateAgentStats(agentName, agentOutput.status === 'success', agentExecutionTime);

    // 更新上下文（确保context始终包含必要字段）
    const updatedContext = this.ensureContextIntegrity(agentOutput.context, context);

    // 记录执行历史（始终记录，不依赖agentHistory）
    const historyEntry = updatedContext.agentHistory?.slice(-1)?.[0];
    if (historyEntry && historyEntry.agentName === agentName) {
      executionHistory.push(historyEntry);
    } else {
      // 手动构建执行记录（确保每个agent都被记录）
      executionHistory.push({
        agentName,
        timestamp: Date.now(),
        input: { problem: input.problem },
        output: {
          status: agentOutput.status || 'success',
          result: this.extractAgentResult(agentName, agentOutput.context),
          hasContext: !!agentOutput.context,
          stepCount: agentOutput.context?.solutionSteps?.length || 0,
        },
        duration: agentExecutionTime,
        status: (agentOutput.status || 'success') as 'success' | 'failure' | 'partial',
      });
    }

    // 处理智能体执行失败的情况
    if (agentOutput.status === 'failure') {
      this.logger.warn(`智能体执行失败: ${agentName}，使用fallback数据继续`);
      const fallbackContext = this.injectFallbackContext(agentName, updatedContext);
      
      // 根据回退策略处理
      if (this.config.fallbackStrategy === 'retry') {
        this.logger.log(`重试智能体: ${agentName}`);
        try {
          const retryOutput = await agent.execute(agentInput);
          if (retryOutput.status === 'success') {
            const retryContext = this.ensureContextIntegrity(retryOutput.context, fallbackContext);
            executionHistory.push(...retryContext.agentHistory.slice(-1));
            return { agentName, context: retryContext, status: 'success' };
          }
        } catch (retryError) {
          this.logger.warn(`智能体重试失败: ${agentName}`, retryError.message);
        }
      }
      
      return { agentName, context: fallbackContext, status: 'failure' };
    }

    return { agentName, context: updatedContext, status: 'success' };
  }

  // 获取智能体超时时间
  private getAgentTimeout(agentName: string): number {
    const timeoutMap: Record<string, number> = {
      planner: 60000,    // 规划智能体最多60秒
      solver: 45000,      // 求解智能体最多45秒
      diagnostic: 15000,  // 诊断智能体最多15秒
      feedback: 10000,    // 反馈智能体最多10秒
    };
    return timeoutMap[agentName] || 30000;
  }

  // 确保context完整性（合并新旧context，防止字段丢失）
  private ensureContextIntegrity(newContext: any, oldContext: AgentContext): AgentContext {
    if (!newContext) return oldContext;
    return {
      problem: newContext.problem || oldContext.problem,
      plan: newContext.plan || oldContext.plan,
      solutionSteps: newContext.solutionSteps || oldContext.solutionSteps || [],
      finalAnswer: newContext.finalAnswer || oldContext.finalAnswer || '',
      knowledgePoints: newContext.knowledgePoints || oldContext.knowledgePoints || [],
      verificationResults: newContext.verificationResults || oldContext.verificationResults || [],
      feedback: newContext.feedback || oldContext.feedback || null,
      agentHistory: newContext.agentHistory || oldContext.agentHistory || [],
      intermediateResults: newContext.intermediateResults || oldContext.intermediateResults || [],
      metadata: { ...(oldContext.metadata || {}), ...(newContext.metadata || {}) },
    };
  }

  // 为失败的智能体注入fallback数据
  private injectFallbackContext(agentName: string, context: AgentContext): AgentContext {
    switch (agentName) {
      case 'planner':
        if (!context.plan) {
          context.plan = {
            problemType: this.classifyProblemQuick(context.problem),
            keyConditions: [context.problem],
            macroStrategy: '通用求解策略',
            steps: [
              { id: 'step1', description: '理解题意', tool: 'llm' },
              { id: 'step2', description: '选择方法并计算', tool: 'sympy' },
              { id: 'step3', description: '验证结果', tool: 'llm' },
            ],
            estimatedDifficulty: 'medium',
          };
        }
        if (!context.knowledgePoints || context.knowledgePoints.length === 0) {
          context.knowledgePoints = [{ name: '数学分析基础', description: '相关数学概念' } as any];
        }
        break;

      case 'solver':
        if (!context.solutionSteps || context.solutionSteps.length === 0) {
          context.solutionSteps = [
            JSON.stringify({ stepTitle: '分析问题', keyPoint: '问题理解', formula: '', process: `分析"${context.problem}"的解题思路`, result: '', highlight: '' }),
            JSON.stringify({ stepTitle: '执行求解', keyPoint: '数学推理', formula: '', process: `应用适当的数学方法进行求解`, result: '', highlight: '配置AI模型可获得详细步骤' }),
          ];
        }
        if (!context.finalAnswer) {
          context.finalAnswer = '无法生成确定答案，请补充完整的数学表达式。';
        }
        break;

      case 'diagnostic':
        if (!context.verificationResults || context.verificationResults.length === 0) {
          const stepCount = context.solutionSteps?.length || 0;
          context.verificationResults = Array.from({ length: Math.max(stepCount, 1) }, (_, i) => ({
            stepId: `step${i + 1}`,
            isValid: true,
            errorMessage: '',
            confidence: 0.6,
          }));
        }
        break;

      case 'feedback':
        if (!context.feedback) {
          context.feedback = {
            accuracy: 0.6,
            completeness: Math.min(1, (context.solutionSteps?.length || 0) / 4),
            clarity: 0.7,
            suggestions: ['建议配置AI模型以获得更精准的诊断反馈'],
            improvements: ['加强基础知识学习'],
            rating: 'average',
          };
        }
        break;
    }

    return context;
  }

  // 提取各智能体的核心结果（用于executionHistory）
  private extractAgentResult(agentName: string, context: AgentContext | undefined): any {
    if (!context) return null;

    switch (agentName) {
      case 'planner':
        return context.plan ? { problemType: context.plan.problemType, stepCount: context.plan.steps?.length || 0 } : null;
      case 'solver':
        const steps = context.solutionSteps || [];
        return steps.length > 0
          ? { stepCount: steps.length, finalAnswer: context.finalAnswer || '' }
          : null;
      case 'diagnostic':
        const verifications = context.verificationResults || [];
        return verifications.length > 0
          ? { verifiedCount: verifications.length, passedCount: verifications.filter(v => v.isValid).length }
          : null;
      case 'feedback':
        return context.feedback ? { rating: context.feedback.rating, accuracy: context.feedback.accuracy } : null;
      default:
        return null;
    }
  }

  // 快速分类（用于fallback）
  private classifyProblemQuick(problem: string): string {
    if (!problem) return '未知类型';
    const p = problem.toLowerCase();
    if (p.includes('极限') || p.includes('limit')) return '极限计算';
    if (p.includes('导数') || p.includes('derivative')) return '导数求解';
    if (p.includes('积分') || p.includes('integral')) return '积分计算';
    return '综合数学问题';
  }

  // 构建各智能体的详细输出摘要
  private buildAgentDetails(executionHistory: AgentExecution[], currentContext: any): AgentDetailResults {
    const details: AgentDetailResults = {
      planner: { summary: '', problemType: '', keyConditions: [], planOverview: '', rawOutput: null },
      solver: { summary: '', stepCount: 0, approach: '', rawOutput: null },
      diagnostic: { summary: '', passedSteps: 0, totalSteps: 0, confidence: 0, rawOutput: null },
      feedback: { summary: '', rating: '', keySuggestions: [], rawOutput: null },
    };

    for (const exec of executionHistory) {
      switch (exec.agentName) {
        case 'planner':
          const plan = currentContext.plan;
          details.planner = {
            summary: plan ? `已制定${plan.steps?.length || 0}步解题计划` : '规划完成',
            problemType: plan?.problemType || '未知类型',
            keyConditions: plan?.keyConditions || [],
            planOverview: plan?.steps
              ?.map((s: any, i: number) => `${i + 1}. ${s.description} (${s.tool || 'llm'})`)
              .join(' → ') || '使用默认计划',
            rawOutput: this.safeExtractResult(exec.output),
          };
          break;

        case 'solver':
          const steps = currentContext.solutionSteps || [];
          details.solver = {
            summary: steps.length > 0
              ? `已完成${steps.length}个解题步骤`
              : '求解完成',
            stepCount: steps.length,
            approach: currentContext.finalAnswer
              ? `通过分步推理得出答案`
              : '使用符号计算与AI推理结合',
            rawOutput: this.safeExtractResult(exec.output),
          };
          break;

        case 'diagnostic':
          const verifications = currentContext.verificationResults || [];
          const passedCount = verifications.filter((v: any) => v.isValid).length;
          const avgConfidence = verifications.length > 0
            ? verifications.reduce((sum: number, v: any) => sum + (v.confidence || 0), 0) / verifications.length
            : 0;
          details.diagnostic = {
            summary: verifications.length > 0
              ? `验证${verifications.length}项，${passedCount}项通过`
              : '诊断完成',
            passedSteps: passedCount,
            totalSteps: verifications.length,
            confidence: Math.round(avgConfidence * 100) / 100,
            rawOutput: this.safeExtractResult(exec.output),
          };
          break;

        case 'feedback':
          const fb = currentContext.feedback;
          details.feedback = {
            summary: fb
              ? `综合评分：准确${Math.round((fb.accuracy || 0) * 100)}% | 完整${Math.round((fb.completeness || 0) * 100)}% | 清晰${Math.round((fb.clarity || 0) * 100)}%`
              : '反馈生成完成',
            rating: fb?.rating || 'average',
            keySuggestions: fb?.suggestions?.slice(0, 3) || [],
            rawOutput: this.safeExtractResult(exec.output),
          };
          break;
      }
    }

    return details;
  }

  // 安全提取执行结果（去除循环引用）
  private safeExtractResult(output: any): any {
    if (!output || typeof output !== 'object') return output;
    const { context, ...safe } = output;
    return safe;
  }

  // 确定问题类型
  private async determineProblemType(problem: string): Promise<string> {
    // 简单的问题类型识别逻辑
    const problemLower = problem.toLowerCase();
    
    if (problemLower.includes('极限') || problemLower.includes('limit') || problemLower.includes('lim')) {
      return 'limit';
    } else if (problemLower.includes('导数') || problemLower.includes('derivative') || problemLower.includes('求导')) {
      return 'derivative';
    } else if (problemLower.includes('积分') || problemLower.includes('integral') || problemLower.includes('∫')) {
      return 'integral';
    } else if (problemLower.includes('级数') || problemLower.includes('series') || problemLower.includes('sum')) {
      return 'series';
    } else if (problemLower.includes('方程') || problemLower.includes('equation') || problemLower.includes('solve')) {
      return 'equation';
    } else if (problemLower.includes('证明') || problemLower.includes('proof') || problemLower.includes('prove')) {
      return 'proof';
    } else if (problemLower.includes('几何') || problemLower.includes('geometry') || problemLower.includes('shape')) {
      return 'geometry';
    } else {
      return 'unknown';
    }
  }

  // 生成智能体执行顺序
  private generateExecutionOrder(problemType: string): string[] {
    // 检查缓存
    if (this.problemTypeCache.has(problemType)) {
      return this.problemTypeCache.get(problemType)!;
    }

    // 基于问题类型和智能体统计信息生成执行顺序
    let baseOrder: string[];
    
    // 根据问题类型确定基础执行顺序
    switch (problemType) {
      case 'limit':
      case 'derivative':
      case 'integral':
        baseOrder = ['planner', 'solver', 'diagnostic', 'feedback'];
        break;
      case 'series':
      case 'proof':
        baseOrder = ['planner', 'solver', 'diagnostic', 'feedback'];
        break;
      case 'equation':
        baseOrder = ['planner', 'solver', 'diagnostic', 'feedback'];
        break;
      case 'geometry':
        baseOrder = ['planner', 'solver', 'diagnostic', 'feedback'];
        break;
      default:
        baseOrder = ['planner', 'solver', 'diagnostic', 'feedback'];
    }

    // 根据智能体统计信息调整执行顺序
    const optimizedOrder = this.optimizeExecutionOrder(baseOrder);

    // 缓存结果
    this.problemTypeCache.set(problemType, optimizedOrder);

    return optimizedOrder;
  }

  // 优化执行顺序
  private optimizeExecutionOrder(baseOrder: string[]): string[] {
    // 基于智能体的成功率和执行时间进行排序
    const agentsWithStats = baseOrder.map(agentName => {
      const stats = this.agentStats.get(agentName);
      return {
        name: agentName,
        successRate: stats ? stats.successCount / stats.totalCount : 0.5,
        executionTime: stats ? stats.averageExecutionTime : 10000,
      };
    });

    // 优先执行成功率高且执行时间短的智能体
    agentsWithStats.sort((a, b) => {
      // 成功率权重为0.6，执行时间权重为0.4
      const scoreA = a.successRate * 0.6 + (1 / (a.executionTime / 1000)) * 0.4;
      const scoreB = b.successRate * 0.6 + (1 / (b.executionTime / 1000)) * 0.4;
      return scoreB - scoreA;
    });

    return agentsWithStats.map(agent => agent.name);
  }

  // 更新智能体统计信息
  private updateAgentStats(agentName: string, success: boolean, executionTime: number): void {
    const stats = this.agentStats.get(agentName);
    if (stats) {
      stats.totalCount++;
      if (success) {
        stats.successCount++;
      }
      // 计算移动平均执行时间
      stats.averageExecutionTime = (stats.averageExecutionTime * (stats.totalCount - 1) + executionTime) / stats.totalCount;
      stats.lastExecutionTime = executionTime;
      stats.errorRate = 1 - (stats.successCount / stats.totalCount);
      this.agentStats.set(agentName, stats);
    }
  }

  // 获取智能体统计信息
  getAgentStats(): Map<string, AgentStats> {
    return this.agentStats;
  }

  // 清空缓存
  clearCache(): void {
    this.problemTypeCache.clear();
  }

  // 添加智能体
  addAgent(agent: BaseAgent): void {
    this.agents.set(agent.name, agent);
    this.agentStats.set(agent.name, {
      successCount: 0,
      totalCount: 0,
      averageExecutionTime: 0,
      lastExecutionTime: 0,
      errorRate: 0,
    });
  }

  // 移除智能体
  removeAgent(agentName: string): void {
    this.agents.delete(agentName);
    this.agentStats.delete(agentName);
    // 清除相关缓存
    this.clearCache();
  }

  // 获取智能体
  getAgent(agentName: string): BaseAgent | undefined {
    return this.agents.get(agentName);
  }

  // 获取所有智能体
  getAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  // 更新配置
  updateConfig(config: Partial<AgentOrchestratorConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
    // 清除缓存
    this.clearCache();
  }

  // 获取配置
  getConfig(): AgentOrchestratorConfig {
    return this.config;
  }

  // 检查是否有错误
  private checkForErrors(context: AgentContext): boolean {
    if (!context.verificationResults || context.verificationResults.length === 0) {
      return false;
    }
    return context.verificationResults.some(result => !result.isValid);
  }

  // 定位错误步骤
  private findErrorStepIndex(context: AgentContext): number {
    if (!context.verificationResults || context.verificationResults.length === 0) {
      return -1;
    }
    return context.verificationResults.findIndex(result => !result.isValid);
  }

  // 为错误调整规划
  private async adjustPlanForErrors(context: AgentContext, errorStepIndex: number): Promise<AgentContext> {
    if (errorStepIndex === -1 || !context.plan || !context.plan.steps) {
      return context;
    }

    this.logger.log(`在步骤 ${errorStepIndex + 1} 发现错误，调整规划`);

    // 生成调整后的步骤
    const adjustedSteps = [...context.plan.steps];
    
    // 在错误步骤前添加修正步骤
    if (errorStepIndex > 0) {
      adjustedSteps.splice(errorStepIndex, 0, {
        id: `fix-step-${errorStepIndex}`,
        description: `修正步骤 ${errorStepIndex} 的错误`,
        tool: 'llm',
      });
    }

    // 更新规划
    context.plan = {
      ...context.plan,
      steps: adjustedSteps,
      adjusted: true,
      errorStep: errorStepIndex + 1,
    };

    return context;
  }
}