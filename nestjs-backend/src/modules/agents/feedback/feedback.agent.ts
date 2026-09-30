import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BaseAgent } from '../agent.base';
import { AgentInput, AgentContext, FeedbackResult } from '../agent.types';
import { AIModelsService } from '../ai-models.service';
import { AIModelProvider } from '../ai-models.types';
import { LocalComputationService } from '../local-computation/local-computation.service';
import { extractAiJson } from '../ai-json.utils';

// 反馈智能体
export class FeedbackAgent extends BaseAgent {
  constructor(
    config: any,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly aiModelsService: AIModelsService,
    private readonly localComputationService: LocalComputationService,
  ) {
    super(config);
  }

  protected async process(input: AgentInput, context: AgentContext): Promise<FeedbackResult> {
    const { problem } = input;
    const { solutionSteps, finalAnswer, verificationResults, knowledgePoints } = context;

    if (!solutionSteps || solutionSteps.length === 0) {
      this.logger.warn('解题步骤不存在，生成基于规则的反馈');
      const ruleFeedback = this.generateRuleBasedFeedback(problem);
      context.feedback = ruleFeedback;
      return ruleFeedback;
    }

    // 获取本地计算服务的参考解决方案作为反馈依据
    let referenceSolution: any = null;
    try {
      this.logger.log('获取本地计算服务的参考解决方案');
      referenceSolution = await this.localComputationService.solveProblem(problem);
    } catch (error) {
      this.logger.warn('获取参考解决方案失败', error.message);
    }

    let feedback: FeedbackResult;

    try {
      feedback = await this.generateFeedback(
        problem,
        solutionSteps,
        finalAnswer || '',
        verificationResults || [],
        knowledgePoints || [],
        referenceSolution,
      );
    } catch (error) {
      this.logger.warn('AI生成反馈失败，使用规则引擎', error.message);
      feedback = this.generateRuleBasedFeedback(problem, solutionSteps, verificationResults, referenceSolution);
    }

    // 分析用户错误模式
    const errorPatterns = this.analyzeErrorPatterns(verificationResults || [], problem);
    if (errorPatterns.length > 0) {
      feedback.suggestions = [...feedback.suggestions, ...errorPatterns];
    }

    // 生成个性化学习建议
    const personalizedSuggestions = this.generatePersonalizedSuggestions(problem, knowledgePoints || []);
    if (personalizedSuggestions.length > 0) {
      feedback.improvements = [...feedback.improvements, ...personalizedSuggestions];
    }

    // 确保feedback字段完整（兜底）
    if (!feedback.suggestions || feedback.suggestions.length === 0) {
      feedback.suggestions = this.generateDefaultSuggestions(solutionSteps, problem);
    }
    if (!feedback.improvements || feedback.improvements.length === 0) {
      feedback.improvements = this.generateDefaultImprovements(problem);
    }
    if (!feedback.rating) {
      feedback.rating = this.calculateRating(verificationResults || []) as 'excellent' | 'good' | 'average' | 'poor';
    }

    context.feedback = feedback;
    return feedback;
  }

  // 规则引擎反馈（核心fallback，不依赖任何AI）
  private generateRuleBasedFeedback(
    problem: string,
    solutionSteps?: string[],
    verificationResults?: any[],
    referenceSolution?: any,
  ): FeedbackResult {
    const stepCount = solutionSteps?.length || 0;
    const verifiedCount = verificationResults?.length || 0;

    const passedCount = verificationResults?.filter((v: any) => v.isValid).length || 0;
    const passRate = verifiedCount > 0 ? passedCount / verifiedCount : 0.7;

    // 使用参考解决方案调整评分
    let accuracy = Math.round(passRate * 100) / 100;
    if (referenceSolution && referenceSolution.finalAnswer) {
      // 检查最终答案是否与参考解决方案一致
      if (solutionSteps) {
        const lastStep = solutionSteps[solutionSteps.length - 1];
        if (lastStep.includes(referenceSolution.finalAnswer)) {
          accuracy = Math.max(accuracy, 0.9);
        } else {
          accuracy = Math.min(accuracy, 0.6);
        }
      }
    }

    const completeness = Math.round(Math.min(1, stepCount / 4) * 100) / 100;
    const clarity = Math.round((solutionSteps ? 0.7 : 0.3) * 100) / 100;

    const suggestions = this.generateDefaultSuggestions(solutionSteps, problem);
    const improvements = this.generateDefaultImprovements(problem);

    return {
      accuracy,
      completeness,
      clarity,
      suggestions,
      improvements,
      rating: this.calculateRatingFromScores(accuracy, completeness, clarity) as 'excellent' | 'good' | 'average' | 'poor',
    };
  }

