import { Injectable, Logger } from '@nestjs/common';

export enum ErrorLayer {
  SYNTAX = 'syntax',
  CALCULATION = 'calculation',
  LOGIC = 'logic',
  METHOD = 'method',
}

export enum ErrorSeverity {
  CRITICAL = 'critical',
  MAJOR = 'major',
  MINOR = 'minor',
  WARNING = 'warning',
}

export interface DiagnosisIssue {
  layer: ErrorLayer;
  severity: ErrorSeverity;
  message: string;
  location?: string;
  suggestion: string;
  confidence: number;
}

export interface StepDiagnosisResult {
  stepIndex: number;
  stepContent: string;
  issues: DiagnosisIssue[];
  overallHealth: 'healthy' | 'warning' | 'critical';
  score: number;
}

export interface FullDiagnosisReport {
  problem: string;
  steps: StepDiagnosisResult[];
  globalIssues: DiagnosisIssue[];
  totalScore: number;
  summary: string;
  suggestions: string[];
}

const MATH_SYNTAX_RULES: Array<{
  pattern: RegExp;
  message: string;
  suggestion: string;
  severity: ErrorSeverity;
  checkFn?: (content: string) => boolean;
}> = [
  {
    pattern: /\\frac\{[^}]*\}\{\s*\}/,
    message: '分式分母为空或缺失',
    suggestion: '检查\\frac{分子}{分母}中的分母是否完整填写',
    severity: ErrorSeverity.CRITICAL,
  },
  {
    pattern: /\bint\b(?!\s*[_\^])/,
    message: '积分表达式缺少积分限或积分变量',
    suggestion: '不定积分格式应为\\int f(x)dx，定积分应为\\int_a^b f(x)dx',
    severity: ErrorSeverity.MAJOR,
  },
  {
    pattern: /\\lim(?!\s*[_{])/,
    message: '极限表达式缺少趋近条件',
    suggestion: '极限格式应为\\lim_{x\\to a} f(x)',
    severity: ErrorSeverity.MAJOR,
  },
  {
    pattern: /\\sqrt\{[^}]*\}\s*[+\-*/]\s*\\sqrt\{[^}]*\}/,
    message: '根式运算可能需要有理化处理',
    suggestion: '检查是否需要分母有理化或分子有理化',
    severity: ErrorSeverity.WARNING,
  },
  {
    pattern: /\\\\\s*\\begin\{/,
    message: 'LaTeX换行符位置不当',
    suggestion: '换行符\\\\不应出现在\\begin环境之前',
    severity: ErrorSeverity.MINOR,
  },
  {
    pattern: /[=≈≠≡]\s*[=≈≠≡]/,
    message: '连续使用关系运算符，可能缺少中间表达式',
    suggestion: '检查两个等号之间是否遗漏了中间推导步骤',
    severity: ErrorSeverity.WARNING,
  },
  {
    pattern: /\\sum(?!\s*[_{^])/,
    message: '求和符号缺少求和指标',
    suggestion: '求和格式为\\sum_{i=1}^{n}',
    severity: ErrorSeverity.MINOR,
  },
  {
    pattern: /\bdx\b(?!\s*[=+\-]|\s*$)/i,
    message: '微分dx后应紧跟运算符或结束',
    suggestion: '检查dx后的表达式是否遗漏了运算符',
    severity: ErrorSeverity.WARNING,
  },
  {
    pattern: /\+\s*C\s*\+\s*C\b/,
    message: '积分常数C重复出现',
    suggestion: '多个积分常数可合并为一个C，无需重复书写',
    severity: ErrorSeverity.MINOR,
  },
  {
    pattern: /\\begin\{[^}]+\}/,
    message: 'LaTeX环境未正确闭合',
    suggestion: '检查\\begin{...}和\\end{...}是否配对',
    severity: ErrorSeverity.CRITICAL,
    checkFn: (content: string) => {
      const begins = content.match(/\\begin\{([^}]+)\}/g) || [];
      const ends = content.match(/\\end\{([^}]+)\}/g) || [];
      return begins.length !== ends.length;
    },
  },
  {
    pattern: /\([^)]*$/m,
    message: '括号未闭合',
    suggestion: '检查左括号(是否都有对应的右括号)',
    severity: ErrorSeverity.CRITICAL,
  },
  {
    pattern: /\\partial\s+([xyz])\s+\\partial\s+\1/,
    message: '混合偏导数写法可能有误',
    suggestion: '混合偏导数应写为\\frac{\\partial^2 f}{\\partial x\\partial y}',
    severity: ErrorSeverity.WARNING,
  },
];

