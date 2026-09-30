import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BaseAgent } from '../agent.base';
import { AgentInput, AgentContext, VerificationResult } from '../agent.types';
import { AIModelsService } from '../ai-models.service';
import { AIModelProvider } from '../ai-models.types';
import { LocalComputationService } from '../local-computation/local-computation.service';
import { StepValidationService, ValidationResult, SolutionStep } from './step-validation.service';
import { VisualizationService, MermaidFlowchart, ExportOptions } from './visualization.service';
import { ErrorDiagnosisService, FullDiagnosisReport, ErrorLayer } from '../../../common/services/error-diagnosis.service';
import { extractAiJson } from '../ai-json.utils';

// 诊断智能体
export class DiagnosticAgent extends BaseAgent {
  constructor(
    config: any,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly aiModelsService: AIModelsService,
    private readonly localComputationService: LocalComputationService,
    private readonly stepValidationService: StepValidationService,
    private readonly visualizationService: VisualizationService,
    private readonly errorDiagnosisService: ErrorDiagnosisService,
  ) {
    super(config);
  }

  protected async process(input: AgentInput, context: AgentContext): Promise<VerificationResult[]> {
    const { problem } = input;
    const { solutionSteps, plan, knowledgePoints } = context;

    if (!solutionSteps || solutionSteps.length === 0) {
      this.logger.warn('解题步骤不存在，生成基于规则的验证结果');
      return this.generateRuleBasedVerification(problem);
    }

    // 获取本地计算服务的正确解决方案作为参考
    let referenceSolution: any = null;
    try {
      this.logger.log('获取本地计算服务的参考解决方案');
      referenceSolution = await this.localComputationService.solveProblem(problem);
    } catch (error) {
      this.logger.warn('获取参考解决方案失败', error.message);
    }

    const verificationResults: VerificationResult[] = [];

    for (let i = 0; i < solutionSteps.length; i++) {
      const step = solutionSteps[i];
      const stepId = plan?.steps[i]?.id || `step${i + 1}`;

      try {
        const verification = await this.verifyStep(step, problem, context, stepId, referenceSolution);
        verificationResults.push({
          stepId,
          isValid: verification.isValid,
          errorMessage: verification.errorMessage,
          confidence: verification.confidence,
        });
      } catch (error) {
        this.logger.warn(`验证步骤失败: ${stepId}`, error.message);

        // 使用规则引擎验证作为fallback
        const ruleBased = this.ruleBasedVerify(step, stepId, i, solutionSteps.length, referenceSolution);
        verificationResults.push(ruleBased);
      }
    }

    // 验证最终答案
    if (context.finalAnswer) {
      try {
        const finalVerification = await this.verifyFinalAnswer(context.finalAnswer, problem, context, referenceSolution);
        verificationResults.push({
          stepId: 'finalAnswer',
          isValid: finalVerification.isValid,
          errorMessage: finalVerification.errorMessage,
          confidence: finalVerification.confidence,
        });
      } catch (error) {
        this.logger.warn('验证最终答案失败', error.message);
        verificationResults.push({
          stepId: 'finalAnswer',
          isValid: true,
          errorMessage: '',
          confidence: 0.6,
        });
      }
    }

    // 更新上下文
    context.verificationResults = verificationResults;

    // 四层错误诊断引擎（新增）
    try {
      const diagnosisReport = this.errorDiagnosisService.diagnoseFull(problem, solutionSteps);
      const scoreCard = this.errorDiagnosisService.generateScoreCard(diagnosisReport);
      this.logger.log(
        `四层错误诊断完成: 总分=${scoreCard.overallScore}, 等级=${scoreCard.grade}, ` +
        `语法=${scoreCard.syntaxScore}, 计算=${scoreCard.calculationScore}, ` +
        `逻辑=${scoreCard.logicScore}, 方法=${scoreCard.methodScore}`,
      );
      context.metadata['errorDiagnosisReport'] = diagnosisReport;
      context.metadata['errorScoreCard'] = scoreCard;
    } catch (e) {
      this.logger.warn(`四层错误诊断失败: ${e.message}`);
    }

    return verificationResults;
  }