  // 从验证结果计算评级
  private calculateRating(verificationResults: any[]): string {
    if (!verificationResults || verificationResults.length === 0) return 'average';

    const passedCount = verificationResults.filter((v: any) => v.isValid).length;
    const rate = passedCount / verificationResults.length;

    if (rate >= 0.9) return 'excellent';
    if (rate >= 0.7) return 'good';
    if (rate >= 0.5) return 'average';
    return 'poor';
  }

  // 从分数计算评级
  private calculateRatingFromScores(accuracy: number, completeness: number, clarity: number): string {
    const avg = (accuracy + completeness + clarity) / 3;
    if (avg >= 0.85) return 'excellent';
    if (avg >= 0.7) return 'good';
    if (avg >= 0.5) return 'average';
    return 'poor';
  }

  // 生成默认建议
  private generateDefaultSuggestions(solutionSteps?: string[], problem?: string): string[] {
    const suggestions: string[] = [];

    if (problem && (problem.includes('极限') || problem.includes('limit'))) {
      suggestions.push('建议复习重要极限公式：$\\lim_{x\\to 0}\\frac{\\sin x}{x}=1$, $\\lim_{x\\to 0}\\frac{1-\\cos x}{x}=0$');
      suggestions.push('注意区分不同类型的不定式（0/0、∞/∞、0·∞等）并选择对应方法');
      suggestions.push('洛必达法则使用前必须确认满足条件，可尝试等价无穷小替换简化');
    } else if (problem && (problem.includes('导数') || problem.includes('derivative'))) {
      suggestions.push('复合函数求导时务必使用链式法则，从外到内逐层求导');
      suggestions.push('记住基本初等函数的求导公式表，这是所有求导的基础');
      suggestions.push('注意隐函数求导时两边对x求导，不要遗漏y\'项');
    } else if (problem && (problem.includes('积分') || problem.includes('integral'))) {
      suggestions.push('积分结果别忘了加常数C');
      suggestions.push('选择换元法时要同时换元和换微分（dx部分也要变换）');
      suggestions.push('分部积分法适用于"多项式×三角/指数函数"型被积函数');
    } else {
      suggestions.push('确保每一步都有明确的数学依据，引用相关定理或公式');
      suggestions.push('建议将解题过程与标准答案进行对比，找出差异点');
      suggestions.push('对于复杂问题，可以尝试从多个角度验证结果的正确性');
    }

    if ((!solutionSteps || solutionSteps.length < 3)) {
      suggestions.push('解题步骤过于简略，建议增加中间推导细节以提高完整性');
    }

    return suggestions.slice(0, 5);
  }

  // 生成默认改进方向
  private generateDefaultImprovements(problem?: string): string[] {
    const improvements: string[] = [
      '加强基础公式的记忆和理解，建立系统的知识框架',
      '多做类似题型的练习，提高解题熟练度和速度',
      '学习总结常见错误模式，避免重复犯错',
    ];

    if (problem) {
      const p = problem.toLowerCase();
      if (p.includes('极限')) {
        improvements.push('重点掌握不定式的识别和各类求解方法的适用场景');
      } else if (p.includes('导数')) {
        improvements.push('加强复合函数分解训练，提升链式法则应用能力');
      } else if (p.includes('积分')) {
        improvements.push('积累更多积分技巧案例，培养对积分方法的直觉判断力');
      }
    }

    return improvements.slice(0, 4);
  }

  // AI生成反馈
  private async generateFeedback(
    problem: string,
    solutionSteps: string[],
    finalAnswer: string,
    verificationResults: any[],
    knowledgePoints: any[],
    referenceSolution?: any,
  ): Promise<FeedbackResult> {
    try {
      if (!this.aiModelsService.isModelAvailable(AIModelProvider.GLM)) {
        throw new Error('GLM模型未配置');
      }

      const verificationSummary = verificationResults
        .map((v) => `${v.stepId}: ${v.isValid ? '✓' : '✗'}${v.errorMessage ? `(${v.errorMessage})` : ''}`)
        .join('\n');

      // 注意：模板里的占位值必须是合法 JSON（不能写 0-1），
      // 否则模型会照抄 "accuracy": 0-1 导致解析失败（历史上踩过的坑）。
      let systemPrompt = `你是数学教育专家。评估以下解题过程并只返回一个 JSON 对象，不要附带任何其他文字：
{
  "accuracy": 0.85,
  "completeness": 0.9,
  "clarity": 0.8,
  "suggestions": ["建议1", "建议2"],
  "improvements": ["改进方向1"],
  "rating": "excellent"
}
其中 accuracy/completeness/clarity 取 0 到 1 之间的一位小数，rating 只能是 excellent/good/average/poor。

问题: ${problem}
步骤数: ${solutionSteps.length}
最终答案: ${finalAnswer}
验证结果:
${verificationSummary}`;

      // 添加参考解决方案作为反馈依据
      if (referenceSolution) {
        systemPrompt += `\n\n参考解决方案:
步骤数: ${referenceSolution.steps?.length || 0}`;
        if (referenceSolution.finalAnswer) {
          systemPrompt += `\n参考最终答案: ${referenceSolution.finalAnswer}`;
        }
      }

      const response = await this.aiModelsService.chat(AIModelProvider.GLM, {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: problem },
        ],
        temperature: 0.3,
      });