const CALCULATION_CHECK_PATTERNS: Array<{
  name: string;
  check: (step: string, context?: string[]) => DiagnosisIssue | null;
}> = [
  {
    name: '符号检查',
    check: (step: string): DiagnosisIssue | null => {
      const signPatterns = [
        { regex: /\(-([a-zA-Z])\)\^2/g, msg: '(-x)² = x²，负号在平方运算后消失' },
        { regex: /-\s*\(-\s*([^)]+)\)/g, msg: '双重负号-(-a)应化简为+a' },
        { regex: /\[-([^[\]]+)\]\^([13579])/g, msg: '奇次幂的负号需保留：(-a)^奇数 = -(a^奇数)' },
      ];
      for (const { regex, msg } of signPatterns) {
        if (regex.test(step)) {
          regex.lastIndex = 0;
          return {
            layer: ErrorLayer.CALCULATION,
            severity: ErrorSeverity.WARNING,
            message: msg,
            suggestion: '重新检查符号运算，特别注意负号的处理',
            confidence: 0.7,
          };
        }
      }
      return null;
    },
  },
  {
    name: '常数遗漏检查',
    check: (step: string, context?: string[]): DiagnosisIssue | null => {
      if (/\\int.*dx/i.test(step) && !step.includes('+ C') && !step.includes('+C')) {
        if (!context || !context.some(c => /定积分|定限|_\{[^}]*\}^\{[^}]*\}/.test(c))) {
          return {
            layer: ErrorLayer.CALCULATION,
            severity: ErrorSeverity.MAJOR,
            message: '不定积分结果可能遗漏积分常数C',
            suggestion: '不定积分必须添加积分常数+C',
            confidence: 0.9,
          };
        }
      }
      return null;
    },
  },
  {
    name: '链式法则检查',
    check: (step: string): DiagnosisIssue | null => {
      const chainHints = [
        /\\sin\s*\([^)]*[*/]\s*x\s*\+/,
        /\\cos\s*\([^)]*\^/,
        /\\ln\s*\([^)]*\\sin/,
        /e\^\{[^}]*[*/]x/,
      ];
      for (const hint of chainHints) {
        if (hint.test(step)) {
          return {
            layer: ErrorLayer.CALCULATION,
            severity: ErrorSeverity.WARNING,
            message: '复合函数求导需应用链式法则，确认内层函数已正确求导',
            suggestion: '检查是否应用链式法则：外导×内导',
            confidence: 0.6,
          };
        }
      }
      return null;
    },
  },
  {
    name: '除数为零检查',
    check: (step: string): DiagnosisIssue | null => {
      if (step.includes('\\div 0') || step.includes('/0') || step.includes('除以 0') || step.includes('/{0}')) {
        return {
          layer: ErrorLayer.CALCULATION,
          severity: ErrorSeverity.CRITICAL,
          message: '可能出现除以零的错误',
          suggestion: '检查分母是否为零，确保除数不为零',
          confidence: 0.95,
        };
      }
      return null;
    },
  },
  {
    name: '幂运算检查',
    check: (step: string): DiagnosisIssue | null => {
      const powerIssues = [
        { regex: /x\^\(-(\d)\)\s*\*\s*x\^\((\d)\)/, msg: '同底幂相乘，指数应相加而非相乘' },
        { regex: /\(([^)]+)\)\^(\d)\s*\^\s*(\d)/, msg: '幂的幂应写为(a^m)^n或a^{mn}' },
      ];
      for (const { regex, msg } of powerIssues) {
        if (regex.test(step)) {
          regex.lastIndex = 0;
          return {
            layer: ErrorLayer.CALCULATION,
            severity: ErrorSeverity.WARNING,
            message: msg,
            suggestion: '检查幂运算规则：a^m * a^n = a^{m+n}，(a^m)^n = a^{mn}',
            confidence: 0.7,
          };
        }
      }
      return null;
    },
  },
];

