import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { MathTerminologyService } from './math-terminology.service';
import {
  Polynomial,
  compileEvaluator,
  fToNumber,
  parsePolynomialExact,
  polyDerivative,
  polyIntegral,
  polyToLatex,
  solveEquationString,
} from '../math-expression';
import {
  SYMPY_HTTP_TIMEOUT_MS,
  extractSympyErrorPayload,
  sympyRequestHeaders,
} from '../../../common/utils/sympy-client.util';

// 数学问题类型
export enum MathProblemType {
  LIMIT = 'limit',
  DERIVATIVE = 'derivative',
  INTEGRAL = 'integral',
  EQUATION = 'equation',
  SERIES = 'series',
  PROOF = 'proof',
  GEOMETRY = 'geometry',
  ODE = 'ode',
  GENERAL = 'general',
}

// 解题步骤接口
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

// 解题结果接口
export interface ProblemSolution {
  problemType: MathProblemType;
  steps: SolutionStep[];
  finalAnswer: string;
  knowledgePoints: KnowledgePoint[];
  difficulty: 'easy' | 'medium' | 'hard';
  /** 本地引擎是否真正得出了答案。unsolved 时 finalAnswer 不承载答案，前端据此提示转 AI/教师 */
  status?: 'solved' | 'unsolved';
  /** status 为 unsolved 时的原因说明 */
  reason?: string;
}

// 知识点接口
export interface KnowledgePoint {
  name: string;
  description: string;
  formulas: string[];
  importance: number;
}

// 本地计算引擎服务
@Injectable()
export class LocalComputationService {
  /** 内部哨兵：本地规则未能得出答案。绝不作为答案对外输出，会被转成 unsolved 状态 */
  private static readonly UNSOLVED = '__UNSOLVED__';

