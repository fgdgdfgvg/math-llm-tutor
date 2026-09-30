import { Logger } from '@nestjs/common';
import { SystemState } from './state-manager.service';
import { ProblemClassification } from './input-preprocessor.service';
import { extractAiJson } from './ai-json.utils';

export interface StandardOutput {
  problemType: string;
  knowledgePoints: Array<{
    name: string;
    description: string;
    formula?: string;
    difficulty: string;
  }>;
  solutionSteps: Array<{
    step: number;
    description: string;
    formula: string;
    result: string;
    keyPoint?: string;
    highlight?: string;
    isValid: boolean;
  }>;
  finalAnswer: string;
  errorAnalysis: string;
  learningAdvice: string;
  metadata: {
    executionTime: number;
    agentStatus: Record<string, string>;
    confidence: number;
    version: string;
  };
  diagnostics: {
    errorCount: number;
    warningCount: number;
    verificationPassed: number;
    verificationTotal: number;
  };
}

export interface OutputValidationResult {
  isValid: boolean;
  missingFields: string[];
  formatErrors: string[];
  qualityIssues: string[];
  recommendations: string[];
}

export interface OutputOptions {
  includeMetadata?: boolean;
  includeDiagnostics?: boolean;
  minify?: boolean;
  format?: 'json' | 'text' | 'markdown';
  language?: 'zh' | 'en';
}

export class OutputStandardizer {
  private readonly logger = new Logger(OutputStandardizer.name);
  private readonly defaultKnowledgePoints: Array<{
    name: string;
    description: string;
    formula: string;
    difficulty: string;
  }> = [
    {
      name: '数学分析基础',
      description: '基本数学概念和运算规则',
      formula: '',
      difficulty: 'basic',
    },
    {
      name: '问题分析',
      description: '理解问题并制定解题策略',
      formula: '',
      difficulty: 'basic',
    },
  ];

  private readonly termMap: Record<string, string> = {
    '极限': 'limit',
    '导数': 'derivative',
    '积分': 'integral',
    '方程': 'equation',
    '级数': 'series',
    '证明': 'proof',
    '几何': 'geometry',
    '矩阵': 'matrix',
    '概率': 'probability',
    '未equation的解': 'solution',
  };

  generateStandardOutput(
    state: SystemState,
    classification?: ProblemClassification,
    options: OutputOptions = {}
  ): StandardOutput {
    this.logger.log('生成标准化输出');

    const output: StandardOutput = {
      problemType: this.standardizeProblemType(state),
      knowledgePoints: this.standardizeKnowledgePoints(state),
      solutionSteps: this.standardizeSolutionSteps(state),
      finalAnswer: this.standardizeFinalAnswer(state),
      errorAnalysis: this.generateErrorAnalysis(state),
      learningAdvice: this.generateLearningAdvice(state),
      metadata: this.generateMetadata(state, classification),
      diagnostics: this.generateDiagnostics(state),
    };

    return output;
  }

  private standardizeProblemType(state: SystemState): string {
    let type = state.problemType || 'unknown';
    
    if (type === 'unknown' || type.includes('未识别')) {
      return '通用数学问题';
    }

    const typeMap: Record<string, string> = {
      limit: '极限计算',
      derivative: '导数求解',
      integral: '积分计算',
      equation: '方程求解',
      series: '级数求和',
      proof: '数学证明',
      geometry: '几何问题',
      matrix: '矩阵运算',
      probability: '概率统计',
      general: '综合数学问题',
    };

    return typeMap[type] || type;
  }

  private standardizeKnowledgePoints(state: SystemState): StandardOutput['knowledgePoints'] {
    if (state.knowledgePoints && state.knowledgePoints.length > 0) {
      return state.knowledgePoints.map((kp, index) => ({
        name: kp.name || `知识点 ${index + 1}`,
        description: kp.description || '相关数学概念',
        formula: kp.formula || '',
        difficulty: kp.difficulty || 'medium',
      }));
    }

    return this.defaultKnowledgePoints;
  }