const LOGIC_CHECK_PATTERNS: Array<{
  name: string;
  check: (steps: string[], currentIndex: number) => DiagnosisIssue | null;
}> = [
  {
    name: '步骤连贯性检查',
    check: (steps: string[], currentIndex: number): DiagnosisIssue | null => {
      if (currentIndex > 0) {
        const prev = steps[currentIndex - 1];
        const curr = steps[currentIndex];
        const prevHasResult = /结果|result|=\s*\S|得到|因此|所以|故/.test(prev);
        const currUsesPrev = /代入|利用.*结果|由上|根据.*步/.test(curr);
        if (prevHasResult && !currUsesPrev && /计算|求解|推导/.test(curr)) {
          return {
            layer: ErrorLayer.LOGIC,
            severity: ErrorSeverity.WARNING,
            message: `第${currentIndex}步与第${currentIndex + 1}步之间可能缺少逻辑衔接`,
            suggestion: '在步骤间添加过渡说明，明确如何利用前一步的结果',
            confidence: 0.5,
          };
        }
      }
      return null;
    },
  },
  {
    name: '必要条件检查',
    check: (steps: string[], currentIndex: number): DiagnosisIssue | null => {
      const step = steps[currentIndex];
      if (/洛必达|L['']Hôpital|lhopital/i.test(step)) {
        const hasCondition = /0\/0|不定式|不定型|满足条件|∞\/∞/.test(step);
        if (!hasCondition) {
          return {
            layer: ErrorLayer.LOGIC,
            severity: ErrorSeverity.MAJOR,
            message: '使用洛必达法则前未验证不定式条件（0/0或∞/∞型）',
            suggestion: '使用洛必达法则前必须确认极限为0/0或∞/∞型不定式',
            confidence: 0.85,
          };
        }
      }
      return null;
    },
  },
  {
    name: '循环推理检查',
    check: (steps: string[], currentIndex: number): DiagnosisIssue | null => {
      const step = steps[currentIndex];
      if (currentIndex > 0) {
        for (let i = 0; i < currentIndex; i++) {
          const prevKeywords = steps[i].match(/[\u4e00-\u9fa5]{4,}/g) || [];
          const currKeywords = step.match(/[\u4e00-\u9fa5]{4,}/g) || [];
          const overlap = currKeywords.filter(k => prevKeywords.includes(k));
          if (overlap.length >= 3 && !step.includes('同理') && !step.includes('类似')) {
            return {
              layer: ErrorLayer.LOGIC,
              severity: ErrorSeverity.WARNING,
              message: '可能存在循环推理，当前步骤内容与前序步骤高度重复',
              suggestion: '确认是否为合理重复（如对称性/类似处理），否则重新梳理逻辑',
              confidence: 0.4,
            };
          }
        }
      }
      return null;
    },
  },
  {
    name: '结论跳步检查',
    check: (steps: string[], currentIndex: number): DiagnosisIssue | null => {
      const step = steps[currentIndex];
      const suddenConclusion = /直接得出|显然|易知|显而易见|显然可得/.test(step);
      const noCalculation = !/[=≈≠≡+\-*/^]/.test(step);
      if (suddenConclusion && noCalculation && currentIndex === steps.length - 1) {
        return {
          layer: ErrorLayer.LOGIC,
          severity: ErrorSeverity.MAJOR,
          message: '最后步骤结论缺乏推导过程（使用"显然"等词跳过关键推理）',
          suggestion: '补充关键的推导步骤，避免主观判断替代数学推导',
          confidence: 0.75,
        };
      }
      return null;
    },
  },
  {
    name: '无穷小阶数检查',
    check: (steps: string[], currentIndex: number): DiagnosisIssue | null => {
      const step = steps[currentIndex];
      if (/等价无穷小|替换|代换/.test(step)) {
        if (!step.includes('阶') && !step.includes('泰勒') && !step.includes('taylor')) {
          return {
            layer: ErrorLayer.LOGIC,
            severity: ErrorSeverity.WARNING,
            message: '使用等价无穷小替换时需注意替换的合法性（加减法中不能随意替换不同阶无穷小）',
            suggestion: '等价无穷小替换仅适用于乘除运算；加减法中的替换需泰勒展开验证',
            confidence: 0.7,
          };
        }
      }
      return null;
    },
  },
];