  // 规则引擎验证（不依赖AI的核心fallback）
  private ruleBasedVerify(step: string, stepId: string, index: number, totalSteps: number, referenceSolution?: any): VerificationResult {
    const hasContent = step && step.length > 10;
    const hasStructure = step.includes('"stepTitle"') || step.includes(':');
    const isLastStep = index === totalSteps - 1;

    let isValid = hasContent;
    let confidence = 0.7;
    let errorMessage = '';

    if (!hasContent) {
      isValid = false;
      confidence = 0.3;
      errorMessage = '步骤内容为空或不完整';
    } else if (!hasStructure) {
      confidence = 0.5;
      errorMessage = '步骤格式不规范，建议检查结构完整性';
    }

    if (isLastStep && !step.includes('结果') && !step.includes('答案') && !step.includes('answer')) {
      confidence = Math.min(confidence, 0.6);
      // 只扣置信度提示格式，不判整体失败：措辞差异不是数学错误
      errorMessage = errorMessage || '最后一步建议明确写出计算结果或结论';
    }

    // 使用参考解决方案进行更准确的验证
    if (referenceSolution && referenceSolution.steps && referenceSolution.steps[index]) {
      const referenceStep = referenceSolution.steps[index];
      if (referenceStep.result) {
        // 比较的是「数学结果」而不是「原文措辞」：AI 步骤文本与参考解措辞不同是常态，
        // 直接 step.includes() 会把措辞差异误报成「步骤结果与参考解决方案不一致」。
        // 提取数字/数学 token 后比较交集：核心结果一致则视为通过。
        const mathTokens = (text: string): Set<string> => {
          const tokens = new Set<string>();
          // 数字（含分数、小数、负号、科学计数）
          for (const m of text.matchAll(/-?\d+(?:\.\d+)?(?:\/(?:-?\d+(?:\.\d+)?))?/g)) {
            tokens.add(m[0].replace(/^0+(?=\d)/, ''));
          }
          // 常见数学函数与变量组合（x^2、e^x、sin(x) 等）
          for (const m of text.matchAll(/(?:sin|cos|tan|ln|log|exp)\s*\(?[^)\s]*\)?/gi)) {
            tokens.add(m[0].replace(/\s+/g, '').toLowerCase());
          }
          for (const m of text.matchAll(/[a-zA-Z]\s*\^\s*[-\d.]+/g)) {
            tokens.add(m[0].replace(/\s+/g, '').toLowerCase());
          }
          return tokens;
        };
        const stepTokens = mathTokens(step);
        const refTokens = mathTokens(String(referenceStep.result));
        if (refTokens.size === 0) {
          // 参考结果没有可比对的数学内容，不因措辞不同而判失败
          confidence = Math.max(confidence, 0.7);
        } else {
          let matched = 0;
          for (const token of refTokens) {
            if (stepTokens.has(token)) matched += 1;
          }
          const matchRate = matched / refTokens.size;
          if (matchRate >= 0.6) {
            confidence = Math.max(confidence, 0.9);
          } else if (matchRate >= 0.3) {
            // 部分命中：给中等置信度，不判失败
            confidence = Math.max(confidence, 0.6);
          } else {
            isValid = false;
            confidence = Math.min(confidence, 0.4);
            errorMessage = errorMessage || `步骤结果与参考解决方案不一致，参考结果为: ${referenceStep.result}`;
          }
        }
      }
    }