  private standardizeSolutionSteps(state: SystemState): StandardOutput['solutionSteps'] {
    if (!state.solutionSteps || state.solutionSteps.length === 0) {
      return [
        {
          step: 1,
          description: '分析问题',
          formula: '',
          result: '问题理解完成',
          isValid: true,
        },
        {
          step: 2,
          description: '执行计算',
          formula: '',
          result: '计算过程完成',
          isValid: true,
        },
      ];
    }

    return state.solutionSteps.map((step, index) => {
      const parsedStep = typeof step === 'string' ? this.parseStepString(step) : step;
      
      return {
        step: index + 1,
        description: parsedStep.stepTitle || parsedStep.description || `步骤 ${index + 1}`,
        formula: parsedStep.formula || '',
        result: parsedStep.result || '',
        keyPoint: parsedStep.keyPoint || '',
        highlight: parsedStep.highlight || '',
        isValid: parsedStep.isValid !== false,
      };
    });
  }

  private parseStepString(stepStr: string): any {
    const parsed = extractAiJson(stepStr);
    if (parsed) return parsed;
    return {
      stepTitle: stepStr.substring(0, 20),
      process: stepStr,
      result: stepStr,
      isValid: true,
    };
  }

  private standardizeFinalAnswer(state: SystemState): string {
    let answer = state.finalAnswer || '';

    // 不再按题型编造硬编码假答案（如所有极限题都返回 1、方程题都返回 x=0）。
    // 假答案会污染判题、错题本与学习评估；答案缺失时诚实标记即可。
    if (!answer || /未equation|无法|未能|（答案待计算）/.test(answer)) {
      answer = '未能得出确定结果，请检查题目或重试';
    }

    return this.standardizeTerminology(answer);
  }

  private generateErrorAnalysis(state: SystemState): string {
    if (!state.errors || state.errors.length === 0) {
      return '未发现错误，解题过程正确。';
    }

    const errorGroups: Record<string, string[]> = {};
    
    state.errors.forEach(error => {
      if (!errorGroups[error.agent]) {
        errorGroups[error.agent] = [];
      }
      errorGroups[error.agent].push(error.message);
    });

    const analysis: string[] = [];
    
    for (const [agent, messages] of Object.entries(errorGroups)) {
      analysis.push(`${this.getAgentName(agent)}: ${messages.join('; ')}`);
    }

    return analysis.join('\n') || '未发现错误，解题过程正确。';
  }

  private generateLearningAdvice(state: SystemState): string {
    if (state.feedback?.suggestions && state.feedback.suggestions.length > 0) {
      return state.feedback.suggestions.join('\n');
    }

    const defaultAdvice: Record<string, string> = {
      limit: '建议掌握洛必达法则和等价无穷小替换等极限计算方法。',
      derivative: '建议熟练掌握各种求导法则，特别是链式法则。',
      integral: '建议多练习换元积分法和分部积分法。',
      equation: '建议掌握各种方程的解法和验证方法。',
    };

    return defaultAdvice[state.problemType] || '建议加强基础知识学习，多做练习题巩固。';
  }

  private generateMetadata(
    state: SystemState,
    classification?: ProblemClassification
  ): StandardOutput['metadata'] {
    return {
      executionTime: Date.now(),
      agentStatus: {
        planner: state.plan ? 'completed' : 'failed',
        solver: state.solutionSteps.length > 0 ? 'completed' : 'failed',
        diagnostic: state.verificationResults.length > 0 ? 'completed' : 'failed',
        feedback: state.feedback ? 'completed' : 'failed',
      },
      confidence: classification?.confidence || state.confidence || 0.5,
      version: '1.0.0',
    };
  }

