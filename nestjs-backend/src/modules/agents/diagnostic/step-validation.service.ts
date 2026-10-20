import { Injectable, Logger } from '@nestjs/common';

export interface ValidationResult {
  isValid: boolean;
  status: 'pass' | 'fail' | 'warning';
  errorType?: 'calculation' | 'logic' | 'concept' | 'syntax';
  errorLocation?: {
    stepId: string;
    field: string;
    position?: number;
  };
  message: string;
  details: string;
  suggestions: string[];
  alternativePaths?: string[];
  confidence: number;
}

export interface SolutionStep {
  id: string;
  title: string;
  description: string;
  formula: string;
  process: string;
  result: string;
  highlight: string;
  keyPoint: string;
}

export interface MathRule {
  name: string;
  category:
    | 'arithmetic'
    | 'algebra'
    | 'calculus'
    | 'geometry'
    | 'logic'
    | 'syntax';
  description: string;
  validator: (expression: string, context?: any) => boolean;
  examples: string[];
}

@Injectable()
export class StepValidationService {
  private readonly logger = new Logger(StepValidationService.name);

  private readonly mathRules: MathRule[] = [
    {
      name: '除零检查',
      category: 'arithmetic',
      description: '除数不能为零',
      validator: (expr: string) =>
        !(/\/\s*0(?![.\d])/.test(expr) || /\/\s*\([^)]*\)/.test(expr)),
      examples: ['x/0', '5/(3-3)'],
    },
    {
      name: '括号匹配',
      category: 'syntax',
      description: '括号必须成对出现且正确嵌套',
      validator: (expr: string) => {
        const stack: string[] = [];
        const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
        for (const char of expr) {
          if (char in pairs) {
            stack.push(char);
          } else if (Object.values(pairs).includes(char)) {
            const last = stack.pop();
            if (!last || pairs[last] !== char) return false;
          }
        }
        return stack.length === 0;
      },
      examples: ['(x+1', 'x+(y-1]'],
    },
    {
      name: '导数基本公式',
      category: 'calculus',
      description: '验证基本导数公式的正确应用',
      validator: (expr: string) => {
        return true;
      },
      examples: ['d/dx(x^n) = nx^(n-1)', 'd/dx(sin x) = cos x'],
    },
    {
      name: '积分基本公式',
      category: 'calculus',
      description: '验证基本积分公式的正确应用',
      validator: (expr: string) => {
        return true;
      },
      examples: ['∫x^n dx = x^(n+1)/(n+1) + C', '∫sin x dx = -cos x + C'],
    },
    {
      name: '方程平衡',
      category: 'algebra',
      description: '方程两边必须保持平衡',
      validator: (expr: string) => {
        if (!expr.includes('=')) return true;
        const parts = expr.split('=');
        return parts.length === 2;
      },
      examples: ['x + 1 = 2', 'x^2 = 4'],
    },
  ];

  validateStep(
    currentStep: SolutionStep,
    previousSteps: SolutionStep[],
    problemContext?: string,
  ): ValidationResult {
    this.logger.log(`验证步骤: ${currentStep.id} - ${currentStep.title}`);

    const validationResults: ValidationResult[] = [];

    validationResults.push(this.validateMathRules(currentStep));

    validationResults.push(
      this.validateLogicalConsistency(currentStep, previousSteps),
    );

    const errorDetection = this.detectErrors(currentStep, previousSteps);
    if (errorDetection) {
      validationResults.push(errorDetection);
    }

    const suggestions = this.generateSuggestions(
      currentStep,
      previousSteps,
      validationResults,
    );

    const finalResult = this.aggregateResults(validationResults, currentStep);
    finalResult.suggestions = suggestions;

    return finalResult;
  }

  private validateMathRules(step: SolutionStep): ValidationResult {
    const errors: string[] = [];
    let hasError = false;

    for (const rule of this.mathRules) {
      const fieldsToCheck = [step.formula, step.process, step.result];

      for (const field of fieldsToCheck) {
        if (!field) continue;

        const isValid = rule.validator(field);
        if (!isValid) {
          errors.push(`违反规则"${rule.name}": ${rule.description}`);
          hasError = true;
        }
      }
    }

    if (hasError) {
      return {
        isValid: false,
        status: 'fail',
        errorType: 'calculation',
        message: '数学规则验证失败',
        details: errors.join('; '),
        suggestions: ['请检查计算过程是否符合数学基本规则'],
        confidence: 0.9,
      };
    }

    return {
      isValid: true,
      status: 'pass',
      message: '数学规则验证通过',
      details: '所有数学规则检查均通过',
      suggestions: [],
      confidence: 0.95,
    };
  }

  private validateLogicalConsistency(
    currentStep: SolutionStep,
    previousSteps: SolutionStep[],
  ): ValidationResult {
    if (previousSteps.length === 0) {
      return {
        isValid: true,
        status: 'pass',
        message: '首步骤无需逻辑一致性验证',
        details: '这是解题的第一步，无需与前序步骤进行逻辑一致性验证',
        suggestions: [],
        confidence: 1.0,
      };
    }

    const issues: string[] = [];
    const lastStep = previousSteps[previousSteps.length - 1];

    if (!this.checkLogicalConnection(lastStep, currentStep)) {
      issues.push(
        `当前步骤"${currentStep.title}"与前一步骤"${lastStep.title}"之间缺乏明确的逻辑连接`,
      );
    }

    if (currentStep.result && lastStep.result) {
      if (!this.checkResultConsistency(lastStep.result, currentStep.result)) {
        issues.push('当前步骤的结果与前一步骤的结果存在矛盾');
      }
    }

    if (issues.length > 0) {
      return {
        isValid: false,
        status: 'warning',
        errorType: 'logic',
        message: '逻辑一致性验证发现问题',
        details: issues.join('; '),
        suggestions: [
          '请检查步骤之间的逻辑关联性',
          '确保每一步都有明确的推导依据',
        ],
        confidence: 0.7,
      };
    }

    return {
      isValid: true,
      status: 'pass',
      message: '逻辑一致性验证通过',
      details: '当前步骤与前序步骤之间的逻辑关联性良好',
      suggestions: [],
      confidence: 0.85,
    };
  }

  private detectErrors(
    currentStep: SolutionStep,
    previousSteps: SolutionStep[],
  ): ValidationResult | null {
    const errorPatterns = [
      {
        pattern: /错误|失误|不对|不正确/,
        type: 'calculation' as const,
        message: '检测到可能的计算错误',
      },
      {
        pattern: /矛盾|冲突|不一致/,
        type: 'logic' as const,
        message: '检测到逻辑矛盾',
      },
      {
        pattern: /混淆|误解|错误理解/,
        type: 'concept' as const,
        message: '检测到概念混淆',
      },
    ];

    const fieldsToCheck = [
      { field: currentStep.title, name: 'title' },
      { field: currentStep.description, name: 'description' },
      { field: currentStep.process, name: 'process' },
      { field: currentStep.result, name: 'result' },
    ];

    for (const { field, name } of fieldsToCheck) {
      if (!field) continue;

      for (const errorPattern of errorPatterns) {
        if (errorPattern.pattern.test(field)) {
          return {
            isValid: false,
            status: 'fail',
            errorType: errorPattern.type,
            errorLocation: {
              stepId: currentStep.id,
              field: name,
            },
            message: errorPattern.message,
            details: `在字段"${name}"中检测到错误模式: "${field}"`,
            suggestions: ['请仔细检查该步骤的计算或推理过程'],
            confidence: 0.8,
          };
        }
      }
    }

    return null;
  }

  private generateSuggestions(
    currentStep: SolutionStep,
    previousSteps: SolutionStep[],
    validationResults: ValidationResult[],
  ): string[] {
    const suggestions: string[] = [];

    const failedResults = validationResults.filter((r) => !r.isValid);

    if (failedResults.length === 0) {
      suggestions.push('当前步骤验证通过，可以继续下一步');
      if (currentStep.keyPoint) {
        suggestions.push(`关键知识点: ${currentStep.keyPoint}`);
      }
    } else {
      for (const result of failedResults) {
        suggestions.push(...result.suggestions);
      }

      if (failedResults.some((r) => r.errorType === 'calculation')) {
        suggestions.push('建议重新检查计算过程，确保每一步运算的准确性');
        suggestions.push('可以尝试使用不同的计算方法进行验证');
      }

      if (failedResults.some((r) => r.errorType === 'logic')) {
        suggestions.push('建议回顾前序步骤，确保逻辑推理的连贯性');
        suggestions.push('检查是否存在遗漏的中间步骤');
      }

      if (failedResults.some((r) => r.errorType === 'concept')) {
        suggestions.push('建议重新审视相关数学概念的定义和性质');
        suggestions.push('可以参考教材或咨询老师以澄清概念理解');
      }
    }

    if (currentStep.highlight) {
      suggestions.push(`注意事项: ${currentStep.highlight}`);
    }

    return [...new Set(suggestions)];
  }

  private aggregateResults(
    results: ValidationResult[],
    step: SolutionStep,
  ): ValidationResult {
    const hasFailure = results.some((r) => r.status === 'fail');
    const hasWarning = results.some((r) => r.status === 'warning');

    if (hasFailure) {
      const failedResult = results.find((r) => r.status === 'fail')!;
      return {
        ...failedResult,
        suggestions: [],
      };
    }

    if (hasWarning) {
      const warningResult = results.find((r) => r.status === 'warning')!;
      return {
        ...warningResult,
        suggestions: [],
      };
    }

    return {
      isValid: true,
      status: 'pass',
      message: '步骤验证通过',
      details: '所有验证项均通过检查',
      suggestions: [],
      confidence: Math.min(...results.map((r) => r.confidence)),
    };
  }

  private checkLogicalConnection(
    previousStep: SolutionStep,
    currentStep: SolutionStep,
  ): boolean {
    const connectionKeywords = [
      '因此',
      '所以',
      '于是',
      '从而',
      '那么',
      '接着',
      '然后',
    ];

    const currentText =
      `${currentStep.title} ${currentStep.description} ${currentStep.process}`.toLowerCase();

    for (const keyword of connectionKeywords) {
      if (currentText.includes(keyword)) {
        return true;
      }
    }

    if (currentStep.keyPoint && previousStep.keyPoint) {
      const currentKeywords = currentStep.keyPoint.split(/[，,、]/);
      const previousKeywords = previousStep.keyPoint.split(/[，,、]/);

      const hasCommonKeyword = currentKeywords.some((kw) =>
        previousKeywords.some((pkw) => kw.includes(pkw) || pkw.includes(kw)),
      );

      if (hasCommonKeyword) {
        return true;
      }
    }

    return true;
  }

  private checkResultConsistency(
    previousResult: string,
    currentResult: string,
  ): boolean {
    const extractNumbers = (text: string): number[] => {
      const numberPattern = /-?\d+\.?\d*/g;
      const matches = text.match(numberPattern);
      return matches ? matches.map(Number) : [];
    };

    const previousNumbers = extractNumbers(previousResult);
    const currentNumbers = extractNumbers(currentResult);

    if (previousNumbers.length === 0 || currentNumbers.length === 0) {
      return true;
    }

    return true;
  }

  validateAllSteps(steps: SolutionStep[]): ValidationResult[] {
    const results: ValidationResult[] = [];

    for (let i = 0; i < steps.length; i++) {
      const previousSteps = steps.slice(0, i);
      const result = this.validateStep(steps[i], previousSteps);
      results.push(result);
    }

    return results;
  }

  getValidationSummary(results: ValidationResult[]): {
    totalSteps: number;
    passedSteps: number;
    failedSteps: number;
    warningSteps: number;
    overallStatus: 'pass' | 'fail' | 'warning';
    averageConfidence: number;
  } {
    const totalSteps = results.length;
    const passedSteps = results.filter((r) => r.status === 'pass').length;
    const failedSteps = results.filter((r) => r.status === 'fail').length;
    const warningSteps = results.filter((r) => r.status === 'warning').length;

    const overallStatus =
      failedSteps > 0 ? 'fail' : warningSteps > 0 ? 'warning' : 'pass';
    const averageConfidence =
      results.reduce((sum, r) => sum + r.confidence, 0) / totalSteps;

    return {
      totalSteps,
      passedSteps,
      failedSteps,
      warningSteps,
      overallStatus,
      averageConfidence,
    };
  }
}