      return this.parseFeedbackResult(response.content);
    } catch (error) {
      throw error;
    }
  }

  // 解析反馈结果（健壮版：容忍 markdown 围栏、夹带文字与模板占位值）
  private parseFeedbackResult(content: string): FeedbackResult {
    const parsed = extractAiJson(content);
    if (parsed) {
      return {
        accuracy: Math.max(0, Math.min(1, Number(parsed.accuracy ?? 0.6)) || 0.6),
        completeness: Math.max(0, Math.min(1, Number(parsed.completeness ?? 0.6)) || 0.6),
        clarity: Math.max(0, Math.min(1, Number(parsed.clarity ?? 0.6)) || 0.6),
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String) : [],
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements.map(String) : [],
        rating: ['excellent', 'good', 'average', 'poor'].includes(parsed.rating) ? parsed.rating : 'average',
      };
    }

    this.logger.warn(`解析反馈结果失败，无法从 AI 输出提取 JSON（前 200 字符: ${String(content).slice(0, 200).replace(/\s+/g, ' ')}）`);
    throw new Error('无法解析AI反馈结果');
  }

  // 分析用户错误模式
  private analyzeErrorPatterns(verificationResults: any[], problem: string): string[] {
    const errorPatterns: string[] = [];
    const errors = verificationResults.filter(v => !v.isValid);

    if (errors.length === 0) {
      return errorPatterns;
    }

    // 分析错误类型
    const errorTypes: Record<string, number> = {};
    errors.forEach(error => {
      const errorMessage = error.errorMessage || '未知错误';
      if (errorMessage.includes('计算错误')) {
        errorTypes['计算错误'] = (errorTypes['计算错误'] || 0) + 1;
      } else if (errorMessage.includes('逻辑错误')) {
        errorTypes['逻辑错误'] = (errorTypes['逻辑错误'] || 0) + 1;
      } else if (errorMessage.includes('方法错误')) {
        errorTypes['方法错误'] = (errorTypes['方法错误'] || 0) + 1;
      } else {
        errorTypes['其他错误'] = (errorTypes['其他错误'] || 0) + 1;
      }
    });

    // 生成错误模式分析
    if (errorTypes['计算错误'] && errorTypes['计算错误'] > 1) {
      errorPatterns.push('注意计算过程中的准确性，建议在关键步骤进行验证');
    }
    if (errorTypes['逻辑错误']) {
      errorPatterns.push('加强对数学概念的理解，确保推理过程的逻辑性');
    }
    if (errorTypes['方法错误']) {
      errorPatterns.push('选择合适的解题方法，注意方法的适用条件');
    }

    return errorPatterns;
  }

  // 生成个性化学习建议
  private generatePersonalizedSuggestions(problem: string, knowledgePoints: any[]): string[] {
    const suggestions: string[] = [];

    // 基于知识点生成建议
    if (knowledgePoints.length > 0) {
      const keyKnowledge = knowledgePoints[0];
      suggestions.push(`深入理解"${keyKnowledge.name}"概念，这是解决此类问题的基础`);
    }

    // 基于问题类型生成建议
    const p = problem.toLowerCase();
    if (p.includes('极限')) {
      suggestions.push('建议系统学习极限的定义和各种求解方法，特别是不定式的处理');
      suggestions.push('多练习不同类型的极限题目，培养对极限类型的快速识别能力');
    } else if (p.includes('导数')) {
      suggestions.push('加强对基本求导公式的记忆，这是所有求导问题的基础');
      suggestions.push('练习复合函数的分解和链式法则的应用');
    } else if (p.includes('积分')) {
      suggestions.push('积累常见积分类型的解法，建立积分方法的选择策略');
      suggestions.push('注意积分常数C的添加和换元法的正确应用');
    }

    return suggestions.slice(0, 2);
  }
}