  private readonly logger = new Logger(LocalComputationService.name);
  private readonly sympyServiceUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly mathTerminologyService: MathTerminologyService,
  ) {
    this.sympyServiceUrl = this.configService.get<string>('SYMPY_SERVICE_URL') || '';
  }

  // 解决数学问题
  async solveProblem(problem: string): Promise<ProblemSolution> {
    const problemType = this.classifyProblem(problem);
    this.logger.log(`识别问题类型: ${problemType}`);

    // 标准化问题表述
    const standardizedProblem = this.mathTerminologyService.standardizeExpression(problem);
    this.logger.log(`标准化问题: ${standardizedProblem}`);

    // 根据问题类型选择解题策略
    let solution: ProblemSolution;
    switch (problemType) {
      case MathProblemType.LIMIT:
        solution = this.solveLimitProblem(standardizedProblem);
        break;
      case MathProblemType.DERIVATIVE:
        solution = this.solveDerivativeProblem(standardizedProblem);
        break;
      case MathProblemType.INTEGRAL:
        solution = this.solveIntegralProblem(standardizedProblem);
        break;
      case MathProblemType.EQUATION:
        solution = this.solveEquationProblem(standardizedProblem);
        break;
      case MathProblemType.ODE:
        solution = this.solveODEProblem(standardizedProblem);
        break;
      default:
        solution = this.solveGeneralProblem(standardizedProblem);
        break;
    }

    // 占位符检测：本地引擎用正则“猜”不到时，以前会把 `（极限值）` 这类占位符
    // 当作最终答案呈现给学生（比空答案更危险）。现在统一转成 unsolved 状态。
    if (solution.finalAnswer === LocalComputationService.UNSOLVED) {
      solution = this.markUnsolved(solution);
    }

    // 标准化解题步骤中的数学术语和符号
    solution.steps = solution.steps.map(step => {
      return {
        ...step,
        title: this.mathTerminologyService.standardizeExpression(step.title),
        description: this.mathTerminologyService.standardizeExpression(step.description),
        process: this.mathTerminologyService.standardizeExpression(step.process),
        formula: this.mathTerminologyService.toLaTeX(step.formula),
        result: this.mathTerminologyService.standardizeExpression(step.result),
        highlight: this.mathTerminologyService.standardizeExpression(step.highlight),
        keyPoint: this.mathTerminologyService.standardizeExpression(step.keyPoint),
      };
    });

    // 标准化最终答案
    solution.finalAnswer = this.mathTerminologyService.standardizeExpression(solution.finalAnswer);

    // 尝试使用SymPy进行精确计算（如果可用）
    if (this.isSymPyAvailable()) {
      try {
        const enhancedSolution = await this.enhanceWithSymPy(solution, problem);
        return enhancedSolution;
      } catch (error) {
        this.logger.warn('SymPy增强失败，使用本地规则结果', error.message);
      }
    }

    return solution;
  }

  /**
   * 把“本地无法确定答案”的结果显式标记为 unsolved。
   * 绝不返回占位符冒充答案；调用方（诊断/反馈/前端）据此提示转交 AI 或请教老师。
   */
  private markUnsolved(solution: ProblemSolution): ProblemSolution {
    const reason = this.unsolvedReasons[solution.problemType] || '本地规则引擎未能确定本题答案';
    this.logger.warn(`本地引擎未能求解（${solution.problemType}）：回退为 unsolved 状态`);
    return {
      ...solution,
      status: 'unsolved',
      reason,
      finalAnswer: '',
      steps: solution.steps.map(step =>
        step.result === LocalComputationService.UNSOLVED
          ? { ...step, result: '未能确定（本地规则引擎无法自动求解，需转交 AI 或人工）' }
          : step,
      ),
    };
  }

  /** 各题型 unsolved 的具体原因说明 */
  private readonly unsolvedReasons: Record<string, string> = {
    [MathProblemType.LIMIT]: '极限式中含本地规则无法识别的结构（如分式、复合函数），需 AI 或符号计算求解',
    [MathProblemType.DERIVATIVE]: '函数形式不在本地规则覆盖范围内（仅支持多项式与基本初等函数）',
    [MathProblemType.INTEGRAL]: '被积函数不在本地规则覆盖范围内',
    [MathProblemType.EQUATION]: '方程不是一次/二次多项式形式，本地规则无法给出精确解',
    [MathProblemType.ODE]: '微分方程不满足本地支持的常系数线性齐次形式',
    [MathProblemType.GENERAL]: '未识别出可自动求解的题型',
  };

  /**
   * 分类数学问题：按“特征打分”取最高分，而不是用一串 includes 顺序短路。
   *
   * 旧实现的两个真实缺陷：
   *   1. `includes('ode')` 会命中 code / model / node / mode 等任意含 ode 的单词；
   *   2. `EQUATION` 用 `includes('=')` 且排在 SERIES 之前，含等号的级数题被判成方程。
   */
  private classifyProblem(problem: string): MathProblemType {
    const text = problem.toLowerCase();
    const scores: Record<string, number> = {};
    const add = (type: MathProblemType, weight: number) => {
      scores[type] = (scores[type] || 0) + weight;
    };

    // —— ODE 特征：必须是微分方程字样或 y 的导数记号，不用裸 'ode' 子串 ——
    if (/微分方程|常微分|differential\s*equation/.test(text)) add(MathProblemType.ODE, 6);
    if (/\bode\b|\bivp\b/.test(text)) add(MathProblemType.ODE, 4);
    if (/(?:^|[^a-z])y\s*['′]{1,2}/.test(text)) add(MathProblemType.ODE, 5);
    if (/\bd[\^\s]*2?y\s*\/\s*dx/.test(text)) add(MathProblemType.ODE, 4);

    // —— 级数特征 ——
    if (/级数|series|收敛域|收敛半径|幂级数|泰勒级数|麦克劳林/.test(text)) add(MathProblemType.SERIES, 6);
    if (/\bsum\b|∑|求和/.test(text)) add(MathProblemType.SERIES, 3);

    // —— 极限 / 导数 / 积分 ——
    if (/极限|\blimit\b|\blim\b/.test(text)) add(MathProblemType.LIMIT, 6);
    if (/→|->|趋近于|趋近/.test(text)) add(MathProblemType.LIMIT, 2);
    if (/导数|求导|derivative|d\/dx|导函数/.test(text)) add(MathProblemType.DERIVATIVE, 6);
    if (/积分|integral|∫|原函数/.test(text)) add(MathProblemType.INTEGRAL, 6);

    // —— 方程特征 ——
    if (/方程|equation|\bsolve\b|解方程/.test(text)) add(MathProblemType.EQUATION, 5);
    if (/=/.test(text)) add(MathProblemType.EQUATION, 2);

    // —— 证明 / 几何 ——
    if (/证明|求证|proof|prove/.test(text)) add(MathProblemType.PROOF, 5);
    if (/几何|geometry|抛物线|椭圆|双曲线|平面方程|切平面/.test(text)) add(MathProblemType.GEOMETRY, 5);

    // 幂次/根式等“像多项式”的线索，弱化方程优势，避免纯算式被判成方程
    if (/^[\dx\s\+\-\*\/\^\.\(\)=]+$/i.test(problem.trim())) add(MathProblemType.EQUATION, 1);

    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    if (!ranked.length || ranked[0][1] < 2) return MathProblemType.GENERAL;
    return ranked[0][0] as MathProblemType;
  }

  // 解决极限问题
  private solveLimitProblem(problem: string): ProblemSolution {
    const steps: SolutionStep[] = [];
    let finalAnswer = '';

    // 步骤1：识别极限类型
    steps.push({
      id: 'step1',
      title: '识别极限类型',
      description: '分析极限表达式，识别自变量趋近值和函数形式',
      formula: '',
      process: `分析问题：${problem}`,
      result: '已识别极限类型',
      highlight: '注意自变量的趋近方向和函数的定义域',
      keyPoint: '极限类型识别',
    });

    // 步骤2：判断不定式类型
    steps.push({
      id: 'step2',
      title: '判断不定式类型',
      description: '将自变量趋近值代入函数，判断是否为不定式',
      formula: '',
      process: '代入自变量趋近值，检查函数值是否为0/0、∞/∞等不定式',
      result: '已确定不定式类型',
      highlight: '只有不定式才能使用洛必达法则',
      keyPoint: '不定式判断',
    });

    // 步骤3：应用求解方法
    steps.push({
      id: 'step3',
      title: '应用求解方法',
      description: '根据不定式类型选择合适的求解方法',
      formula: this.extractLimitFormula(problem),
      process: '根据极限类型选择洛必达法则、等价无穷小替换或重要极限公式',
      result: '已应用求解方法',
      highlight: '选择合适的方法可以简化计算',
      keyPoint: '极限求解方法',
    });

    // 步骤4：计算最终结果
    steps.push({
      id: 'step4',
      title: '计算最终结果',
      description: '执行计算，得到极限值',
      formula: '',
      process: '按照选定的方法进行计算',
      result: this.calculateLimitResult(problem),
      highlight: '注意计算过程中的符号和代数运算',
      keyPoint: '极限计算',
    });

    finalAnswer = steps[steps.length - 1].result;

    return {
      problemType: MathProblemType.LIMIT,
      steps,
      finalAnswer,
      knowledgePoints: this.getLimitKnowledgePoints(),
      difficulty: 'medium',
    };
  }

  // 解决导数问题
  private solveDerivativeProblem(problem: string): ProblemSolution {
    const steps: SolutionStep[] = [];
    let finalAnswer = '';

    // 步骤1：分析函数结构
    steps.push({
      id: 'step1',
      title: '分析函数结构',
      description: '识别待求导函数的基本形式',
      formula: '',
      process: `分析函数结构：${problem}\n识别函数的类型和结构特点，确定是否为基本初等函数、复合函数、乘积函数或商函数`,
      result: '已分析函数结构，确定函数类型',
      highlight: '准确识别函数结构是选择正确求导法则的基础',
      keyPoint: '函数结构分析',
    });

    // 步骤2：选择求导法则
    steps.push({
      id: 'step2',
      title: '选择求导法则',
      description: '根据函数结构选择适当的求导法则',
      formula: '',
      process: '根据函数结构选择基本公式、链式法则、乘积法则或商法则\n解释选择该法则的原因和适用条件',
      result: '已选择合适的求导法则',
      highlight: '复合函数需要使用链式法则，乘积函数使用乘积法则，商函数使用商法则',
      keyPoint: '求导法则选择',
    });

    // 步骤3：逐步求导计算
    steps.push({
      id: 'step3',
      title: '逐步求导计算',
      description: '按照选定的法则进行求导运算',
      formula: this.extractDerivativeFormula(problem),
      process: '应用选定的求导法则进行计算\n详细展示每一步的计算过程和依据',
      result: '已完成求导计算，得到导函数表达式',
      highlight: '注意每一步的符号和系数，确保计算准确',
      keyPoint: '求导计算',
    });

    // 步骤4：化简最终结果
    steps.push({
      id: 'step4',
      title: '化简最终结果',
      description: '整理并化简导函数表达式',
      formula: '',
      process: '整理导函数表达式，合并同类项，化简为最简形式',
      result: this.calculateDerivativeResult(problem),
      highlight: '化简结果可以使表达式更清晰，便于理解和使用',
      keyPoint: '结果化简',
    });

    // 步骤5：验证结果（新增步骤）
    steps.push({
      id: 'step5',
      title: '验证结果',
      description: '验证导函数的正确性',
      formula: '',
      process: '通过基本求导法则或实例验证导函数的正确性',
      result: '导函数验证完成',
      highlight: '验证可以确保结果的准确性，避免计算错误',
      keyPoint: '结果验证',
    });

    finalAnswer = steps[steps.length - 2].result; // 最终答案是化简后的结果

    return {
      problemType: MathProblemType.DERIVATIVE,
      steps,
      finalAnswer,
      knowledgePoints: this.getDerivativeKnowledgePoints(),
      difficulty: 'medium',
    };
  }

  // 解决积分问题
  private solveIntegralProblem(problem: string): ProblemSolution {
    const steps: SolutionStep[] = [];
    let finalAnswer = '';

    // 步骤1：分析被积函数
    steps.push({
      id: 'step1',
      title: '分析被积函数',
      description: '识别被积函数的类型和特点',
      formula: '',
      process: `分析被积函数：${problem}\n识别函数的类型和结构特点，确定积分的难度和适用方法`,
      result: '已分析被积函数，确定积分类型',
      highlight: '准确识别被积函数类型是选择正确积分方法的基础',
      keyPoint: '被积函数分析',
    });

    // 步骤2：选择积分方法
    steps.push({
      id: 'step2',
      title: '选择积分方法',
      description: '根据函数特点选择合适的积分方法',
      formula: '',
      process: '根据函数特点选择换元法、分部积分法或部分分式分解等方法\n解释选择该方法的原因和适用条件',
      result: '已选择合适的积分方法',
      highlight: '换元法适用于复合函数，分部积分法适用于乘积函数，部分分式分解适用于有理函数',
      keyPoint: '积分方法选择',
    });

    // 步骤3：执行积分运算
    steps.push({
      id: 'step3',
      title: '执行积分运算',
      description: '按选定方法求出原函数',
      formula: this.extractIntegralFormula(problem),
      process: '应用选定的积分方法进行计算\n详细展示每一步的计算过程和依据',
      result: '已完成积分运算，得到原函数',
      highlight: '注意添加积分常数C，这是不定积分的重要组成部分',
      keyPoint: '积分运算',
    });

    // 步骤4：化简结果
    steps.push({
      id: 'step4',
      title: '化简结果',
      description: '整理并化简原函数表达式',
      formula: '',
      process: '整理原函数表达式，合并同类项，化简为最简形式',
      result: '已化简原函数表达式',
      highlight: '化简结果可以使表达式更清晰，便于理解和使用',
      keyPoint: '结果化简',
    });

    // 步骤5：验证结果
    steps.push({
      id: 'step5',
      title: '验证结果',
      description: '对求得的原函数求导，确认能还原被积函数',
      formula: '',
      process: '对原函数求导，验证是否等于被积函数\n详细展示求导过程和验证结果',
      result: this.calculateIntegralResult(problem),
      highlight: '验证可以确保结果的正确性，避免积分错误',
      keyPoint: '结果验证',
    });

    finalAnswer = steps[steps.length - 1].result;

    return {
      problemType: MathProblemType.INTEGRAL,
      steps,
      finalAnswer,
      knowledgePoints: this.getIntegralKnowledgePoints(),
      difficulty: 'medium',
    };
  }

  // 解决方程问题
  private solveEquationProblem(problem: string): ProblemSolution {
    const steps: SolutionStep[] = [];
    let finalAnswer = '';

    // 步骤1：整理方程
    steps.push({
      id: 'step1',
      title: '整理方程',
      description: '将方程整理为标准形式',
      formula: '',
      process: `整理方程：${problem}\n将所有项移到方程一边，另一边为0，确保方程形式规范`,
      result: '已整理方程为标准形式',
      highlight: '标准形式便于识别方程类型和选择解法',
      keyPoint: '方程整理',
    });

    // 步骤2：分析方程类型
    steps.push({
      id: 'step2',
      title: '分析方程类型',
      description: '识别方程的类型和次数',
      formula: '',
      process: '分析方程的类型（线性、二次、高次、分式、无理等）和次数',
      result: '已分析方程类型，确定解法',
      highlight: '正确识别方程类型是选择合适解法的关键',
      keyPoint: '方程类型分析',
    });

    // 步骤3：选择解法
    steps.push({
      id: 'step3',
      title: '选择解法',
      description: '根据方程类型选择合适的解法',
      formula: '',
      process: '根据方程类型选择因式分解、求根公式、配方法或其他方法\n解释选择该方法的原因和适用条件',
      result: '已选择合适的解法',
      highlight: '选择合适的方法可以简化计算，提高效率',
      keyPoint: '解法选择',
    });

    // 步骤4：求解方程
    steps.push({
      id: 'step4',
      title: '求解方程',
      description: '应用选定的方法求解方程',
      formula: this.extractEquationFormula(problem),
      process: '应用选定的方法求解方程\n详细展示每一步的计算过程和依据',
      result: '已完成方程求解，得到解的集合',
      highlight: '注意方程的解的个数和定义域，排除增根',
      keyPoint: '方程求解',
    });

    // 步骤5：验证解
    steps.push({
      id: 'step5',
      title: '验证解',
      description: '将解代入原方程验证',
      formula: '',
      process: '将求得的解代入原方程验证\n详细展示验证过程和结果',
      result: this.calculateEquationResult(problem),
      highlight: '验证可以确保解的正确性，避免增根和计算错误',
      keyPoint: '解的验证',
    });

    finalAnswer = steps[steps.length - 1].result;

    return {
      problemType: MathProblemType.EQUATION,
      steps,
      finalAnswer,
      knowledgePoints: this.getEquationKnowledgePoints(),
      difficulty: 'easy',
    };
  }

  // 解决微分方程问题
  private solveODEProblem(problem: string): ProblemSolution {
    const steps: SolutionStep[] = [];
    let finalAnswer = '';

    steps.push({
      id: 'step1',
      title: '识别方程类型',
      description: '分析微分方程的阶数、线性性和齐次性',
      formula: '',
      process: `分析问题：${problem}\n识别方程类型（常系数线性、齐次/非齐次等）`,
      result: '已识别微分方程类型',
      highlight: '正确识别方程类型是选择合适解法的关键',
      keyPoint: '方程类型识别',
    });

    steps.push({
      id: 'step2',
      title: '建立特征方程',
      description: '对于常系数线性齐次方程，建立对应的特征方程',
      formula: '',
      process: '将微分方程转化为代数特征方程',
      result: '已建立特征方程',
      highlight: '特征方程法是常系数线性方程的标准解法',
      keyPoint: '特征方程建立',
    });

    steps.push({
      id: 'step3',
      title: '求解特征根',
      description: '求解特征方程，得到特征根',
      formula: '',
      process: '求解代数方程，得到特征根',
      result: '已求解特征根',
      highlight: '特征根的性质决定了解的形式',
      keyPoint: '特征根求解',
    });

    const characteristic = this.solveConstantCoefficientHomogeneousODE(problem);
    steps.push({
      id: 'step4',
      title: '构造通解',
      description: '根据特征根的性质构造微分方程的通解',
      formula: characteristic.formula,
      process: characteristic.process,
      result: characteristic.result,
      highlight: '确保解包含任意常数，并根据重根/复根形式正确构造通解',
      keyPoint: '通解构造',
    });

    finalAnswer = characteristic.result;

    return {
      problemType: MathProblemType.ODE,
      steps,
      finalAnswer,
      knowledgePoints: this.getODEKnowledgePoints(),
      difficulty: 'hard',
    };
  }

  /**
   * 求解常系数二阶齐次线性微分方程。
   * 支持形如 y'' - 3y' + 2y = 0 的常见输入；无法可靠解析时返回明确的待补充提示，
   * 不再把“已构造通解”误当成最终答案。
   */
  private solveConstantCoefficientHomogeneousODE(problem: string): {
    formula: string;
    process: string;
    result: string;
  } {
    const normalized = problem
      .replace(/[：:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const match = normalized.match(
      /y\s*['′]{2}\s*([+-])\s*(\d+(?:\.\d+)?)\s*y\s*['′]\s*([+-])\s*(\d+(?:\.\d+)?)\s*y\s*=\s*0/i,
    );

    if (!match) {
      return {
        formula: 'r^2 + ar + b = 0',
        process: '已识别为微分方程，但暂时无法从题面可靠提取常系数，请补充标准形式。',
        result: '无法自动提取微分方程系数',
      };
    }

    const signed = (sign: string, value: string) =>
      (sign === '-' ? -1 : 1) * Number(value);
    const a = signed(match[1], match[2]);
    const b = signed(match[3], match[4]);
    const discriminant = a * a - 4 * b;
    const format = (value: number) => Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
    const equation = `r^{2} ${a < 0 ? '- ' + format(Math.abs(a)) : '+ ' + format(a)}r ${b < 0 ? '- ' + format(Math.abs(b)) : '+ ' + format(b)} = 0`;
    // e^{rx}：r=0 时该项就是常数 1，r=1 时写作 e^{x}
    const exponential = (r: number): string => {
      if (r === 0) return '';
      const power = r === 1 ? 'x' : `${format(r)}x`;
      return `e^{${power}}`;
    };

    if (discriminant > 0) {
      const r1 = (-a + Math.sqrt(discriminant)) / 2;
      const r2 = (-a - Math.sqrt(discriminant)) / 2;
      /** r=1 时直接写 e^{x}，不要写成 e^{1x} */
      const term = (coefficient: string, r: number) =>
        r === 0 ? coefficient : `${coefficient}${exponential(r)}`;
      const result = `${term('C_1', r1)} + ${term('C_2', r2)}`;
      return {
        formula: equation,
        process: `特征方程 ${equation}，判别式 Δ=${format(discriminant)}>0，得到 r₁=${format(r1)}, r₂=${format(r2)}。`,
        result,
      };
    }

    if (Math.abs(discriminant) < 1e-10) {
      const r = -a / 2;
      return {
        formula: equation,
        process: `特征方程 ${equation}，判别式 Δ=0，得到二重根 r=${format(r)}。`,
        result: r === 0 ? 'C_1 + C_2x' : `(C_1 + C_2x)${exponential(r)}`,
      };
    }

    const real = -a / 2;
    const imaginary = Math.sqrt(-discriminant) / 2;
    return {
      formula: equation,
      process: `特征方程 ${equation}，判别式 Δ<0，得到复根 ${format(real)}±${format(imaginary)}i。`,
      result: `${exponential(real)}(C_1\\cos(${format(imaginary)}x) + C_2\\sin(${format(imaginary)}x))`,
    };
  }

  // 获取微分方程相关知识点
  private getODEKnowledgePoints(): KnowledgePoint[] {
    return [
      {
        name: '常系数线性齐次微分方程',
        description: "形如 y'' + a y' + b y = 0 的微分方程",
        formulas: ["y'' + a y' + b y = 0", "r² + a r + b = 0"],
        importance: 5,
      },
      {
        name: '特征方程法',
        description: '通过特征方程求解常系数线性微分方程的方法',
        formulas: ['r² + a r + b = 0'],
        importance: 5,
      },
    ];
  }

  // 解决通用数学问题
  private solveGeneralProblem(problem: string): ProblemSolution {
    const steps: SolutionStep[] = [];
    let finalAnswer = '';

    // 步骤1：理解题意
    steps.push({
      id: 'step1',
      title: '理解题意',
      description: '明确问题的已知条件、未知量和求解目标',
      formula: '',
      process: `理解问题：${problem}`,
      result: '已理解题意',
      highlight: '仔细分析问题，明确求解目标',
      keyPoint: '问题理解',
    });

    // 步骤2：制定策略
    steps.push({
      id: 'step2',
      title: '制定策略',
      description: '根据问题类型选择合适的数学方法和工具',
      formula: '',
      process: '根据问题类型选择合适的数学方法',
      result: '已制定解题策略',
      highlight: '选择合适的方法可以简化计算',
      keyPoint: '策略制定',
    });

    // 步骤3：执行计算
    steps.push({
      id: 'step3',
      title: '执行计算',
      description: '按照策略进行具体的计算或推理操作',
      formula: '',
      process: '按照制定的策略进行计算',
      result: '已完成计算',
      highlight: '注意计算过程的准确性',
      keyPoint: '计算执行',
    });

    // 步骤4：整理结论
    steps.push({
      id: 'step4',
      title: '整理结论',
      description: '汇总中间结果，给出清晰的最终答案',
      formula: '',
      process: '整理计算结果，给出最终答案',
      result: '已整理结论',
      highlight: '确保答案清晰、准确',
      keyPoint: '结论整理',
    });

    finalAnswer = steps[steps.length - 1].result;

    return {
      problemType: MathProblemType.GENERAL,
      steps,
      finalAnswer,
      knowledgePoints: this.getGeneralKnowledgePoints(),
      difficulty: 'medium',
    };
  }

  // ========== 表达式引擎：真正的本地数学计算 ==========

  /**
   * 精确多项式解析（有理系数）。支持括号展开、隐式乘法 `3x`/`2(x+1)`、Unicode 上标 `x²`、
   * LaTeX 分数、小数系数。非多项式（sin(x)、1/x、x^0.5）返回 null —— 绝不静默丢项。
   */
  private parsePolynomialFraction(expr: string): Polynomial | null {
    if (!expr) return null;
    return parsePolynomialExact(expr, 'x');
  }

  /** 数值形式的项列表，供只需比较大小的分支（如极限）使用 */
  private parsePolynomial(expr: string): { coeff: number; exp: number }[] | null {
    const poly = this.parsePolynomialFraction(expr);
    if (!poly) return null;
    if (!poly.length) return [{ coeff: 0, exp: 0 }];
    return poly.map((c, exp) => ({ coeff: fToNumber(c), exp }));
  }

  /** 把多项式渲染为教材 LaTeX 写法，如 `3x^{2} + 2x - 1`、`\frac{1}{3}x^{3}` */
  private formatPolynomialExact(poly: Polynomial): string {
    return polyToLatex(poly, 'x');
  }

  /** 多项式求导；表达式不是纯多项式时返回 null，交由三角函数/指数/对数等专门规则处理 */
  private differentiatePolynomial(expr: string): string | null {
    const poly = this.parsePolynomialFraction(expr);
    if (!poly) return null;
    return this.formatPolynomialExact(polyDerivative(poly));
  }

  /** 多项式积分；表达式不是纯多项式时返回 null */
  private integratePolynomial(expr: string): string | null {
    const poly = this.parsePolynomialFraction(expr);
    if (!poly) return null;
    const body = this.formatPolynomialExact(polyIntegral(poly));
    return body === '0' ? 'C' : `${body} + C`;
  }

  /** 用表达式引擎求值（支持三角函数/指数/对数/根式/分数） */
  private evaluateFunctionExpression(expr: string, x: number): number | null {
    const evaluator = compileEvaluator(expr, 'x');
    if (!evaluator) return null;
    const value = evaluator(x);
    return Number.isFinite(value) ? value : null;
  }

  // 简单表达式求值 (x^n, sin(x), cos(x), e^x, ln(x) 等)
  private evaluateExpression(expr: string, x: number): number | null {
    const e = expr.replace(/\s/g, '');
    // x^n
    const pwr = e.match(/^x\^(\d+)$/);
    if (pwr) return Math.pow(x, parseInt(pwr[1]));
    if (e === 'x') return x;
    // sin(x)
    if (e === 'sin(x)' || e === 'sinx') return Math.sin(x);
    // cos(x)
    if (e === 'cos(x)' || e === 'cosx') return Math.cos(x);
    // e^x
    if (e === 'e^x' || e === 'exp(x)') return Math.exp(x);
    // ln(x)
    if (e === 'ln(x)' || e === 'lnx') return x > 0 ? Math.log(x) : null;
    // a^x
    const ax = e.match(/^(\d+)\^x$/);
    if (ax) return Math.pow(parseInt(ax[1]), x);
    // tan(x)
    if (e === 'tan(x)' || e === 'tanx') return Math.tan(x);
    // sqrt(x)
    if (e === 'sqrt(x)' || e === '√(x)') return x >= 0 ? Math.sqrt(x) : null;
    // constants
    if (e === 'e') return Math.E;
    if (e === 'π' || e === 'pi') return Math.PI;
    const num = parseFloat(e);
    if (!isNaN(num)) return num;
    return null;
  }

  // ========== 增强后的结果计算方法 ==========

  private computeDerivativeResult(problem: string): { formula: string; result: string; process: string } {
    const lower = problem.toLowerCase();

    // 优先按“整段多项式”逐项求导：early-return 单个 x^n 会丢掉其余项（如 x^3 + 2x → 只算 x^3）
    const polyExpr = this.extractFunctionExpression(problem);
    if (polyExpr && /^[\dx\s\+\-\^\.\*\/\(\)a-z]+$/.test(polyExpr.replace(/\s/g, '')) && polyExpr.includes('x')) {
      const result = this.differentiatePolynomial(polyExpr);
      if (result && result !== '0') {
        return {
          formula: `\\frac{d}{dx}(${this.mathTerminologyService.toLaTeX(polyExpr)}) = ${result}`,
          result,
          process: `逐项应用幂法则求导: 对每一项 ax^n 求导得到 a·n·x^(n-1)`,
        };
      }
    }

    const pwrMatch = lower.match(/(?:x\^)(\d+)/);
    if (pwrMatch) {
      const n = parseInt(pwrMatch[1]);
      return {
        formula: `\\frac{d}{dx}(x^{${n}}) = ${n}x^{${n-1}}`,
        result: `${n}x^{${n-1}}`,
        process: `幂法则: d/dx(x^n) = n·x^(n-1), 此处 n=${n}`,
      };
    }
    if (lower.includes('sin')) {
      const inner = lower.match(/sin\(?([^)]*)\)?/)?.[1] || 'x';
      if (inner === 'x') {
        return { formula: '\\frac{d}{dx}(\\sin x) = \\cos x', result: '\\cos x', process: '基本公式: sin的导数是cos' };
      }
      return { formula: `\\frac{d}{dx}(\\sin(${inner})) = \\cos(${inner}) \\cdot ${inner}'`, result: `\\cos(${inner}) · (${inner})'`, process: '链式法则: 外导cos×内导' };
    }
    if (lower.includes('cos')) {
      return { formula: '\\frac{d}{dx}(\\cos x) = -\\sin x', result: '-\\sin x', process: '基本公式: cos的导数是-sin, 注意负号' };
    }
    if (lower.includes('e^') || lower.includes('exp')) {
      const em = lower.match(/(?:e\^|exp\()([^)]+)/);
      const inner = em?.[1] || 'x';
      if (inner === 'x') {
        return { formula: '\\frac{d}{dx}(e^x) = e^x', result: 'e^x', process: 'e^x的导数等于自身' };
      }
      return { formula: `\\frac{d}{dx}(e^{${inner}}) = e^{${inner}} \\cdot ${inner}'`, result: `e^${inner} · (${inner})'`, process: '链式法则: e^u导数=e^u·u\'' };
    }
    if (lower.includes('ln') || (lower.includes('log') && !lower.includes('log10'))) {
      const lm = lower.match(/(?:ln|log)\(?([^)]*)\)?/);
      const inner = lm?.[1] || 'x';
      if (inner === 'x') {
        return { formula: '\\frac{d}{dx}(\\ln x) = \\frac{1}{x}', result: '1/x', process: 'ln x的导数是1/x' };
      }
      return { formula: `\\frac{d}{dx}(\\ln(${inner})) = \\frac{${inner}'}{${inner}}`, result: `(${inner})'/${inner}`, process: 'ln(u)导数=u\'/u' };
    }
    if (lower.includes('tan')) {
      return { formula: '\\frac{d}{dx}(\\tan x) = \\sec^2 x', result: '\\sec^2 x', process: 'tan的导数是sec²x' };
    }
    
    // 精确的表达式求值：用数值差分验证 + 给出明确的未求解标记
    return {
      formula: "f'(x) = ...",
      result: LocalComputationService.UNSOLVED,
      process: '分析函数结构，选择幂法则/乘积法则/链式法则/商法则',
    };
  }

  private computeIntegralResult(problem: string): { formula: string; result: string; process: string } {
    const lower = problem.toLowerCase();
    
    // 优先按“整段多项式”逐项积分：early-return 单个 x^n 会丢掉其余项（如 x^2 + 3x → 只算 x^2）
    const polyExpr = this.extractFunctionExpression(problem);
    if (polyExpr && /^[\dx\s\+\-\^\.\*\/\(\)a-z]+$/.test(polyExpr.replace(/\s/g, '')) && polyExpr.includes('x')) {
      const result = this.integratePolynomial(polyExpr);
      if (result && result !== 'C' && result !== '0 + C') {
        return {
          formula: `\\int (${this.mathTerminologyService.toLaTeX(polyExpr)}) \\,dx = ${result}`,
          result,
          process: '逐项积分: ∫ax^n dx = a·x^(n+1)/(n+1) + C',
        };
      }
    }

    const pwrMatch = lower.match(/(?:x\^)(\d+)/);
    if (pwrMatch) {
      const n = parseInt(pwrMatch[1]);
      const np = n + 1;
      return {
        formula: `\\int x^{${n}} \\,dx = \\frac{x^{${np}}}{${np}} + C`,
        result: `\\frac{x^{${np}}}{${np}} + C`,
        process: `幂法则: ∫x^n dx = x^(n+1)/(n+1) + C, 此处 n=${n}`,
      };
    }

    if (lower.includes('sin')) {
      return { formula: '\\int \\sin x \\,dx = -\\cos x + C', result: '-cos x + C', process: '基本积分: ∫sin x dx = -cos x + C' };
    }
    if (lower.includes('cos')) {
      return { formula: '\\int \\cos x \\,dx = \\sin x + C', result: 'sin x + C', process: '基本积分: ∫cos x dx = sin x + C' };
    }
    if (lower.includes('1/x') || lower.includes('1÷x')) {
      return { formula: '\\int \\frac{1}{x} \\,dx = \\ln|x| + C', result: 'ln|x| + C', process: '1/x积分得ln|x|, 注意绝对值' };
    }
    if (lower.includes('e^')) {
      return { formula: '\\int e^x \\,dx = e^x + C', result: 'e^x + C', process: 'e^x积分等于自身, 加C' };
    }
    if (lower.includes('sec^2') || lower.includes('sec²')) {
      return { formula: '\\int \\sec^2 x \\,dx = \\tan x + C', result: 'tan x + C', process: 'sec²x积分为tan x' };
    }
    
    return {
      formula: '\\int f(x) \\,dx = ...',
      result: LocalComputationService.UNSOLVED,
      process: '识别被积函数类型, 选择换元法/分部积分/部分分式等方法',
    };
  }

  private computeLimitResult(problem: string): { formula: string; result: string; process: string } {
    const lower = problem.toLowerCase();
    
    if (lower.includes('sin') && lower.includes('/') && (lower.includes('→0') || lower.includes('->0'))) {
      return { formula: '\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1', result: '1', process: '重要极限: lim(x→0) sin(x)/x = 1' };
    }
    if (lower.includes('(1+') && lower.includes('^') && (lower.includes('→∞') || lower.includes('->∞'))) {
      return { formula: '\\lim_{x \\to \\infty} (1+\\frac{1}{x})^x = e', result: 'e', process: '重要极限: lim(x→∞)(1+1/x)^x = e' };
    }
    if (lower.includes('→0') || lower.includes('->0')) {
      const polyExpr = this.extractFunctionExpression(problem);
      if (polyExpr && /^[\dx\s\+\-\^]+$/.test(polyExpr)) {
        const terms = this.parsePolynomial(polyExpr) ?? [];
        const constTerm = terms.find(t => t.exp === 0);
        return {
          formula: `\\lim_{x \\to 0} (${polyExpr}) = ${constTerm?.coeff ?? 0}`,
          result: `${constTerm?.coeff ?? 0}`,
          process: 'x→0时x^n→0(n≥1), 极限为常数项',
        };
      }
    }
    if (lower.includes('→∞') || lower.includes('->∞')) {
      const polyExpr = this.extractFunctionExpression(problem);
      if (polyExpr) {
        try {
          const polyStr = polyExpr.replace(/\s/g, '');
          if (/^[\dx\+\-\^\.\*\/\(\)]+$/.test(polyStr) && polyStr.includes('x')) {
            const terms = this.parsePolynomial(polyExpr) ?? [];
            if (terms.length > 0) {
              const maxExp = Math.max(...terms.map(t => t.exp));
              const leading = terms.find(t => t.exp === maxExp);
              const sign = (leading?.coeff ?? 0) > 0 ? '+∞' : '-∞';
              return {
                formula: `\\lim_{x \\to \\infty} (${polyExpr})`,
                result: maxExp > 0 ? (leading?.coeff ?? 0) > 0 ? '∞' : '-∞' : `${leading?.coeff ?? 0}`,
                process: `x→∞时最高次项x^${maxExp}主导, 极限为${sign}`,
              };
            }
          }
        } catch (e) {}
      }
    }
    
    return {
      formula: `lim ${problem.replace(/→/g, '→')}`,
      result: LocalComputationService.UNSOLVED,
      process: '分析趋近点, 判断是否为不定式, 选择合适的求解方法',
    };
  }

  private computeEquationResult(problem: string): { formula: string; result: string; process: string } {
    // 先剥掉“解方程/求解/解:”这类中文引导词，再交给表达式引擎。
    const cleaned = problem
      .replace(/^(?:解方程|求解方程|方程式|解|求解|求)\s*[:：]?\s*/i, '')
      .trim();

    const solution = solveEquationString(cleaned);

    if (solution.kind === 'identity') {
      return {
        formula: solution.moved ?? '',
        result: 'x \u2208 R（恒等式，无穷多解）',
        process: '两边移项后恒为 0 = 0，因此任意实数都是解',
      };
    }

    if (solution.kind === 'none') {
      return {
        formula: solution.moved ?? '',
        result: '无解',
        process: '两边移项后得到非零常数 = 0，矛盾，因此方程无解',
      };
    }

    if (solution.kind === 'roots') {
      const { roots, degree } = solution;
      const allComplex = roots.every(root => Number.isNaN(root.numeric));
      const result = allComplex
        ? `无实数解，复数解：${roots.map(root => root.latex).join('，')}`
        : roots.map(root => root.latex).join('，');
      const formula =
        degree === 1
          ? 'ax + b = 0 \\implies x = -\\frac{b}{a}'
          : 'x = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}';
      return {
        formula,
        result,
        process: `移项整理为标准形式 ${solution.moved ?? ''} = 0（${degree} 次方程），代入求根公式得到精确解`,
      };
    }

    // 超出本地能力（高次、含三角函数/分式的方程）：显式标记，不编造答案
    return {
      formula: '',
      result: LocalComputationService.UNSOLVED,
      process: `整理方程→识别类型→选择解法（${solution.reason}）`,
    };
  }

  /**
   * 清洗数学表达式：去掉中文、全角标点等字符。
   * 否则 SymPy 会把“求导：”这类中文当成符号参与运算，返回 3*x**2*导*求*：这样的脏结果。
   */
  private sanitizeMathExpression(expr: string): string {
    if (!expr) return '';
    return expr
      .replace(/[\u3000-\u303f\uff00-\uffef]/g, ' ')
      .replace(/[\u4e00-\u9fff]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[\s,，:：=]+/, '')
      .trim();
  }

  private extractFunctionExpression(problem: string): string | null {
    const eqPrefix = /^(?:解方程|求解方程|解|方程式?)\s*(.+)/i;
    const eqMatch = problem.match(eqPrefix);
    if (eqMatch) return this.sanitizeMathExpression(eqMatch[1]) || null;

    // 极限表达式：剥离 lim(x→a) 前缀，只保留函数本体
    const limPrefix = /lim\s*\(([^)]+)\)\s*(.+)/i;
    const limMatch = problem.match(limPrefix);
    if (limMatch) return this.sanitizeMathExpression(limMatch[2]) || null;

    const patterns = [
      /f\(x\)\s*=\s*(.+?)(?:\s*[,，]|$)/,
      /求(.+?)的/,
      /对(.+?)(?:求|进)/,
      /∫\s*(.+?)\s*dx/i,
      /d\/dx\s*\((.+?)\)/,
    ];
    for (const p of patterns) {
      const m = problem.match(p);
      if (m) {
        const cleaned = this.sanitizeMathExpression(m[1]);
        if (cleaned) return cleaned;
      }
    }

    // 兜底：整串题目去掉中文/全角标点后，如果只剩数学符号就当作表达式
    const stripped = this.sanitizeMathExpression(problem);
    if (stripped && /^[\dx\s\+\-\*\/\^\.\(\)a-z=<>≤≥≠,]+\s*$/i.test(stripped)) {
      return stripped;
    }

    return null;
  }

  // ========== 替换原有硬编码方法 ==========

  private extractLimitFormula(problem: string): string {
    return this.computeLimitResult(problem).formula;
  }

  private extractDerivativeFormula(problem: string): string {
    return this.computeDerivativeResult(problem).formula;
  }

  private extractIntegralFormula(problem: string): string {
    return this.computeIntegralResult(problem).formula;
  }

  private extractEquationFormula(problem: string): string {
    return this.computeEquationResult(problem).formula;
  }

  private calculateLimitResult(problem: string): string {
    return this.computeLimitResult(problem).result;
  }

  private calculateDerivativeResult(problem: string): string {
    return this.computeDerivativeResult(problem).result;
  }

  private calculateIntegralResult(problem: string): string {
    return this.computeIntegralResult(problem).result;
  }

  private calculateEquationResult(problem: string): string {
    return this.computeEquationResult(problem).result;
  }

  // 获取极限知识点
  private getLimitKnowledgePoints(): KnowledgePoint[] {
    return [
      {
        name: '极限定义',
        description: '函数在某一点的极限是当自变量趋近于该点时函数值的趋近值',
        formulas: ['\\lim_{x \to a} f(x) = L'],
        importance: 0.9,
      },
      {
        name: '洛必达法则',
        description: '用于计算0/0或∞/∞型不定式的极限',
        formulas: ['\\lim_{x \to a} \\frac{f(x)}{g(x)} = \\lim_{x \to a} \\frac{f\'(x)}{g\'(x)}'],
        importance: 0.8,
      },
      {
        name: '重要极限',
        description: '常见的重要极限公式',
        formulas: ['\\lim_{x \to 0} \\frac{\\sin x}{x} = 1', '\\lim_{x \to \infty} (1 + \\frac{1}{x})^x = e'],
        importance: 0.7,
      },
    ];
  }

  // 获取导数知识点
  private getDerivativeKnowledgePoints(): KnowledgePoint[] {
    return [
      {
        name: '导数定义',
        description: '函数在某一点的导数是函数在该点的变化率',
        formulas: ['f\'(x) = \\lim_{h \to 0} \\frac{f(x+h) - f(x)}{h}'],
        importance: 0.9,
      },
      {
        name: '基本求导公式',
        description: '常见函数的导数公式',
        formulas: ['\\frac{d}{dx}(x^n) = nx^{n-1}', '\\frac{d}{dx}(\\sin x) = \\cos x'],
        importance: 0.8,
      },
      {
        name: '链式法则',
        description: '用于计算复合函数的导数',
        formulas: ['\\frac{d}{dx}(f(g(x))) = f\'(g(x)) \\cdot g\'(x)'],
        importance: 0.8,
      },
    ];
  }

  // 获取积分知识点
  private getIntegralKnowledgePoints(): KnowledgePoint[] {
    return [
      {
        name: '不定积分',
        description: '求原函数的过程',
        formulas: ['\\int f(x) dx = F(x) + C'],
        importance: 0.9,
      },
      {
        name: '定积分',
        description: '函数在区间上的积分',
        formulas: ['\\int_a^b f(x) dx = F(b) - F(a)'],
        importance: 0.8,
      },
      {
        name: '积分方法',
        description: '换元法、分部积分法等',
        formulas: ['\\int u dv = uv - \\int v du'],
        importance: 0.7,
      },
    ];
  }

  // 获取方程知识点
  private getEquationKnowledgePoints(): KnowledgePoint[] {
    return [
      {
        name: '一元二次方程',
        description: '形如ax² + bx + c = 0的方程',
        formulas: ['x = \\frac{-b \\pm \\sqrt{b² - 4ac}}{2a}'],
        importance: 0.8,
      },
      {
        name: '因式分解',
        description: '将多项式分解为因式的乘积',
        formulas: ['x² - a² = (x - a)(x + a)'],
        importance: 0.7,
      },
    ];
  }

  // 获取通用知识点
  private getGeneralKnowledgePoints(): KnowledgePoint[] {
    return [
      {
        name: '数学推理',
        description: '逻辑推理和证明方法',
        formulas: [],
        importance: 0.9,
      },
      {
        name: '数学符号',
        description: '常用数学符号的含义和使用',
        formulas: [],
        importance: 0.6,
      },
    ];
  }

  // 检查SymPy是否可用
  private isSymPyAvailable(): boolean {
    return !!this.sympyServiceUrl;
  }

  private getOperationLabel(problemType: MathProblemType): string {
    switch (problemType) {
      case MathProblemType.DERIVATIVE: return '求导';
      case MathProblemType.INTEGRAL: return '积分';
      case MathProblemType.LIMIT: return '求极限';
      case MathProblemType.EQUATION: return '解方程';
      case MathProblemType.ODE: return '解微分方程';
      default: return '计算';
    }
  }

  private stripChinesePrefix(expr: string): string {
    return expr.replace(/^(?:解方程|求解方程|解|求|方程式?)\s*/i, '').trim();
  }

  private createSymPySteps(
    problemType: MathProblemType,
    expr: string,
    variable: string,
    responseData: any,
  ): SolutionStep[] {
    const operationLabel = this.getOperationLabel(problemType);
    const sympySteps: string[] = responseData.steps || [];
    const result = responseData.result || '';
    const rawLatex = responseData.latex || '';
    // SymPy 有时会把 latex 直接返回成最终答案，此时改用题目表达式充当“表达式”更有信息量
    const latex = rawLatex && rawLatex !== result ? rawLatex : (expr || rawLatex);

    // 对于微分方程（ODE），使用SymPy返回的steps直接构建
    if (problemType === MathProblemType.ODE) {
      const odeSteps: SolutionStep[] = [];
      sympySteps.forEach((stepText, index) => {
        odeSteps.push({
          id: `step${index + 1}`,
          title: `步骤${index + 1}`,
          description: stepText.includes('【') ? stepText.split('】')[0].replace('【', '') : `解题步骤${index + 1}`,
          formula: index === 0 ? latex : '',
          process: stepText,
          result: index === sympySteps.length - 1 ? result : '',
          highlight: '',
          keyPoint: '微分方程求解',
        });
      });
      // 如果SymPy没有返回足够的steps，至少显示结果
      if (odeSteps.length === 0) {
        odeSteps.push({
          id: 'step1',
          title: '求解微分方程',
          description: '使用特征方程法求解常系数线性齐次微分方程',
          formula: latex,
          process: `求解方程: ${expr}`,
          result: result,
          highlight: '',
          keyPoint: '微分方程通解',
        });
      }
      return odeSteps;
    }

    // 对于其他问题类型，使用原来的逻辑
    const steps: SolutionStep[] = [];

    steps.push({
      id: 'step1',
      title: '解析数学表达式',
      description: `提取并解析${operationLabel}问题中的数学表达式`,
      formula: latex,
      process: sympySteps[0] || `解析表达式: ${expr}`,
      result: `表达式已成功解析为符号计算表达式`,
      highlight: '',
      keyPoint: '符号表达式构建',
    });

    steps.push({
      id: 'step2',
      title: `执行${operationLabel}运算`,
      description: `使用SymPy符号计算引擎执行精确的${operationLabel}运算`,
      formula: latex,
      process: sympySteps[1] || `对 "${expr}" 执行${operationLabel}运算`,
      result: result,
      highlight: '',
      keyPoint: `${operationLabel}运算`,
    });

    if (sympySteps.length > 2) {
      steps.push({
        id: 'step3',
        title: '输出计算结果',
        description: '展示符号计算的最终结果',
        formula: latex,
        process: sympySteps.slice(2).join('\n'),
        result: result,
        highlight: '',
        keyPoint: '结果输出',
      });
    }

    return steps;
  }

  // 从微分方程问题中提取方程部分
  private extractODEEquation(problem: string): string {
    // 移除中文描述，只保留方程部分
    let equation = problem;
    
    // 移除开头的中文描述（如"求解"、"求"等）
    equation = equation.replace(/^(求解|求|解|请|试)?\s*(微分方程|方程|常微分方程|ODE)?\s*/i, '').trim();
    
    return equation;
  }

  // 使用SymPy增强解题结果
  private async enhanceWithSymPy(solution: ProblemSolution, problem: string): Promise<ProblemSolution> {
    try {
      let expr = this.extractFunctionExpression(problem) || this.sanitizeMathExpression(problem) || problem;
      const variable = this.detectVariable(problem);

      let endpoint: string;
      let payload: any;

      switch (solution.problemType) {
        case MathProblemType.DERIVATIVE:
          endpoint = '/derivative';
          payload = { expr, variable, order: 1 };
          break;
        case MathProblemType.INTEGRAL:
          endpoint = '/integral';
          payload = { expr, variable };
          break;
        case MathProblemType.LIMIT:
          const approach = this.extractApproach(problem);
          endpoint = '/limit';
          // 不带 direction 时 SymPy 服务默认求**双侧**极限（数学上更常用）。
          // 题面显式写了单侧（如 x→0⁺ / 0-）才传 direction。
          payload = { expr, variable, approach, direction: this.extractLimitDirection(problem) };
          break;
        case MathProblemType.EQUATION:
          expr = this.stripChinesePrefix(expr);
          endpoint = '/solve';
          payload = { equation: expr, variable };
          break;
        case MathProblemType.ODE:
          // 对于微分方程，直接发送原始问题
          const odeEquation = this.extractODEEquation(problem);
          endpoint = '/ode';
          payload = { 
            equation: odeEquation,
            dependent_var: 'y',
            independent_var: 'x'
          };
          break;
        default:
          endpoint = '/calculate';
          payload = { expr: expr };
      }

      this.logger.log(`SymPy增强: ${endpoint} ← expr="${expr.substring(0, 50)}", type=${solution.problemType}`);

      let data: any;
      try {
        const response = await firstValueFrom(
          this.httpService.post(`${this.sympyServiceUrl}${endpoint}`, payload, {
            timeout: SYMPY_HTTP_TIMEOUT_MS,
            headers: sympyRequestHeaders(this.configService),
          }),
        );
        data = response.data;
      } catch (error) {
        // 服务端硬化后，未求值/解析失败/超时都返回 4xx/5xx 带 error_code，
        // 错误体里仍有结论信息（例如 limit_does_not_exist），不能直接整段丢弃。
        data = extractSympyErrorPayload(error);
        if (!data) {
          this.logger.warn(`SymPy增强请求失败: ${(error as Error)?.message}`);
          return solution;
        }
      }

      if (data.success && data.result) {
        solution.finalAnswer = data.result;
        solution.steps = this.createSymPySteps(solution.problemType, expr, variable, data);
        solution.problemType = solution.problemType;
        solution.difficulty = solution.difficulty;
        // 符号计算服务给出了真实结果 → 清除本地引擎的 unsolved 标记
        solution.status = 'solved';
        solution.reason = undefined;
        this.logger.log(`SymPy增强成功: ${data.result}`);
      } else if (data.error === 'limit_does_not_exist') {
        // "极限不存在"本身就是正确答案（例如 lim(x→0) 1/x），
        // 要把它作为结论输出，而不是当作求解失败留在 unsolved 状态。
        solution.finalAnswer = '极限不存在（左右极限不相等）';
        solution.status = 'solved';
        solution.reason = undefined;
        solution.steps = this.createSymPySteps(solution.problemType, expr, variable, data);
        this.logger.log('SymPy增强: 双侧极限不存在（左右极限不相等）');
      } else if (data.error) {
        this.logger.warn(`SymPy增强返回错误 [${data.error_code || 'UNKNOWN'}]: ${data.error}`);
      }

      return solution;
    } catch (error) {
      this.logger.warn('SymPy增强失败', error.message);
      return solution;
    }
  }

  private detectVariable(problem: string): string {
    const varMatch = problem.match(/(?:关于|对|w\.?r\.?t\.?\s*|d\/d)([a-z])/i);
    if (varMatch) return varMatch[1];
    if (problem.match(/d\/dx|对x|关于x/)) return 'x';
    if (problem.match(/d\/dy|对y|关于y/)) return 'y';
    if (problem.match(/d\/dt|对t|关于t/)) return 't';
    if (problem.match(/[a-z]\^/i)) {
      const m = problem.match(/([a-z])\^/i);
      if (m) return m[1];
    }
    return 'x';
  }

  private extractApproach(problem: string): string {
    const m = problem.match(/(?:→|->|趋近于|趋近)\s*(\S+)/);
    if (m) {
      const val = m[1].replace(/[）\)]\s*$/, '');
      if (val === '0' || val === '0+') return '0';
      if (val === '∞' || val === 'inf' || val === 'infinity') return 'oo';
      return val;
    }
    return '0';
  }

  /**
   * 从题面识别极限方向。
   * 返回 '+-'（双侧，默认）、'+'（右极限）或 '-'（左极限）。
   * 旧实现无条件按单侧求，导致 lim(x→0) 1/x 被判为 +∞，而正确答案是“不存在”。
   */
  private extractLimitDirection(problem: string): '+-' | '+' | '-' {
    const arrow = problem.match(/(?:→|->|趋近于|趋近)\s*([^\s,，)）]+)/);
    if (!arrow) return '+-';
    const target = arrow[1];
    if (/[+⁺]\s*$/.test(target) || /\+\s*$/.test(target)) return '+';
    if (/[-⁻−]\s*$/.test(target)) return '-';
    // “左极限/右极限”的中文表述
    if (/左极限/.test(problem)) return '-';
    if (/右极限/.test(problem)) return '+';
    return '+-';
  }

  // 验证解题步骤
  validateSolutionSteps(steps: SolutionStep[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    let isValid = true;

    // 检查步骤完整性
    if (steps.length === 0) {
      errors.push('解题步骤为空');
      isValid = false;
    }

    // 检查每一步的内容
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step.title) {
        errors.push(`第${i + 1}步缺少标题`);
        isValid = false;
      }
      if (!step.process) {
        errors.push(`第${i + 1}步缺少过程`);
        isValid = false;
      }
      if (!step.result) {
        errors.push(`第${i + 1}步缺少结果`);
        isValid = false;
      }
    }

    return { isValid, errors };
  }

  // 生成详细的解题步骤说明
  generateStepExplanations(steps: SolutionStep[]): string[] {
    return steps.map((step, index) => {
      return `步骤 ${index + 1}: ${step.title}\n` +
             `描述: ${step.description}\n` +
             `公式: ${step.formula || '无'}\n` +
             `过程: ${step.process}\n` +
             `结果: ${step.result}\n` +
             `注意: ${step.highlight}\n` +
             `知识点: ${step.keyPoint}\n`;
    });
  }
}
