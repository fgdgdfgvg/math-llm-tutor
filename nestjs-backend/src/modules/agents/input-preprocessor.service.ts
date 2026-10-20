import { Logger } from '@nestjs/common';

export interface ProblemClassification {
  primaryType: string;
  secondaryTypes: string[];
  confidence: number;
  keywords: string[];
  mathematicalExpressions: string[];
  isComplex: boolean;
  suggestedApproach: string;
  fallbackType: string;
  userConfirmationNeeded: boolean;
  classificationDetails: {
    level1Result?: Level1Result;
    level2Result?: Level2Result;
    level3Result?: Level3Result;
  };
}

export interface Level1Result {
  matchedKeywords: Array<{ keyword: string; type: string; weight: number }>;
  totalScore: number;
  topCandidate: string;
  confidence: number;
}

export interface Level2Result {
  hasValidExpression: boolean;
  expressionPatterns: string[];
  syntaxErrors: string[];
  completeness: 'complete' | 'partial' | 'incomplete';
  detectedStructure: string;
}

export interface Level3Result {
  contextAnalysis: string;
  compositeProblem: boolean;
  subProblems: Array<{ type: string; description: string }>;
  recommendedStrategy: string;
}

export interface ClassificationOption {
  type: string;
  description: string;
  confidence: number;
  reason: string;
}

export class InputPreprocessor {
  private readonly logger = new Logger(InputPreprocessor.name);

  private readonly level1Keywords: Record<
    string,
    { patterns: string[]; weight: number }
  > = {
    limit: {
      patterns: ['极限', 'lim', 'limit', '趋近', '收敛', '发散', '→'],
      weight: 1.0,
    },
    derivative: {
      patterns: [
        '导数',
        'derivative',
        '求导',
        'd/dx',
        "f'(x)",
        '微分',
        '斜率',
        '变化率',
      ],
      weight: 1.0,
    },
    integral: {
      patterns: [
        '积分',
        'integral',
        '∫',
        '原函数',
        '面积',
        '体积',
        '不定积分',
        '定积分',
      ],
      weight: 1.0,
    },
    equation: {
      patterns: [
        '方程',
        'equation',
        '解方程',
        '求根',
        '求解',
        '= 0',
        'roots',
        '解',
      ],
      weight: 0.8,
    },
    series: {
      patterns: [
        '级数',
        'series',
        'sum',
        '∑',
        '泰勒',
        'taylor',
        '傅里叶',
        '收敛和',
      ],
      weight: 0.9,
    },
    proof: {
      patterns: ['证明', 'proof', 'prove', '求证', '证'],
      weight: 0.9,
    },
    geometry: {
      patterns: ['几何', 'geometry', '图形', '三角形', '圆', '向量', '坐标'],
      weight: 0.8,
    },
    matrix: {
      patterns: ['矩阵', 'matrix', '行列式', 'determinant', '线性代数'],
      weight: 0.85,
    },
    probability: {
      patterns: [
        '概率',
        'probability',
        '统计',
        'statistics',
        '期望',
        '方差',
        '分布',
      ],
      weight: 0.85,
    },
  };