const METHOD_OPTIMALITY_MAP: Record<string, { preferred: string[]; avoid: string[]; reason: string }> = {
  'limit_rational': {
    preferred: ['抓大头法（最高次项比较）', '因式分解+约分'],
    avoid: ['盲目使用洛必达法则'],
    reason: '有理函数极限优先使用代数化简方法，效率更高，不易出错',
  },
  'limit_trigonometric': {
    preferred: ['等价无穷小替换', '重要极限公式', '泰勒展开'],
    avoid: ['多次洛必达求导'],
    reason: '三角函数的洛必达可能导致越来越复杂的表达式',
  },
  'derivative_composite': {
    preferred: ['链式法则（逐层求导）', '对数求导法'],
    avoid: ['直接展开后再求导'],
    reason: '复合函数直接展开可能导致长表达式，增加出错概率',
  },
  'derivative_implicit': {
    preferred: ['隐函数求导公式法', '两边同时对x求导'],
    avoid: ['强行解出显式表达式再求导'],
    reason: '隐函数解显式往往复杂甚至不可能，直接求导效率更高',
  },
  'integration_by_parts': {
    preferred: ['LIATE选择法（对数>反三角>代数>三角>指数）'],
    avoid: ['随机选择u和dv'],
    reason: '错误的u/dv选择会导致积分越来越复杂',
  },
  'integration_substitution': {
    preferred: ['凑微分法（第一换元）', '三角换元', '倒代换'],
    avoid: ['直接进行过于复杂的代数展开'],
    reason: '合适的换元能极大简化积分表达式',
  },
  'lagrange_multiplier': {
    preferred: ['对称性利用', '消元简化方程组'],
    avoid: ['盲目展开所有偏导方程'],
    reason: '利用对称性可大幅减少方程组的求解复杂度',
  },
  'series_convergence': {
    preferred: ['比值判别法', '根值判别法（柯西）', '比较判别法'],
    avoid: ['仅凭直觉判断收敛性'],
    reason: '必须使用严格的判别法，直觉常出错',
  },
};

@Injectable()
export class ErrorDiagnosisService {
  private readonly logger = new Logger(ErrorDiagnosisService.name);

  diagnoseFull(
    problem: string,
    solutionSteps: string[],
  ): FullDiagnosisReport {
    this.logger.log(`开始四层错误诊断: 问题="${problem.substring(0, 50)}..." 步骤数=${solutionSteps.length}`);

    const steps: StepDiagnosisResult[] = [];
    let totalScore = 0;

    for (let i = 0; i < solutionSteps.length; i++) {
      const stepResult = this.diagnoseStep(solutionSteps, i, problem);
      steps.push(stepResult);
      totalScore += stepResult.score;
    }

    const avgScore = solutionSteps.length > 0 ? totalScore / solutionSteps.length : 0;
    const globalIssues = this.diagnoseGlobal(solutionSteps, problem);

    const allIssues = steps.flatMap(s => s.issues);
    const criticalCount = allIssues.filter(i => i.severity === ErrorSeverity.CRITICAL).length;
    const majorCount = allIssues.filter(i => i.severity === ErrorSeverity.MAJOR).length;

    let summary: string;
    if (criticalCount > 0) {
      summary = `发现${criticalCount}个关键错误和${majorCount}个重要问题，解题过程存在严重缺陷，需要从根本上修正`;
    } else if (majorCount > 2) {
      summary = `发现${majorCount}个重要问题和${allIssues.length - majorCount - criticalCount}个警告，建议仔细复查`;
    } else if (allIssues.length > 0) {
      summary = `整体解题质量良好，发现${allIssues.length}个建议性提示`;
    } else {
      summary = '未发现明显问题，解题过程质量良好';
    }

    const suggestions: string[] = [
      ...new Set(allIssues.map(i => i.suggestion)),
    ];

    if (globalIssues.length > 0) {
      suggestions.unshift(...globalIssues.map(i => i.suggestion));
    }

    return {
      problem,
      steps,
      globalIssues,
      totalScore: Math.round(avgScore * 100),
      summary,
      suggestions: suggestions.slice(0, 8),
    };
  }

