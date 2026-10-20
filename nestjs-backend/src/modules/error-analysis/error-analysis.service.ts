import { Injectable, Logger } from '@nestjs/common';
import { KnowledgeService } from '../knowledge/knowledge.service';

export interface ErrorPattern {
  id: string;
  name: string;
  description: string;
  pattern: RegExp;
  category: 'conceptual' | 'computational' | 'logical' | 'format';
  relatedConcepts: string[];
  severity: 'low' | 'medium' | 'high';
  tips: string[];
}

export interface ErrorDiagnosis {
  errorId: string;
  errorName: string;
  errorType: 'conceptual' | 'computational' | 'logical' | 'format';
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  description: string;
  relatedConcepts: Array<{
    conceptId: string;
    conceptName: string;
    relevance: number;
  }>;
  tips: string[];
  fixSuggestions: string[];
}

export interface MultiStepDiagnosis {
  stepErrors: ErrorDiagnosis[];
  logicalGaps: Array<{
    fromStep: number;
    toStep: number;
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  overallAssessment: string;
  improvementSuggestions: string[];
}

@Injectable()
export class ErrorAnalysisService {
  private readonly logger = new Logger(ErrorAnalysisService.name);
  private errorPatterns: ErrorPattern[] = [];

  constructor(private readonly knowledgeService: KnowledgeService) {
    this.initializeErrorPatterns();
  }

