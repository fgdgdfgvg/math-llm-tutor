import { Logger } from '@nestjs/common';
import {
  StateManager,
  SystemState,
  SolutionStep,
} from './state-manager.service';
import { VerificationResult } from './agent.types';
import { extractAiJson } from './ai-json.utils';

export interface StepExecution {
  stepId: string;
  stepIndex: number;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';
  startTime: number;
  endTime?: number;
  duration?: number;
  input: any;
  output?: any;
  error?: string;
  verification?: VerificationResult;
  retryCount: number;
  alternativeUsed: boolean;
}

export interface ExecutionPlan {
  steps: Array<{
    id: string;
    description: string;
    tool: string;
    dependencies: string[];
    expectedOutput: string;
    validationRules: string[];
    fallbackStrategy: string;
  }>;
  executionOrder: string[];
  parallelGroups: string[][];
}

export interface ExecutionResult {
  success: boolean;
  completedSteps: number;
  totalSteps: number;
  failedSteps: Array<{ stepId: string; error: string; recovered: boolean }>;
  executionHistory: StepExecution[];
  finalState: SystemState;
  totalTime: number;
  recoveryActions: string[];
}

export class StepExecutionEngine {
  private readonly logger = new Logger(StepExecutionEngine.name);
  private executionHistory: StepExecution[] = [];

  constructor(private readonly stateManager: StateManager) {}

  async executeWithRealtimeValidation(
    problem: string,
    plan: any,
    executeStepFn: (step: any, context: any) => Promise<any>,
    validateStepFn?: (
      step: SolutionStep,
      previousSteps: SolutionStep[],
    ) => Promise<VerificationResult>,
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    this.logger.log('开始分步执行（带实时验证）');
    this.executionHistory = [];

    const steps = plan.steps || [];
    const totalSteps = steps.length;
    let completedSteps = 0;
    const failedSteps: Array<{
      stepId: string;
      error: string;
      recovered: boolean;
    }> = [];
    const recoveryActions: string[] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepExecution: StepExecution = {
        stepId: step.id,
        stepIndex: i,
        status: 'executing',
        startTime: Date.now(),
        input: { problem, step, plan },
        retryCount: 0,
        alternativeUsed: false,
      };

      try {
        this.logger.log(`[步骤 ${i + 1}/${totalSteps}] ${step.description}`);

        const context = this.stateManager.toAgentContext();
        const result = await executeStepFn(step, context);

        stepExecution.output = result;
        stepExecution.status = 'completed';
        stepExecution.endTime = Date.now();
        stepExecution.duration =
          stepExecution.endTime - stepExecution.startTime;

        const solutionStep = this.convertToSolutionStep(step, result);
        this.stateManager.addSolutionStep(solutionStep);

        if (validateStepFn) {
          this.logger.log(`验证步骤 ${i + 1}...`);
          const previousSteps = this.stateManager
            .getCurrentState()
            .solutionSteps.slice(0, -1);
          const verification = await validateStepFn(
            solutionStep,
            previousSteps,
          );

          stepExecution.verification = verification;

          if (!verification.isValid) {
            this.logger.warn(
              `步骤 ${i + 1} 验证失败: ${verification.errorMessage}`,
            );

            const recovered = await this.handleValidationFailure(
              step,
              i,
              result,
              verification,
              executeStepFn,
              validateStepFn,
            );

            if (recovered) {
              stepExecution.alternativeUsed = true;
              recoveryActions.push(`步骤${i + 1}: 使用替代方法恢复`);
            } else {
              failedSteps.push({
                stepId: step.id,
                error: verification.errorMessage || '验证未通过',
                recovered: false,
              });

              if (!this.shouldContinueAfterFailure(i, steps.length)) {
                this.logger.error(`步骤 ${i + 1} 失败且无法恢复，终止执行`);
                break;
              }
            }
          }
        }

        completedSteps++;
        this.executionHistory.push(stepExecution);
      } catch (error) {
        this.logger.error(`步骤 ${i + 1} 执行出错: ${error.message}`);

        stepExecution.status = 'failed';
        stepExecution.error = error.message;
        stepExecution.endTime = Date.now();
        stepExecution.duration =
          stepExecution.endTime - stepExecution.startTime;

        const recovered = await this.handleExecutionError(
          step,
          i,
          error,
          executeStepFn,
          validateStepFn,
        );

        if (recovered) {
          stepExecution.status = 'completed';
          stepExecution.alternativeUsed = true;
          completedSteps++;
          recoveryActions.push(`步骤${i + 1}: 从错误中恢复`);
        } else {
          failedSteps.push({
            stepId: step.id,
            error: error.message,
            recovered: false,
          });

          if (!this.shouldContinueAfterFailure(i, steps.length)) {
            this.logger.error(`步骤 ${i + 1} 失败且无法恢复，终止执行`);
            break;
          }
        }

        this.executionHistory.push(stepExecution);
      }
    }