    this.logger.log(`规则验证 ${stepId}: valid=${isValid} conf=${confidence}`);
    return { stepId, isValid: !!isValid, errorMessage: errorMessage || '', confidence };
  }

  // 基于规则的完整验证（无步骤时的fallback）
  private generateRuleBasedVerification(problem: string): VerificationResult[] {
    this.logger.log('使用规则引擎生成基础验证结果');

    return [
      {
        stepId: 'structure_check',
        isValid: true,
        errorMessage: '',
        confidence: 0.6,
      },
      {
        stepId: 'completeness_check',
        isValid: true,
        errorMessage: '',
        confidence: 0.5,
      },
      {
        stepId: 'note',
        isValid: true,
        errorMessage: '无解题步骤可供逐步验证',
        confidence: 0.8,
      },
    ];
  }

  // 验证单个步骤（AI优先 + 规则fallback）
  private async verifyStep(
    step: string,
    problem: string,
    context: AgentContext,
    stepId: string,
    referenceSolution?: any,
  ): Promise<{ isValid: boolean; errorMessage?: string; confidence: number }> {
    try {
      if (this.aiModelsService.isModelAvailable(AIModelProvider.GLM)) {
        return await this.aiVerifyStep(step, problem, stepId, referenceSolution);
      }
    } catch (error) {
      this.logger.warn('GLM AI验证不可用，使用规则验证', error.message);
    }

    return this.ruleBasedVerify(step, stepId, 0, 1, referenceSolution);
  }

  // AI验证步骤（使用GLM-4.7-Flash超快速验证）
  private async aiVerifyStep(step: string, problem: string, stepId: string, referenceSolution?: any): Promise<{
    isValid: boolean;
    errorMessage?: string;
    confidence: number;
  }> {
    let systemPrompt = `你是数学验证专家。验证以下解题步骤是否正确。
返回JSON: {"isValid": true/false, "errorMessage": "错误描述", "confidence": 0-1}

问题: ${problem}
步骤 [${stepId}]: ${step}`;

    // 添加参考解决方案作为验证依据
    if (referenceSolution && referenceSolution.steps) {
      const stepIndex = parseInt(stepId.replace('step', '')) - 1;
      if (stepIndex >= 0 && stepIndex < referenceSolution.steps.length) {
        const referenceStep = referenceSolution.steps[stepIndex];
        systemPrompt += `\n\n参考解决方案步骤: ${referenceStep.title}\n参考结果: ${referenceStep.result}`;
      }
    }

    const response = await this.aiModelsService.chat(AIModelProvider.GLM, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: step },
      ],
      temperature: 0.2,
    });

    return this.parseVerificationResult(response.content);
  }

  // 验证最终答案
  private async verifyFinalAnswer(finalAnswer: string, problem: string, context: AgentContext, referenceSolution?: any): Promise<{
    isValid: boolean;
    errorMessage?: string;
    confidence: number;
  }> {
    try {
      if (this.aiModelsService.isModelAvailable(AIModelProvider.GLM)) {
        let systemPrompt = `你是数学验证专家。验证最终答案是否正确。
返回JSON: {"isValid": true/false, "errorMessage": "错误描述", "confidence": 0-1}

问题: ${problem}
最终答案: ${finalAnswer}`;

        // 添加参考解决方案的最终答案作为验证依据
        if (referenceSolution && referenceSolution.finalAnswer) {
          systemPrompt += `\n\n参考最终答案: ${referenceSolution.finalAnswer}`;
        }

        const response = await this.aiModelsService.chat(AIModelProvider.GLM, {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: finalAnswer },
          ],
          temperature: 0.2,
        });

        return this.parseVerificationResult(response.content);
      }
    } catch (error) {
      this.logger.warn('GLM AI验证答案不可用', error.message);
    }

    // 规则fallback：与参考解决方案比较
    if (referenceSolution && referenceSolution.finalAnswer) {
      if (finalAnswer.includes(referenceSolution.finalAnswer)) {
        return {
          isValid: true,
          errorMessage: '',
          confidence: 0.9,
        };
      } else {
        return {
          isValid: false,
          errorMessage: `最终答案与参考解决方案不一致，正确答案应为: ${referenceSolution.finalAnswer}`,
          confidence: 0.8,
        };
      }
    }

    // 无参考解决方案时的fallback
    return {
      isValid: !!finalAnswer && finalAnswer.length > 0,
      errorMessage: '',
      confidence: 0.6,
    };
  }

  // 解析验证结果（健壮版）
  private parseVerificationResult(content: string): {
    isValid: boolean;
    errorMessage?: string;
    confidence: number;
  } {
    const parsed = extractAiJson(content);
    if (parsed) {
      return {
        isValid: parsed.isValid ?? true,
        errorMessage: parsed.errorMessage || '',
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.7)) || 0.7),
      };
    }
    this.logger.warn(`解析验证结果失败，无法从 AI 输出提取 JSON（前 200 字符: ${String(content).slice(0, 200).replace(/\s+/g, ' ')}）`);
    return { isValid: true, errorMessage: '', confidence: 0.5 };
  }

  // 使用步骤验证服务进行实时验证
  async validateStepsWithService(steps: SolutionStep[]): Promise<ValidationResult[]> {
    this.logger.log(`使用步骤验证服务验证${steps.length}个步骤`);
    return this.stepValidationService.validateAllSteps(steps);
  }

  // 生成可视化流程图
  async generateVisualization(
    steps: SolutionStep[],
    validationResults: ValidationResult[],
  ): Promise<MermaidFlowchart> {
    this.logger.log('生成解题流程可视化');
    return this.visualizationService.generateMermaidFlowchart(steps, validationResults);
  }

  // 生成交互式HTML
  async generateInteractiveHTML(flowchart: MermaidFlowchart): Promise<string> {
    this.logger.log('生成交互式HTML');
    return this.visualizationService.generateInteractiveHTML(flowchart);
  }

  // 导出流程图
  async exportVisualization(
    flowchart: MermaidFlowchart,
    options: ExportOptions,
  ): Promise<Buffer | string> {
    this.logger.log(`导出流程图为${options.format.toUpperCase()}格式`);
    return this.visualizationService.exportFlowchart(flowchart, options);
  }

  // 获取验证摘要
  getValidationSummary(validationResults: ValidationResult[]): {
    totalSteps: number;
    passedSteps: number;
    failedSteps: number;
    warningSteps: number;
    overallStatus: 'pass' | 'fail' | 'warning';
    averageConfidence: number;
  } {
    return this.stepValidationService.getValidationSummary(validationResults);
  }

  // 生成步骤详情
  generateStepDetails(
    steps: SolutionStep[],
    validationResults: ValidationResult[],
  ): Array<{
    step: SolutionStep;
    validation: ValidationResult;
    details: string[];
  }> {
    return this.visualizationService.generateStepDetails(steps, validationResults);
  }
}