  diagnoseStep(
    allSteps: string[],
    stepIndex: number,
    problem: string,
  ): StepDiagnosisResult {
    const step = allSteps[stepIndex];
    const issues: DiagnosisIssue[] = [];

    let parsedContent = step;
    let parseFailed = false;
    try {
      const parsed = JSON.parse(step);
      const contentParts = [
        parsed.stepTitle,
        parsed.keyPoint,
        parsed.formula,
        parsed.process,
        parsed.result,
        parsed.cot_reasoning,
        parsed.self_check,
      ].filter(Boolean);
      if (contentParts.length === 0) {
        parseFailed = true;
      } else {
        parsedContent = contentParts.join(' ');
      }
    } catch (e) {
      parseFailed = true;
    }

    if (parseFailed) {
      issues.push({
        layer: ErrorLayer.SYNTAX,
        severity: ErrorSeverity.CRITICAL,
        message: `第${stepIndex + 1}步解析失败，无法验证步骤内容`,
        location: `第${stepIndex + 1}步`,
        suggestion: '步骤数据格式异常，请检查解题引擎输出。可能是模型API未配置导致返回了空壳数据。',
        confidence: 0.95,
      });
    }

    // L1: 语法错误诊断
    for (const rule of MATH_SYNTAX_RULES) {
      const matched = rule.checkFn
        ? rule.checkFn(parsedContent)
        : (rule.pattern.lastIndex = 0, rule.pattern.test(parsedContent));
      if (matched) {
        issues.push({
          layer: ErrorLayer.SYNTAX,
          severity: rule.severity,
          message: rule.message,
          location: `第${stepIndex + 1}步`,
          suggestion: rule.suggestion,
          confidence: 0.8,
        });
      }
    }

    // L2: 计算错误诊断
    for (const checker of CALCULATION_CHECK_PATTERNS) {
      const issue = checker.check(parsedContent, allSteps);
      if (issue) {
        issue.location = `第${stepIndex + 1}步`;
        issues.push(issue);
      }
    }

    // L3: 逻辑错误诊断
    for (const checker of LOGIC_CHECK_PATTERNS) {
      const issue = checker.check(allSteps, stepIndex);
      if (issue) {
        issue.location = `第${stepIndex + 1}步`;
        issues.push(issue);
      }
    }

    // L4: 方法错误诊断
    const methodIssues = this.checkMethodOptimality(parsedContent, stepIndex, problem);
    methodIssues.forEach(issue => {
      issue.location = `第${stepIndex + 1}步`;
    });
    issues.push(...methodIssues);

    const criticalCount = issues.filter(i => i.severity === ErrorSeverity.CRITICAL).length;
    const majorCount = issues.filter(i => i.severity === ErrorSeverity.MAJOR).length;

    let overallHealth: 'healthy' | 'warning' | 'critical';
    if (criticalCount > 0) {
      overallHealth = 'critical';
    } else if (majorCount > 0) {
      overallHealth = 'warning';
    } else {
      overallHealth = 'healthy';
    }

    const score = Math.max(0, 100 - criticalCount * 25 - majorCount * 10 - issues.filter(
      i => i.severity === ErrorSeverity.MINOR || i.severity === ErrorSeverity.WARNING,
    ).length * 3);

    return {
      stepIndex,
      stepContent: step.substring(0, 200),
      issues,
      overallHealth,
      score,
    };
  }