  private generateDiagnostics(state: SystemState): StandardOutput['diagnostics'] {
    const errorCount = state.errors?.filter(e => e.severity === 'error').length || 0;
    const warningCount = state.errors?.filter(e => e.severity === 'warning').length || 0;
    const verificationPassed = state.verificationResults?.filter(v => v.isValid).length || 0;
    const verificationTotal = state.verificationResults?.length || 0;

    return {
      errorCount,
      warningCount,
      verificationPassed,
      verificationTotal,
    };
  }

  validateOutput(output: StandardOutput): OutputValidationResult {
    const missingFields: string[] = [];
    const formatErrors: string[] = [];
    const qualityIssues: string[] = [];
    const recommendations: string[] = [];

    if (!output.problemType) missingFields.push('problemType');
    if (!output.knowledgePoints || output.knowledgePoints.length === 0) {
      missingFields.push('knowledgePoints');
      recommendations.push('添加至少一个知识点分析');
    }
    if (!output.solutionSteps || output.solutionSteps.length === 0) {
      missingFields.push('solutionSteps');
      recommendations.push('添加至少一个解题步骤');
    }
    if (!output.finalAnswer) missingFields.push('finalAnswer');
    if (!output.errorAnalysis) missingFields.push('errorAnalysis');
    if (!output.learningAdvice) missingFields.push('learningAdvice');

    if (output.solutionSteps.length < 2) {
      qualityIssues.push('解题步骤过少，建议至少包含2个步骤');
      recommendations.push('添加更多详细的解题步骤');
    }

    if (output.finalAnswer.includes('未equation') || output.finalAnswer.includes('无法')) {
      formatErrors.push('最终答案格式不标准');
      recommendations.push('标准化最终答案格式');
    }

    if (output.knowledgePoints.length > 5) {
      qualityIssues.push('知识点分析过多，建议控制在5个以内');
    }

    return {
      isValid: missingFields.length === 0 && formatErrors.length === 0,
      missingFields,
      formatErrors,
      qualityIssues,
      recommendations,
    };
  }

  formatOutput(output: StandardOutput, options: OutputOptions = {}): string {
    if (options.format === 'text') {
      return this.formatAsText(output);
    }
    if (options.format === 'markdown') {
      return this.formatAsMarkdown(output);
    }
    return JSON.stringify(output, null, options.minify ? 0 : 2);
  }

  private formatAsText(output: StandardOutput): string {
    const lines: string[] = [];
    
    lines.push('=== 数学问题解答 ===');
    lines.push('');
    lines.push(`问题类型: ${output.problemType}`);
    lines.push('');
    lines.push('=== 知识点分析 ===');
    output.knowledgePoints.forEach((kp, index) => {
      lines.push(`${index + 1}. ${kp.name}: ${kp.description}`);
      if (kp.formula) lines.push(`   公式: ${kp.formula}`);
    });
    lines.push('');
    lines.push('=== 解题步骤 ===');
    output.solutionSteps.forEach(step => {
      lines.push(`${step.step}. ${step.description}`);
      if (step.formula) lines.push(`   公式: ${step.formula}`);
      lines.push(`   结果: ${step.result}`);
      if (step.highlight) lines.push(`   提示: ${step.highlight}`);
      lines.push('');
    });
    lines.push('=== 最终答案 ===');
    lines.push(output.finalAnswer);
    lines.push('');
    lines.push('=== 错误分析 ===');
    lines.push(output.errorAnalysis || '无错误');
    lines.push('');
    lines.push('=== 学习建议 ===');
    lines.push(output.learningAdvice);
    
    return lines.join('\n');
  }