  private readonly expressionPatterns: Record<string, RegExp> = {
    limit: /\\?lim_\{[^}]+\}|极限[^(]+\(/gi,
    derivative: /\\?frac\{d[^}]*\}\{d[^}]*\}|\\?d\/dx|'[)(]/g,
    integral: /\\?int[_^]?[^{}]*\{[^}]*\}|∫/g,
    equation: /[=]=?\s*0|solve\s*[\(]|方程/gi,
    series: /\\?sum_\{[^}]+\}|∑/gi,
    fraction: /\\?frac\{[^}]+\}\{[^}]+\}/g,
    function: /[a-z]\s*\([^)]*\)/gi,
  };

  async classifyProblem(problem: string): Promise<ProblemClassification> {
    this.logger.log('开始三级问题分类');

    const level1Result = this.level1KeywordMatching(problem);
    const level2Result = this.level2StructureAnalysis(problem);
    const level3Result = await this.level3SemanticAnalysis(
      problem,
      level1Result,
      level2Result,
    );

    const finalClassification = this.synthesizeResults(
      level1Result,
      level2Result,
      level3Result,
    );

    this.logger.log(
      `分类完成: ${finalClassification.primaryType} (置信度: ${finalClassification.confidence})`,
    );

    return finalClassification;
  }

  private level1KeywordMatching(problem: string): Level1Result {
    const lowerProblem = problem.toLowerCase();
    const matchedKeywords: Array<{
      keyword: string;
      type: string;
      weight: number;
    }> = [];
    const typeScores: Record<string, number> = {};

    for (const [type, config] of Object.entries(this.level1Keywords)) {
      let typeScore = 0;

      for (const pattern of config.patterns) {
        if (lowerProblem.includes(pattern.toLowerCase())) {
          matchedKeywords.push({
            keyword: pattern,
            type,
            weight: config.weight,
          });
          typeScore += config.weight * (pattern.length > 2 ? 1.2 : 1.0);
        }
      }

      if (typeScore > 0) {
        typeScores[type] = typeScore;
      }
    }

    const sortedTypes = Object.entries(typeScores).sort((a, b) => b[1] - a[1]);
    const topCandidate = sortedTypes[0]?.[0] || 'unknown';
    const totalScore = sortedTypes.reduce((sum, [, score]) => sum + score, 0);
    const confidence =
      totalScore > 0 ? Math.min(sortedTypes[0][1] / totalScore, 1) : 0;

    return {
      matchedKeywords,
      totalScore,
      topCandidate,
      confidence,
    };
  }

  private level2StructureAnalysis(problem: string): Level2Result {
    const expressionPatterns: string[] = [];
    const syntaxErrors: string[] = [];

    for (const [patternName, regex] of Object.entries(
      this.expressionPatterns,
    )) {
      const matches = problem.match(regex);
      if (matches && matches.length > 0) {
        expressionPatterns.push(...matches.map((m) => `${patternName}: ${m}`));
      }
    }

    if (
      problem.includes('\\') &&
      !problem.match(/\\(?:frac|lim|int|sum|sqrt)/)
    ) {
      syntaxErrors.push('检测到未转义的LaTeX命令');
    }

    if (problem.match(/\{\s*\}/)) {
      syntaxErrors.push('存在空的LaTeX分组');
    }

    if (
      !problem.match(/[=+\-*/]/) &&
      !problem.includes('求') &&
      !problem.includes('计算')
    ) {
      syntaxErrors.push('问题中缺少运算符或明确的计算要求');
    }

    let completeness: 'complete' | 'partial' | 'incomplete' = 'complete';

    if (syntaxErrors.length > 2) {
      completeness = 'incomplete';
    } else if (syntaxErrors.length > 0 || expressionPatterns.length === 0) {
      completeness = 'partial';
    }

    const detectedStructure = this.detectProblemStructure(expressionPatterns);

    return {
      hasValidExpression: expressionPatterns.length > 0,
      expressionPatterns,
      syntaxErrors,
      completeness,
      detectedStructure,
    };
  }

  private detectProblemStructure(patterns: string[]): string {
    if (patterns.some((p) => p.startsWith('limit:'))) return 'limit-expression';
    if (patterns.some((p) => p.startsWith('derivative:')))
      return 'derivative-expression';
    if (patterns.some((p) => p.startsWith('integral:')))
      return 'integral-expression';
    if (patterns.some((p) => p.startsWith('equation:')))
      return 'equation-expression';
    if (patterns.some((p) => p.startsWith('series:')))
      return 'series-expression';
    if (patterns.some((p) => p.startsWith('function:')))
      return 'function-evaluation';
    if (patterns.length === 0) return 'text-description';
    return 'mixed-structure';
  }

  private async level3SemanticAnalysis(
    problem: string,
    level1: Level1Result,
    level2: Level2Result,
  ): Promise<Level3Result> {
    const contextAnalysis = this.analyzeContext(problem, level1, level2);
    const compositeProblem = this.detectCompositeProblem(problem, level1);
    const subProblems = compositeProblem
      ? this.extractSubProblems(problem, level1)
      : [];
    const recommendedStrategy = this.recommendStrategy(
      level1,
      level2,
      subProblems,
    );

    return {
      contextAnalysis,
      compositeProblem,
      subProblems,
      recommendedStrategy,
    };
  }

  private analyzeContext(
    problem: string,
    level1: Level1Result,
    level2: Level2Result,
  ): string {
    const contexts: string[] = [];

    if (level1.topCandidate !== 'unknown') {
      contexts.push(`主要类型: ${level1.topCandidate}`);
    }

    if (level2.completeness === 'complete') {
      contexts.push('数学表达式完整，适合直接计算');
    } else if (level2.completeness === 'partial') {
      contexts.push('表达式部分完整，需要补充信息');
    } else {
      contexts.push('问题描述不完整，需要进一步澄清');
    }

    if (level2.syntaxErrors.length > 0) {
      contexts.push(`发现${level2.syntaxErrors.length}个语法问题`);
    }

    if (
      problem.includes('然后') ||
      problem.includes('再') ||
      problem.includes('最后')
    ) {
      contexts.push('检测到多步骤问题的连接词');
    }

    return contexts.join('; ');
  }

  private detectCompositeProblem(
    problem: string,
    level1: Level1Result,
  ): boolean {
    const multipleTypes =
      new Set(level1.matchedKeywords.map((k) => k.type)).size > 1;
    const stepIndicators = /(然后|接着|再|之后|最后|首先|其次)/.test(problem);
    const multiPartQuestions = /(求.*?(?:，|。).*?(?:再|又|还))/i.test(problem);

    return multipleTypes && (stepIndicators || multiPartQuestions);
  }

  private extractSubProblems(
    problem: string,
    level1: Level1Result,
  ): Array<{ type: string; description: string }> {
    const subProblems: Array<{ type: string; description: string }> = [];
    const parts = problem.split(/(?:，|。|;)\s*(?=求|计算|证明|解)/);

    if (parts.length > 1) {
      for (const part of parts) {
        const partLevel1 = this.level1KeywordMatching(part.trim());
        if (partLevel1.topCandidate !== 'unknown') {
          subProblems.push({
            type: partLevel1.topCandidate,
            description: part.trim().substring(0, 50),
          });
        }
      }
    }

    return subProblems.slice(0, 3);
  }

  private recommendStrategy(
    level1: Level1Result,
    level2: Level2Result,
    subProblems: Array<{ type: string; description: string }>,
  ): string {
    if (subProblems.length > 1) {
      return `复合问题策略: 先处理${subProblems[0].type}部分，再处理其他部分`;
    }

    if (level2.completeness === 'incomplete') {
      return '建议使用自然语言理解补充缺失信息';
    }

    switch (level1.topCandidate) {
      case 'limit':
        return '极限计算策略: 识别不定式类型→选择方法(洛必达/等价无穷小)→代入计算';
      case 'derivative':
        return '导数求解策略: 分析函数结构→应用求导法则→化简结果';
      case 'integral':
        return '积分计算策略: 识别被积函数→选择积分方法→执行积分→验证结果';
      case 'equation':
        return '方程求解策略: 整理方程形式→选择解法→求解并验证';
      default:
        return '通用解题策略: 理解题意→制定计划→分步求解→验证答案';
    }
  }

  private synthesizeResults(
    level1: Level1Result,
    level2: Level2Result,
    level3: Level3Result,
  ): ProblemClassification {
    let primaryType = level1.topCandidate;
    let confidence = level1.confidence;

    if (level2.completeness === 'incomplete' && confidence > 0.5) {
      confidence *= 0.7;
    }

    if (level3.compositeProblem) {
      confidence = Math.min(confidence, 0.75);
    }

    const secondaryTypes = [
      ...new Set(level1.matchedKeywords.map((k) => k.type)),
    ].filter((t) => t !== primaryType);

    const userConfirmationNeeded =
      confidence < 0.6 ||
      level2.completeness === 'incomplete' ||
      level3.compositeProblem;

    return {
      primaryType,
      secondaryTypes,
      confidence,
      keywords: level1.matchedKeywords.map((k) => k.keyword),
      mathematicalExpressions: level2.expressionPatterns,
      isComplex: level3.compositeProblem || secondaryTypes.length > 1,
      suggestedApproach: level3.recommendedStrategy,
      fallbackType: this.getFallbackType(primaryType, level1),
      userConfirmationNeeded,
      classificationDetails: {
        level1Result: level1,
        level2Result: level2,
        level3Result: level3,
      },
    };
  }

  private getFallbackType(primaryType: string, level1: Level1Result): string {
    if (primaryType !== 'unknown' && level1.confidence > 0.4) {
      return primaryType;
    }

    const typePriority = [
      'limit',
      'derivative',
      'integral',
      'equation',
      'series',
      'proof',
    ];

    for (const type of typePriority) {
      if (level1.matchedKeywords.some((k) => k.type === type)) {
        return type;
      }
    }

    return 'general';
  }

  generateClassificationOptions(
    classification: ProblemClassification,
  ): ClassificationOption[] {
    const options: ClassificationOption[] = [
      {
        type: classification.primaryType,
        description: this.getTypeDescription(classification.primaryType),
        confidence: classification.confidence,
        reason: `基于关键词"${classification.keywords.slice(0, 3).join('", "')}"匹配`,
      },
    ];

    for (const secondary of classification.secondaryTypes.slice(0, 2)) {
      options.push({
        type: secondary,
        description: this.getTypeDescription(secondary),
        confidence: classification.confidence * 0.7,
        reason: `同时包含"${secondary}"相关的关键词`,
      });
    }

    options.push({
      type: 'general',
      description: '通用数学问题（自动选择最佳解法）',
      confidence: 0.5,
      reason: '当无法确定具体类型时使用通用策略',
    });

    return options;
  }

  private getTypeDescription(type: string): string {
    const descriptions: Record<string, string> = {
      limit: '极限计算（包括数列极限、函数极限等）',
      derivative: '导数与微分运算（包括高阶导数、偏导数等）',
      integral: '积分计算（包括定积分、不定积分、多重积分等）',
      equation: '方程与方程组求解',
      series: '级数与序列（包括幂级数、傅里叶级数等）',
      proof: '数学证明与逻辑推理',
      geometry: '几何问题（包括解析几何、立体几何等）',
      matrix: '矩阵与线性代数运算',
      probability: '概率论与数理统计',
      general: '综合数学问题',
    };

    return descriptions[type] || '未知类型的数学问题';
  }

  normalizeInput(problem: string): {
    normalized: string;
    transformations: string[];
  } {
    const transformations: string[] = [];
    let normalized = problem.trim();

    normalized = normalized.replace(/\s+/g, ' ');
    transformations.push('标准化空白字符');

    normalized = normalized.replace(/（/g, '(').replace(/）/g, ')');
    transformations.push('统一括号格式');

    if (/\\?lim\s*[\(]/.test(normalized) && !normalized.includes('{')) {
      normalized = normalized.replace(/\\?lim\s*\(/g, '\\lim_{x \\to a}(');
      transformations.push('补全极限下标格式');
    }

    if (normalized.includes('d/dx') && !normalized.includes('\\frac')) {
      normalized = normalized.replace(/d\/dx/g, '\\frac{d}{dx}');
      transformations.push('标准化导数符号');
    }

    if (normalized.endsWith('？') || normalized.endsWith('?')) {
      normalized = normalized.replace(/[？?]$/, '');
      transformations.push('移除末尾问号');
    }

    return { normalized, transformations };
  }

  validateInput(problem: string): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!problem || problem.trim().length === 0) {
      errors.push('问题内容为空');
      return { isValid: false, errors, warnings };
    }

    if (problem.trim().length < 2) {
      errors.push('问题内容过短，无法进行有效分析');
    }

    if (problem.length > 1000) {
      warnings.push('问题内容较长，可能会影响处理效率');
    }

    if (/[\u4e00-\u9fa5]/.test(problem) && /[a-zA-Z]/.test(problem)) {
      warnings.push('问题混合了中文和英文，将尝试智能识别数学表达式');
    }

    if (
      problem.includes('$') &&
      !(problem.match(/^\$.*\$$/) || problem.match(/\$.*\$/g)?.length === 1)
    ) {
      warnings.push('检测到多个LaTeX标记，请确保格式正确');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