  private diagnoseGlobal(steps: string[], problem: string): DiagnosisIssue[] {
    const issues: DiagnosisIssue[] = [];

    // 全局检查：是否有最终答案
    const lastStep = steps[steps.length - 1] || '';
    const hasAnswer = /答案|answer|答|结果|=\s*\d|结论/.test(lastStep);
    if (!hasAnswer && steps.length > 0) {
      issues.push({
        layer: ErrorLayer.LOGIC,
        severity: ErrorSeverity.MAJOR,
        message: '解题过程未包含明确的最终答案或结论',
        suggestion: '在所有步骤完成后，必须输出明确的最终答案或总结性结论',
        confidence: 0.9,
      });
    }

    // 全局检查：方法多样性
    const methods = new Set<string>();
    const methodKeywords: Record<string, string[]> = {
      '极限': ['代入法', '洛必达', '等价无穷小', '泰勒展开', '重要极限', '夹逼准则'],
      '导数': ['链式法则', '隐函数求导', '对数求导', '参数求导'],
      '积分': ['换元法', '分部积分', '部分分式', '三角代换', '倒代换'],
      '方程': ['特征方程', '待定系数', '常数变易', '拉普拉斯变换'],
    };

    for (const step of steps) {
      for (const [, kws] of Object.entries(methodKeywords)) {
        for (const kw of kws) {
          if (step.includes(kw)) {
            methods.add(kw);
          }
        }
      }
    }

    if (methods.size === 0 && steps.length > 2) {
      issues.push({
        layer: ErrorLayer.METHOD,
        severity: ErrorSeverity.WARNING,
        message: '解题过程未明确提及所使用的数学方法',
        suggestion: '在每个关键步骤开头标注使用的数学方法（如洛必达法则、换元法等）',
        confidence: 0.6,
      });
    }

    // 全局检查：验证步骤
    const hasVerification = steps.some(s =>
      /验证|检验|check|代入.*验证|求导.*验证/.test(s),
    );
    if (!hasVerification && steps.length >= 3) {
      issues.push({
        layer: ErrorLayer.METHOD,
        severity: ErrorSeverity.MINOR,
        message: '解题过程缺少结果验证步骤',
        suggestion: '建议添加验证步骤（如对积分结果求导验证、代入原式验证等）',
        confidence: 0.5,
      });
    }

    return issues;
  }

  private checkMethodOptimality(
    stepContent: string,
    stepIndex: number,
    problem: string,
  ): DiagnosisIssue[] {
    const issues: DiagnosisIssue[] = [];

    // 检测洛必达法则的滥用（适用于简单有理函数极限）
    if (/洛必达|lhopital|L['']Hôpital/i.test(stepContent)) {
      if (/\\frac\{[a-zA-Z0-9]+\}\{[a-zA-Z0-9]+\}/.test(stepContent) && !/0\/0|∞\/∞/.test(stepContent)) {
        issues.push({
          layer: ErrorLayer.METHOD,
          severity: ErrorSeverity.MINOR,
          message: '简单有理函数极限可优先使用代数方法（抓大头/因式分解），洛必达可能不必要的复杂化',
          suggestion: '对于有理函数极限，优先检查是否可以通过代数化简直接得到结果',
          confidence: 0.5,
        });
      }
    }

    // 检测分部积分法选择
    if (/分部积分|integration\s+by\s+parts|\\int.*dv/.test(stepContent)) {
      if (!/LIATE|选择.*u|设.*u\s*=/i.test(stepContent)) {
        issues.push({
          layer: ErrorLayer.METHOD,
          severity: ErrorSeverity.WARNING,
          message: '分部积分法未明确说明u和dv的选择依据',
          suggestion: '使用LIATE法则选择u：对数函数(Logarithmic)>反三角函数(Inverse Trig)>代数函数(Algebraic)>三角函数(Trigonometric)>指数函数(Exponential)',
          confidence: 0.6,
        });
      }
    }

    // 检测积分换元法
    if (/换元|substitut|令\s*[a-zA-Z]\s*=/.test(stepContent) && /\\int/.test(stepContent)) {
      if (!/dx\s*=|dt\s*=|微分/.test(stepContent)) {
        issues.push({
          layer: ErrorLayer.METHOD,
          severity: ErrorSeverity.WARNING,
          message: '换元积分后需写出dx与dt的转换关系',
          suggestion: '换元后必须计算微分关系：如x=φ(t)，则dx=φ\'(t)dt',
          confidence: 0.75,
        });
      }
    }

    // 方法选择评分
    this.evaluateMethodScore(stepContent, issues, problem);

    return issues;
  }