  private initializeErrorPatterns(): void {
    this.errorPatterns = [
      // 概念性错误
      {
        id: 'concept-limit-confusion',
        name: '极限概念混淆',
        description: '混淆极限值与函数值',
        pattern: /(极限值.*函数值|函数值.*极限值|lim.*=.*f\(.*\))/i,
        category: 'conceptual',
        relatedConcepts: ['limit_definition', 'limit_properties'],
        severity: 'medium',
        tips: [
          '极限值是函数趋近的值，不一定是函数在该点的值',
          '函数在某点的极限存在，不要求函数在该点有定义',
        ],
      },
      {
        id: 'concept-derivative-confusion',
        name: '导数概念混淆',
        description: '混淆导数与函数值',
        pattern: /(导数.*函数值|函数值.*导数|f\(.*\).*=.*f'\(.*\))/i,
        category: 'conceptual',
        relatedConcepts: ['derivative_definition'],
        severity: 'medium',
        tips: [
          '导数表示变化率，不是函数值本身',
          '导数是函数在某点的瞬时变化率，几何意义是切线斜率',
        ],
      },
      {
        id: 'concept-integral-constant',
        name: '积分常数遗漏',
        description: '不定积分忘记加常数C',
        pattern: /(∫.*=.*[^C]|integral.*=.*[^C])/i,
        category: 'conceptual',
        relatedConcepts: ['indefinite_integral'],
        severity: 'low',
        tips: ['不定积分必须加上积分常数C', '定积分不需要加常数C'],
      },

      // 计算性错误
      {
        id: 'computation-chain-rule',
        name: '链式法则应用错误',
        description: '复合函数求导时链式法则应用错误',
        pattern: /(f\(g\(.*\)\).*=.*f'\(.*\))/i,
        category: 'computational',
        relatedConcepts: ['chain_rule'],
        severity: 'medium',
        tips: [
          '复合函数求导要逐层求导并相乘',
          '先对外部函数求导，再乘以内部函数的导数',
        ],
      },
      {
        id: 'computation-product-rule',
        name: '乘积法则错误',
        description: '乘积法则应用错误',
        pattern: /(f\(.*\)g\(.*\).*=.*f'\(.*\)g\(.*\))/i,
        category: 'computational',
        relatedConcepts: ['product_rule'],
        severity: 'medium',
        tips: ["乘积法则：(fg)' = f'g + fg'", "不要忘记第二项 fg'"],
      },
      {
        id: 'computation-substitution',
        name: '换元积分法错误',
        description: '换元积分法应用错误',
        pattern: /(换元.*积分|substitution.*integral)/i,
        category: 'computational',
        relatedConcepts: ['substitution_method'],
        severity: 'medium',
        tips: ['换元后要记得回代', '定积分换元要同时变换上下限'],
      },

      // 逻辑性错误
      {
        id: 'logic-lhopital',
        name: '洛必达法则使用错误',
        description: '非未定式使用洛必达法则',
        pattern: /(洛必达.*=.*\d+|l\'hospital.*=.*\d+)/i,
        category: 'logical',
        relatedConcepts: ['lhopital_rule'],
        severity: 'high',
        tips: [
          '只有0/0或∞/∞型才能使用洛必达法则',
          '每次使用后要检查是否仍为未定式',
        ],
      },
      {
        id: 'logic-integral-limits',
        name: '积分上下限错误',
        description: '定积分上下限弄反或计算错误',
        pattern: /(∫\[.*\].*=.*[^-]|integral.*limits.*=.*[^-])/i,
        category: 'logical',
        relatedConcepts: ['definite_integral'],
        severity: 'medium',
        tips: ['定积分下限小于上限时结果为正', '交换上下限结果取相反数'],
      },
      {
        id: 'logic-taylor-order',
        name: '泰勒展开阶数不足',
        description: '泰勒展开阶数不够导致误差',
        pattern: /(泰勒.*展开|taylor.*series)/i,
        category: 'logical',
        relatedConcepts: ['taylor_series'],
        severity: 'medium',
        tips: ['展开阶数要满足精度要求', '注意余项的影响'],
      },

      // 格式错误
      {
        id: 'format-parentheses',
        name: '括号使用错误',
        description: '括号不匹配或使用错误',
        pattern: /(\(.*\)|\[.*\]|\{.*\})/i,
        category: 'format',
        relatedConcepts: [],
        severity: 'low',
        tips: ['确保括号匹配', '使用括号明确运算顺序'],
      },
      {
        id: 'format-fraction',
        name: '分数格式错误',
        description: '分数书写格式错误',
        pattern: /(\d+\s*\/\s*\d+)/i,
        category: 'format',
        relatedConcepts: [],
        severity: 'low',
        tips: ['分数应使用\frac{分子}{分母}格式', '确保分子分母清晰可见'],
      },
    ];
  }

  async analyzeError(
    userAnswer: string,
    correctAnswer: string,
  ): Promise<ErrorDiagnosis[]> {
    const diagnoses: ErrorDiagnosis[] = [];

    for (const pattern of this.errorPatterns) {
      if (pattern.pattern.test(userAnswer)) {
        const relatedConcepts = await this.getRelatedConcepts(
          pattern.relatedConcepts,
        );

        diagnoses.push({
          errorId: pattern.id,
          errorName: pattern.name,
          errorType: pattern.category,
          severity: pattern.severity,
          confidence: this.calculateConfidence(userAnswer, pattern),
          description: pattern.description,
          relatedConcepts,
          tips: pattern.tips,
          fixSuggestions: this.generateFixSuggestions(
            pattern,
            userAnswer,
            correctAnswer,
          ),
        });
      }
    }

    return diagnoses.sort((a, b) => b.confidence - a.confidence);
  }

  async analyzeMultiStepSolution(steps: string[]): Promise<MultiStepDiagnosis> {
    const stepErrors: ErrorDiagnosis[] = [];
    const logicalGaps: Array<{
      fromStep: number;
      toStep: number;
      description: string;
      severity: 'low' | 'medium' | 'high';
    }> = [];

    // 分析每一步的错误
    for (let i = 0; i < steps.length; i++) {
      const stepErrorsResult = await this.analyzeError(steps[i], '');
      if (stepErrorsResult.length > 0) {
        stepErrors.push(
          ...stepErrorsResult.map((error) => ({
            ...error,
            step: i + 1,
          })),
        );
      }
    }

    // 分析步骤间的逻辑断裂
    for (let i = 0; i < steps.length - 1; i++) {
      const gap = this.detectLogicalGap(steps[i], steps[i + 1], i + 1, i + 2);
      if (gap) {
        logicalGaps.push(gap);
      }
    }

    const overallAssessment = this.generateOverallAssessment(
      stepErrors,
      logicalGaps,
    );
    const improvementSuggestions = this.generateImprovementSuggestions(
      stepErrors,
      logicalGaps,
    );

    return {
      stepErrors,
      logicalGaps,
      overallAssessment,
      improvementSuggestions,
    };
  }

  private async getRelatedConcepts(conceptIds: string[]): Promise<
    Array<{
      conceptId: string;
      conceptName: string;
      relevance: number;
    }>
  > {
    const relatedConcepts: Array<{
      conceptId: string;
      conceptName: string;
      relevance: number;
    }> = [];

    for (const conceptId of conceptIds) {
      const concept = await this.knowledgeService.getConcept(conceptId);
      if (concept) {
        relatedConcepts.push({
          conceptId: concept.id,
          conceptName: concept.name,
          relevance: 1.0,
        });
      }
    }

    return relatedConcepts;
  }

  private calculateConfidence(
    userAnswer: string,
    pattern: ErrorPattern,
  ): number {
    const matches = userAnswer.match(pattern.pattern);
    if (!matches) return 0;

    // 基于匹配长度和位置计算置信度
    const matchLength = matches[0].length;
    const totalLength = userAnswer.length;
    const positionScore = 1 - (matches.index || 0) / totalLength;
    const lengthScore = matchLength / totalLength;

    return Math.min(1.0, (positionScore + lengthScore) / 2);
  }

  private generateFixSuggestions(
    pattern: ErrorPattern,
    userAnswer: string,
    correctAnswer: string,
  ): string[] {
    const suggestions: string[] = [];

    switch (pattern.id) {
      case 'concept-limit-confusion':
        suggestions.push('重新理解极限的定义：极限是函数在某点附近的趋势');
        suggestions.push('区分函数值和极限值的概念');
        break;
      case 'concept-derivative-confusion':
        suggestions.push('导数表示函数的变化率，不是函数值');
        suggestions.push('复习导数的几何意义：切线斜率');
        break;
      case 'concept-integral-constant':
        suggestions.push('不定积分结果要加上积分常数C');
        break;
      case 'computation-chain-rule':
        suggestions.push(
          '复合函数求导：先对外部函数求导，再乘以内部函数的导数',
        );
        suggestions.push('多练习链式法则的应用');
        break;
      case 'computation-product-rule':
        suggestions.push("乘积法则：(fg)' = f'g + fg'");
        suggestions.push("不要忘记第二项 fg'");
        break;
      case 'logic-lhopital':
        suggestions.push('只有0/0或∞/∞型才能使用洛必达法则');
        suggestions.push('每次使用后要检查是否仍为未定式');
        break;
      default:
        suggestions.push('仔细检查计算过程');
        suggestions.push('参考相关知识点的正确应用方法');
    }

    return suggestions;
  }

  private detectLogicalGap(
    step1: string,
    step2: string,
    fromStep: number,
    toStep: number,
  ): {
    fromStep: number;
    toStep: number;
    description: string;
    severity: 'low' | 'medium' | 'high';
  } | null {
    // 检查积分步骤是否遗漏上下限代入
    if (step1.includes('∫') && step2.includes('=') && !step2.includes('|')) {
      return {
        fromStep,
        toStep,
        description: '积分步骤中未代入上下限',
        severity: 'high',
      };
    }

    // 检查极限计算是否正确应用洛必达法则
    if (
      step1.includes('lim') &&
      step2.includes('=') &&
      !step2.includes('洛必达') &&
      !step2.includes("l'hospital")
    ) {
      return {
        fromStep,
        toStep,
        description: '极限计算可能缺少必要的步骤',
        severity: 'medium',
      };
    }

    // 检查导数计算是否正确应用链式法则
    if (step1.includes('f(') && step2.includes("f'(") && !step2.includes('*')) {
      return {
        fromStep,
        toStep,
        description: '复合函数求导可能缺少链式法则的应用',
        severity: 'medium',
      };
    }

    return null;
  }

  private generateOverallAssessment(
    stepErrors: ErrorDiagnosis[],
    logicalGaps: Array<Record<string, unknown>>,
  ): string {
    if (stepErrors.length === 0 && logicalGaps.length === 0) {
      return '解题过程正确，逻辑清晰';
    }

    const highSeverityErrors = stepErrors.filter(
      (e) => e.severity === 'high',
    ).length;
    const mediumSeverityErrors = stepErrors.filter(
      (e) => e.severity === 'medium',
    ).length;
    const logicalGapCount = logicalGaps.length;

    if (highSeverityErrors > 0) {
      return '解题过程存在严重错误，需要重点关注';
    } else if (mediumSeverityErrors > 0 || logicalGapCount > 0) {
      return '解题过程基本正确，但存在一些逻辑漏洞或计算错误';
    } else {
      return '解题过程正确，仅存在轻微的格式或概念理解问题';
    }
  }

  private generateImprovementSuggestions(
    stepErrors: ErrorDiagnosis[],
    logicalGaps: Array<Record<string, unknown>>,
  ): string[] {
    const suggestions: string[] = [];

    // 基于错误类型生成建议
    const conceptualErrors = stepErrors.filter(
      (e) => e.errorType === 'conceptual',
    );
    const computationalErrors = stepErrors.filter(
      (e) => e.errorType === 'computational',
    );
    const logicalErrors = stepErrors.filter((e) => e.errorType === 'logical');

    if (conceptualErrors.length > 0) {
      suggestions.push('加强概念理解，特别是极限、导数、积分的基本定义');
    }

    if (computationalErrors.length > 0) {
      suggestions.push('多练习基本计算技巧，如链式法则、乘积法则等');
    }

    if (logicalErrors.length > 0) {
      suggestions.push('注意解题逻辑的连贯性，确保每一步都有依据');
    }

    if (logicalGaps.length > 0) {
      suggestions.push('完善解题步骤，确保逻辑链完整');
    }

    return suggestions.length > 0 ? suggestions : ['继续保持良好的解题习惯'];
  }

  async getErrorPatterns(): Promise<ErrorPattern[]> {
    return this.errorPatterns;
  }

  async addErrorPattern(
    pattern: Omit<ErrorPattern, 'id'>,
  ): Promise<ErrorPattern> {
    const newPattern: ErrorPattern = {
      ...pattern,
      id: `custom-${Date.now()}`,
    };

    this.errorPatterns.push(newPattern);
    return newPattern;
  }

  async updateErrorPattern(
    id: string,
    updates: Partial<ErrorPattern>,
  ): Promise<ErrorPattern | null> {
    const index = this.errorPatterns.findIndex((p) => p.id === id);
    if (index === -1) return null;

    this.errorPatterns[index] = {
      ...this.errorPatterns[index],
      ...updates,
    };

    return this.errorPatterns[index];
  }

  async deleteErrorPattern(id: string): Promise<boolean> {
    const initialLength = this.errorPatterns.length;
    this.errorPatterns = this.errorPatterns.filter((p) => p.id !== id);
    return this.errorPatterns.length < initialLength;
  }
}