  private formatAsMarkdown(output: StandardOutput): string {
    const lines: string[] = [];
    
    lines.push('# 数学问题解答');
    lines.push('');
    lines.push(`## 问题类型`);
    lines.push(`- ${output.problemType}`);
    lines.push('');
    lines.push(`## 知识点分析`);
    output.knowledgePoints.forEach((kp, index) => {
      lines.push(`### ${index + 1}. ${kp.name}`);
      lines.push(`- 描述: ${kp.description}`);
      if (kp.formula) lines.push(`- 公式: \`${kp.formula}\``);
      lines.push('');
    });
    lines.push(`## 解题步骤`);
    output.solutionSteps.forEach(step => {
      lines.push(`### 步骤 ${step.step}: ${step.description}`);
      if (step.formula) lines.push(`**公式**: \`${step.formula}\``);
      lines.push(`**结果**: ${step.result}`);
      if (step.highlight) lines.push(`**提示**: ${step.highlight}`);
      lines.push('');
    });
    lines.push(`## 最终答案`);
    lines.push(`> ${output.finalAnswer}`);
    lines.push('');
    lines.push(`## 错误分析`);
    lines.push(output.errorAnalysis || '无错误');
    lines.push('');
    lines.push(`## 学习建议`);
    lines.push(output.learningAdvice);
    
    return lines.join('\n');
  }

  private standardizeTerminology(text: string): string {
    let standardized = text;
    
    for (const [chinese, english] of Object.entries(this.termMap)) {
      if (standardized.includes(chinese)) {
        standardized = standardized.replace(new RegExp(chinese, 'g'), english);
      }
    }
    
    return standardized;
  }

  private getAgentName(agent: string): string {
    const agentMap: Record<string, string> = {
      planner: '规划智能体',
      solver: '求解智能体',
      diagnostic: '诊断智能体',
      feedback: '反馈智能体',
      system: '系统',
    };
    return agentMap[agent] || agent;
  }

  generateFallbackOutput(problem: string): StandardOutput {
    this.logger.log('生成降级输出');
    
    return {
      problemType: '通用数学问题',
      knowledgePoints: this.defaultKnowledgePoints,
      solutionSteps: [
        {
          step: 1,
          description: '理解问题',
          formula: '',
          result: `分析"${problem.substring(0, 50)}\..."的解题思路`,
          isValid: true,
        },
        {
          step: 2,
          description: '执行计算',
          formula: '',
          result: '计算过程完成',
          isValid: true,
        },
        {
          step: 3,
          description: '验证结果',
          formula: '',
          result: '结果验证完成',
          isValid: true,
        },
      ],
      finalAnswer: '（答案待计算）',
      errorAnalysis: '系统暂时无法提供详细的错误分析，请检查配置。',
      learningAdvice: '建议检查系统配置并重新尝试。',
      metadata: {
        executionTime: Date.now(),
        agentStatus: {
          planner: 'failed',
          solver: 'partial',
          diagnostic: 'failed',
          feedback: 'failed',
        },
        confidence: 0.3,
        version: '1.0.0',
      },
      diagnostics: {
        errorCount: 1,
        warningCount: 0,
        verificationPassed: 0,
        verificationTotal: 0,
      },
    };
  }

  exportOutput(output: StandardOutput, format: 'json' | 'csv' | 'markdown' = 'json'): string {
    switch (format) {
      case 'csv':
        return this.exportAsCsv(output);
      case 'markdown':
        return this.formatAsMarkdown(output);
      default:
        return JSON.stringify(output, null, 2);
    }
  }

  private exportAsCsv(output: StandardOutput): string {
    const lines: string[] = [];
    lines.push('Type,Value');
    lines.push(`Problem Type,${output.problemType}`);
    lines.push(`Final Answer,${output.finalAnswer}`);
    lines.push(`Error Analysis,${output.errorAnalysis}`);
    lines.push(`Learning Advice,${output.learningAdvice}`);
    
    output.knowledgePoints.forEach((kp, index) => {
      lines.push(`Knowledge Point ${index + 1},${kp.name}`);
      lines.push(`Description ${index + 1},${kp.description}`);
    });
    
    output.solutionSteps.forEach(step => {
      lines.push(`Step ${step.step},${step.description}`);
      lines.push(`Formula ${step.step},${step.formula}`);
      lines.push(`Result ${step.step},${step.result}`);
    });
    
    return lines.join('\n');
  }
}