  private evaluateMethodScore(
    stepContent: string,
    issues: DiagnosisIssue[],
    problem: string,
  ): void {
    for (const [key, meta] of Object.entries(METHOD_OPTIMALITY_MAP)) {
      const categoryWords = key.split('_')[0];
      if (problem.includes(categoryWords) || stepContent.includes(categoryWords)) {
        const preferredUsed = meta.preferred.some(m => stepContent.includes(m));
        const avoidedUsed = meta.avoid.some(m => stepContent.includes(m));

        if (avoidedUsed && !preferredUsed) {
          issues.push({
            layer: ErrorLayer.METHOD,
            severity: ErrorSeverity.WARNING,
            message: meta.reason,
            suggestion: `推荐方法: ${meta.preferred.join('、')}`,
            confidence: 0.65,
          });
        }
      }
    }
  }

  quickDiagnose(step: string): {
    hasSyntaxError: boolean;
    hasCalculationWarning: boolean;
    hasLogicIssue: boolean;
  } {
    return {
      hasSyntaxError: MATH_SYNTAX_RULES.some(r => r.pattern.test(step)),
      hasCalculationWarning: CALCULATION_CHECK_PATTERNS.some(c => {
        const result = c.check(step);
        return result !== null && result.severity !== ErrorSeverity.MINOR;
      }),
      hasLogicIssue: LOGIC_CHECK_PATTERNS.some(c => {
        const result = c.check([step], 0);
        return result !== null;
      }),
    };
  }

  generateScoreCard(report: FullDiagnosisReport): {
    syntaxScore: number;
    calculationScore: number;
    logicScore: number;
    methodScore: number;
    overallScore: number;
    grade: string;
  } {
    const grouped = {
      [ErrorLayer.SYNTAX]: [] as DiagnosisIssue[],
      [ErrorLayer.CALCULATION]: [] as DiagnosisIssue[],
      [ErrorLayer.LOGIC]: [] as DiagnosisIssue[],
      [ErrorLayer.METHOD]: [] as DiagnosisIssue[],
    };

    for (const step of report.steps) {
      for (const issue of step.issues) {
        grouped[issue.layer].push(issue);
      }
    }

    const calcLayerScore = (issues: DiagnosisIssue[]): number => {
      let score = 100;
      for (const issue of issues) {
        if (issue.severity === ErrorSeverity.CRITICAL) score -= 25;
        else if (issue.severity === ErrorSeverity.MAJOR) score -= 15;
        else if (issue.severity === ErrorSeverity.MINOR) score -= 5;
        else score -= 3;
      }
      return Math.max(0, score);
    };

    const syntaxScore = calcLayerScore(grouped[ErrorLayer.SYNTAX]);
    const calculationScore = calcLayerScore(grouped[ErrorLayer.CALCULATION]);
    const logicScore = calcLayerScore(grouped[ErrorLayer.LOGIC]);
    const methodScore = calcLayerScore(grouped[ErrorLayer.METHOD]);
    const overallScore = Math.round(
      syntaxScore * 0.15 + calculationScore * 0.35 + logicScore * 0.3 + methodScore * 0.2,
    );

    let grade: string;
    if (overallScore >= 90) grade = 'A (优秀)';
    else if (overallScore >= 80) grade = 'B (良好)';
    else if (overallScore >= 70) grade = 'C (中等)';
    else if (overallScore >= 60) grade = 'D (及格)';
    else grade = 'F (不及格)';

    return { syntaxScore, calculationScore, logicScore, methodScore, overallScore, grade };
  }
}