    const totalTime = Date.now() - startTime;
    const success = failedSteps.length === 0 && completedSteps === totalSteps;

    this.logger.log(
      `分步执行完成: ${completedSteps}/${totalSteps} 成功, ${failedSteps.length} 失败 (${totalTime}ms)`,
    );

    return {
      success,
      completedSteps,
      totalSteps,
      failedSteps,
      executionHistory: [...this.executionHistory],
      finalState: this.stateManager.getCurrentState(),
      totalTime,
      recoveryActions,
    };
  }

  private async handleValidationFailure(
    step: any,
    stepIndex: number,
    originalResult: any,
    verification: VerificationResult,
    executeStepFn: (step: any, context: any) => Promise<any>,
    validateStepFn: (
      step: SolutionStep,
      previousSteps: SolutionStep[],
    ) => Promise<VerificationResult>,
  ): Promise<boolean> {
    this.logger.log(`尝试修复步骤 ${stepIndex + 1}...`);

    const maxRetries = 2;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const modifiedStep = {
          ...step,
          description: `${step.description}（修正版 #${attempt + 1}）`,
          _correctionHint: verification.errorMessage,
          _originalResult: originalResult,
        };

        const context = this.stateManager.toAgentContext();
        const newResult = await executeStepFn(modifiedStep, context);

        const newSolutionStep = this.convertToSolutionStep(
          modifiedStep,
          newResult,
        );
        const previousSteps = this.stateManager
          .getCurrentState()
          .solutionSteps.slice(0, -1);
        const newVerification = await validateStepFn(
          newSolutionStep,
          previousSteps,
        );

        if (newVerification.isValid) {
          this.stateManager.addSolutionStep(newSolutionStep, stepIndex);
          return true;
        }
      } catch (retryError) {
        this.logger.warn(`修复尝试 ${attempt + 1} 失败: ${retryError.message}`);
      }
    }

    return false;
  }

  private async handleExecutionError(
    step: any,
    stepIndex: number,
    error: Error,
    executeStepFn: (step: any, context: any) => Promise<any>,
    validateStepFn?: (
      step: SolutionStep,
      previousSteps: SolutionStep[],
    ) => Promise<VerificationResult>,
  ): Promise<boolean> {
    this.logger.log(`尝试从错误中恢复（步骤 ${stepIndex + 1}）...`);

    try {
      const fallbackStep = {
        ...step,
        description: `${step.description}（降级模式）`,
        tool: 'fallback',
        _useFallback: true,
        _originalError: error.message,
      };

      const context = this.stateManager.toAgentContext();
      const fallbackResult = await executeStepFn(fallbackStep, context);

      const solutionStep = this.convertToSolutionStep(
        fallbackStep,
        fallbackResult,
      );
      this.stateManager.addSolutionStep(solutionStep, stepIndex);

      return true;
    } catch (fallbackError) {
      this.logger.warn(`降级模式也失败了: ${fallbackError.message}`);

      const minimalStep = this.generateMinimalStep(step, error);
      this.stateManager.addSolutionStep(minimalStep, stepIndex);

      return false;
    }
  }

  private shouldContinueAfterFailure(
    currentStep: number,
    totalSteps: number,
  ): boolean {
    const failureRate =
      this.executionHistory.filter((e) => e.status === 'failed').length /
      Math.max(currentStep, 1);

    if (failureRate > 0.6) {
      this.logger.warn(
        `失败率过高(${Math.round(failureRate * 100)}%)，建议停止执行`,
      );
      return false;
    }

    if (currentStep < Math.ceil(totalSteps * 0.3)) {
      return false;
    }

    return true;
  }

  private convertToSolutionStep(step: any, result: any): SolutionStep {
    if (typeof result === 'string') {
      const parsed = extractAiJson<Partial<SolutionStep>>(result);
      if (parsed) {
        const { stepId: _parsedStepId, isValid: aiIsValid, ...rest } = parsed;
        return {
          // 用完整模板铺底，防止 AI 输出缺字段导致 SolutionStep 类型不完整
          stepId: step.id,
          stepTitle: step.description?.substring(0, 20) || '解题步骤',
          keyPoint: '',
          formula: '',
          process: '',
          result: '',
          highlight: '',
          self_check: '',
          cot_reasoning: '',
          ...rest,
          isValid: aiIsValid !== false,
        };
      }
      return {
        stepId: step.id,
        stepTitle: step.description?.substring(0, 20) || '解题步骤',
        keyPoint: '',
        formula: '',
        process: result.substring(0, 300),
        result: result.substring(0, 100),
        highlight: '',
        self_check: '',
        cot_reasoning: '',
        isValid: true,
      };
    }

    return {
      stepId: step.id,
      stepTitle:
        result.stepTitle || step.description?.substring(0, 20) || '解题步骤',
      keyPoint: result.keyPoint || '',
      formula: result.formula || '',
      process: result.process || JSON.stringify(result).substring(0, 300),
      result: result.result || '',
      highlight: result.highlight || '',
      self_check: '',
      cot_reasoning: '',
      isValid: true,
    };
  }

  private generateMinimalStep(step: any, error: Error): SolutionStep {
    return {
      stepId: step.id,
      stepTitle: `${step.description}（简化处理）`,
      keyPoint: '待补充',
      formula: '',
      process: `此步骤因技术原因未能完整执行。原计划：${step.description}`,
      result: '（结果待定）',
      highlight: `注意：此步骤可能需要人工审核。错误信息：${error.message}`,
      self_check: '',
      cot_reasoning: '',
      isValid: false,
    };
  }

  generateExecutionReport(): string {
    const lines: string[] = ['=== 执行报告 ===', ''];

    lines.push(`总步骤数: ${this.executionHistory.length}`);
    lines.push(
      `成功: ${this.executionHistory.filter((e) => e.status === 'completed').length}`,
    );
    lines.push(
      `失败: ${this.executionHistory.filter((e) => e.status === 'failed').length}`,
    );
    lines.push('');

    for (const exec of this.executionHistory) {
      const statusIcon =
        exec.status === 'completed'
          ? '✅'
          : exec.status === 'failed'
            ? '❌'
            : '⏳';
      lines.push(`${statusIcon} 步骤 ${exec.stepIndex + 1}: ${exec.stepId}`);
      lines.push(`   状态: ${exec.status}`);
      lines.push(`   耗时: ${exec.duration || 0}ms`);

      if (exec.error) {
        lines.push(`   错误: ${exec.error}`);
      }

      if (exec.verification && !exec.verification.isValid) {
        lines.push(`   验证: ❌ ${exec.verification.errorMessage}`);
      } else if (exec.verification) {
        lines.push(`   验证: ✅ 通过`);
      }

      if (exec.alternativeUsed) {
        lines.push(`   ⚠️  使用了替代方案`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  getExecutionMetrics(): any {
    const completed = this.executionHistory.filter(
      (e) => e.status === 'completed',
    );
    const failed = this.executionHistory.filter((e) => e.status === 'failed');

    return {
      totalSteps: this.executionHistory.length,
      completedSteps: completed.length,
      failedSteps: failed.length,
      successRate:
        this.executionHistory.length > 0
          ? completed.length / this.executionHistory.length
          : 0,
      averageDuration:
        completed.length > 0
          ? completed.reduce((sum, e) => sum + (e.duration || 0), 0) /
            completed.length
          : 0,
      totalDuration: this.executionHistory.reduce(
        (sum, e) => sum + (e.duration || 0),
        0,
      ),
      alternativesUsed: this.executionHistory.filter((e) => e.alternativeUsed)
        .length,
      verificationsPassed: this.executionHistory.filter(
        (e) => e.verification?.isValid,
      ).length,
    };
  }

  clearHistory(): void {
    this.executionHistory = [];
  }
}
