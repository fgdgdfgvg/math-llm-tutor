import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BaseAgent } from '../agent.base';
import { AgentInput, AgentContext } from '../agent.types';
import { AIModelsService } from '../ai-models.service';
import { AIModelProvider } from '../ai-models.types';
import { LocalComputationService } from '../local-computation/local-computation.service';
import { RedisCacheService } from '../../../common/services/redis-cache.service';
import { ModelRouterService, MathProblemCategory } from '../../../common/services/model-router.service';
import { HallucinationGuardService } from '../../../common/services/hallucination-guard.service';
import { extractAiJson } from '../ai-json.utils';
import {
  SYMPY_HTTP_TIMEOUT_MS,
  extractSympyErrorPayload,
  sympyRequestHeaders,
} from '../../../common/utils/sympy-client.util';
import {
  CLASSIFICATION_PATTERNS,
  RULE_STEP_TEMPLATES,
  KNOWLEDGE_METHOD_MAP,
} from './rule-engine.templates';

// 求解智能体
export class SolverAgent extends BaseAgent {
  constructor(
    config: any,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly aiModelsService: AIModelsService,
    private readonly localComputationService: LocalComputationService,
    private readonly redisCacheService: RedisCacheService,
    private readonly modelRouterService: ModelRouterService,
    private readonly hallucinationGuardService: HallucinationGuardService,
  ) {
    super(config);
    this.logger.log(`规则引擎已加载: ${CLASSIFICATION_PATTERNS.length} 种分类模式, ${RULE_STEP_TEMPLATES.length} 组步骤模板, ${KNOWLEDGE_METHOD_MAP.length} 条知识-方法映射`);
  }

  protected async process(input: AgentInput, context: AgentContext): Promise<any> {
    const { problem } = input;
    const { plan } = context;

    // 智能路由：根据题型选择最优求解方法
    const routingDecision = this.modelRouterService.route(problem);
    this.logger.log(`智能路由: ${routingDecision.category} → ${routingDecision.selectedModel} (置信度: ${routingDecision.confidence.toFixed(2)})`);

    const cacheKey = this.redisCacheService.generateKey(problem, 'solver');
    try {
      const cachedResult = await this.redisCacheService.get(cacheKey);
      if (cachedResult) {
        const parsed = JSON.parse(cachedResult);
        this.logger.log(`缓存命中: 直接返回已缓存结果`);
        context.solutionSteps = parsed.solutionSteps;
        context.intermediateResults = parsed.intermediateResults;
        context.finalAnswer = parsed.finalAnswer;
        return parsed;
      }
    } catch (cacheError) {
      this.logger.warn(`缓存读取失败: ${cacheError.message}`);
    }

    let localSolution;
    try {
      // 首先尝试使用本地计算服务（API零依赖）
      this.logger.log('使用本地计算服务求解问题');
      localSolution = await this.localComputationService.solveProblem(problem);
      
      // 将本地计算结果转换为系统格式
      const solutionSteps = localSolution.steps.map((step: any, index: number) => {
        return JSON.stringify({
          stepTitle: step.title,
          keyPoint: step.keyPoint || this.inferKeyPoint(step.description),
          formula: step.formula,
          process: step.process,
          result: step.result,
          highlight: step.highlight || this.generateHighlight(step.title),
        });
      });

      const finalAnswer = localSolution.finalAnswer;
      const intermediateResults = localSolution.steps.map((step: any) => step.result);

      // 更新上下文
      context.solutionSteps = solutionSteps;
      context.intermediateResults = intermediateResults;
      context.finalAnswer = finalAnswer;
      context.knowledgePoints = localSolution.knowledgePoints.map(kp => ({
        id: `kp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: kp.name,
        description: kp.description,
        formula: kp.formulas?.[0] || '',
        latex: '',
        difficulty: 'medium',
        tags: [],
      }));

      this.logger.log(`本地计算服务求解成功，生成 ${solutionSteps.length} 个步骤`);
      this.logger.log(`Local computation solution steps: ${JSON.stringify(solutionSteps)}`);
      this.logger.log(`Local computation final answer: ${finalAnswer}`);

      const result = {
        solutionSteps,
        intermediateResults,
        finalAnswer,
      };

      this.redisCacheService.set(cacheKey, JSON.stringify(result), 3600).catch(e =>
        this.logger.warn(`缓存写入失败: ${e.message}`),
      );

      return result;
    } catch (error) {
      this.logger.warn('本地计算服务求解失败，尝试规则引擎增强', error.message);
      // 保留本地计算可能已获取的部分上下文（如问题分类、知识点），避免完全空壳
      if (localSolution) {
        context.metadata.problemCategory = localSolution.problemType;
        context.knowledgePoints = context.knowledgePoints || localSolution.knowledgePoints.map(kp => ({
          id: `kp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: kp.name,
          description: kp.description,
          formula: kp.formulas?.[0] || '',
          latex: '',
          difficulty: 'medium',
          tags: [],
        }));
      }
    }

    // 传统方法作为fallback
    if (!plan || !plan.steps || plan.steps.length === 0) {
      this.logger.warn('解题计划不存在或为空，使用规则引擎生成步骤');
      const ruleBased = this.generateRuleBasedSolution(problem);

      this.redisCacheService.set(cacheKey, JSON.stringify(ruleBased), 1800).catch(e =>
        this.logger.warn(`缓存写入失败: ${e.message}`),
      );

      return ruleBased;
    }

    const solutionSteps: string[] = [];
    const intermediateResults: any[] = [];
    let hasLLMFailed = false;

    for (const step of plan.steps) {
      this.logger.log(`执行步骤: ${step.description}`);

      try {
        let result: any;
        const useLLM = step.tool !== 'sympy' || !this.isSymPyAvailable();

        if (useLLM) {
          result = await this.executeLLM(step.description, problem, context);
          if (result.includes('执行失败') || result.includes('不可用')) {
            hasLLMFailed = true;
          }
        } else {
          result = await this.executeSymPy(step.description, problem);
        }

        solutionSteps.push(this.formatStepResult(step, result));
        intermediateResults.push(result);

      } catch (error) {
        this.logger.warn(`执行步骤失败: ${step.description}`, error.message);
        hasLLMFailed = true;

        const fallbackResult = this.getStepFallback(step.description, problem);
        solutionSteps.push(this.formatStepResult(step, fallbackResult));
        intermediateResults.push(fallbackResult);
      }
    }

    // 生成最终答案
    let finalAnswer: string;
    try {
      finalAnswer = await this.generateFinalAnswer(problem, solutionSteps, context);
    } catch (error) {
      this.logger.warn('AI生成最终答案失败，使用规则提取', error.message);
      finalAnswer = this.extractFinalAnswerFromSteps(solutionSteps, problem);
    }

    // 如果所有LLM调用都失败了，用纯规则引擎重新生成更完整的解答
    if (hasLLMFailed && (!finalAnswer || finalAnswer.includes('无法'))) {
      this.logger.log('LLM全部失败，使用规则引擎生成完整解答');
      const ruleBased = this.generateRuleBasedSolution(problem);
      context.solutionSteps = ruleBased.solutionSteps;
      context.intermediateResults = ruleBased.intermediateResults;
      context.finalAnswer = ruleBased.finalAnswer;

      this.redisCacheService.set(cacheKey, JSON.stringify(ruleBased), 1800).catch(e =>
        this.logger.warn(`缓存写入失败: ${e.message}`),
      );

      return ruleBased;
    }

    context.solutionSteps = solutionSteps;
    context.intermediateResults = intermediateResults;
    context.finalAnswer = finalAnswer;

    this.logger.log(`Generated solution steps: ${JSON.stringify(solutionSteps)}`);
    this.logger.log(`Final answer: ${finalAnswer}`);

    const result = {
      solutionSteps,
      intermediateResults,
      finalAnswer,
    };

    // 幻觉防控验证
    try {
      const verificationResults = this.hallucinationGuardService.fullVerification(
        solutionSteps, finalAnswer, problem,
      );
      const failedSteps = verificationResults.filter(r => !r.isVerified);
      if (failedSteps.length > 0) {
        this.logger.warn(`幻觉防控检测: ${failedSteps.length}步骤未通过验证, 置信度下降`);
        result['hallucinationVerification'] = {
          passedSteps: verificationResults.length - failedSteps.length,
          totalSteps: verificationResults.length,
          failedSteps: failedSteps.map(s => ({
            content: s.stepContent.substring(0, 100),
            issues: s.theoremIssues.map(i => i.description),
          })),
        };
      } else {
        this.logger.log('幻觉防控验证: 全部通过');
      }
    } catch (e) {
      this.logger.warn(`幻觉防控验证失败: ${e.message}`);
    }

    this.redisCacheService.set(cacheKey, JSON.stringify(result), 3600).catch(e =>
      this.logger.warn(`缓存写入失败: ${e.message}`),
    );

    return result;
  }

  // 格式化步骤结果（统一结构化JSON格式）
  private formatStepResult(step: any, result: string): string {
    const structured = {
      stepTitle: step.description?.substring(0, 15) || '解题步骤',
      keyPoint: this.inferKeyPoint(step.description),
      formula: this.extractFormula(result) || '',
      process: result.length > 200 ? result.substring(0, 200) + '...' : result,
      result: this.extractResultValue(result),
      highlight: this.generateHighlight(step.description),
    };
    return JSON.stringify(structured);
  }

  // 推断关键知识点
  private inferKeyPoint(description: string): string {
    const pointMap: Record<string, string> = {
      '极限': '极限定义与性质', '洛必达': '洛必达法则', '不定式': '不定式分类',
      '导数': '求导法则', '求导': '导数定义', '微分': '微分运算',
      '积分': '积分方法', '原函数': '不定积分', '定积分': '牛顿-莱布尼茨公式',
      '级数': '级数收敛判别', '泰勒': '泰勒展开',
      '方程': '方程求解', '因式分解': '代数恒等式',
      '验证': '结果检验', '代入': '数值计算',
    };

    for (const [key, value] of Object.entries(pointMap)) {
      if (description.includes(key)) return value;
    }
    return '数学推理';
  }

  // 从结果中提取公式
  private extractFormula(result: string): string {
    const latexPatterns = [
      /\\\$([^$]+)\\\$/g,
      /\$\$([^$]+)\$\$/g,
      /\\lim\{[^}]+\}[^=]*/g,
      /\\frac\{[^}]+\}\{[^}]+\}/g,
      /\\int_[^ ]+\s*\{[^}]*\}/g,
    ];

    for (const pattern of latexPatterns) {
      const match = result.match(pattern);
      if (match) return match[0].substring(0, 100);
    }
    return '';
  }

  // 提取结果值
  private extractResultValue(result: string): string {
    const patterns: RegExp[] = [
      /[=：:]\s*([\d\/\+\-\*\^\(\)\w\s]+)(?:$|[\n。])/,
      /结果[是为：:\s]*([^\n。]+)/,
      /(?:answer|ans|答案)[是为：:\s]*([^\n。]+)/i,
    ];

    for (const pattern of patterns) {
      const match = result.match(pattern);
      if (match && match[1]) return match[1].trim();
    }
    return result.substring(0, 50).trim();
  }

  // 生成避坑提示
  private generateHighlight(description: string): string {
    const tips: Record<string, string> = {
      '极限': '注意检查是否为不定式（0/0、∞/∞等）才能使用洛必达法则',
      '导数': '注意复合函数需使用链式法则逐层求导',
      '积分': '注意换元时不要遗漏dx项和常数C',
      '级数': '注意先判断收敛性再求和',
      '验证': '建议通过逆向运算（如对答案求导）来验证正确性',
    };

    for (const [key, tip] of Object.entries(tips)) {
      if (description.includes(key)) return tip;
    }
    return '请仔细检查每一步的计算过程';
  }

  // 纯规则引擎解题（不依赖任何外部服务）
  private generateRuleBasedSolution(problem: string): any {
    this.logger.log('启动规则引擎解题模式');

    const problemType = this.classifyProblemForRules(problem);
    const steps = this.generateRuleSteps(problem, problemType);
    const finalAnswer = this.extractFinalAnswerFromSteps(steps, problem);

    return {
      solutionSteps: steps,
      intermediateResults: steps,
      finalAnswer,
    };
  }

  // 规则引擎题目分类
  private classifyProblemForRules(problem: string): string {
    const p = problem.toLowerCase();
    if (p.includes('极限') || p.includes('limit') || p.includes('lim')) return 'limit';
    if (p.includes('导数') || p.includes('derivative')) return 'derivative';
    if (p.includes('积分') || p.includes('integral')) return 'integral';
    if (p.includes('微分方程') || p.includes('differential equation') || p.includes("y''")) return 'ode';
    if (p.includes('方程') || p.includes('equation') || /[a-z]\s*=/.test(p)) return 'equation';
    return 'general';
  }

  // 规则引擎步骤生成
  private generateRuleSteps(problem: string, type: string): string[] {
    const stepTemplates: Record<string, Array<{title: string; content: string}>> = {
      limit: [
        {
          title: '识别极限类型',
          content: `分析问题"${problem}"中的极限表达式，识别自变量趋近值和函数形式`,
        },
        {
          title: '判断不定式类型',
          content: `将x的趋近值代入函数，判断是否为0/0型、∞/∞型或其他可确定形式`,
        },
        {
          title: '应用求解方法',
          content: `根据不定式类型选择合适的方法（洛必达法则/等价无穷小替换/重要极限公式）进行化简计算`,
        },
        {
          title: '得出最终结果',
          content: `完成极限计算，得到最终数值或表达式结果`,
        },
      ],
      derivative: [
        {
          title: '分析函数结构',
          content: `识别待求导函数的基本形式（基本初等函数/复合函数/隐函数等）`,
        },
        {
          title: '选择求导法则',
          content: `根据函数结构选择适当的求导法则（基本公式/链式法则/乘积法则/商法则）`,
        },
        {
          title: '逐步求导计算',
          content: `按照选定的法则进行求导运算，注意每一步的符号和系数`,
        },
        {
          title: '化简最终结果',
          content: `整理并化简导函数表达式，得到最简形式`,
        },
      ],
      integral: [
        {
          title: '分析被积函数',
          content: `识别被积函数的类型和特点，确定积分策略`,
        },
        {
          title: '选择积分方法',
          content: `根据函数特点选择换元法/分部积分法/部分分式分解等方法`,
        },
        {
          title: '执行积分运算',
          content: `按选定方法求出原函数，注意添加积分常数C`,
        },
        {
          title: '验证结果',
          content: `对求得的原函数求导，确认能还原被积函数`,
        },
      ],
      equation: [
        { title: '整理方程', content: `整理方程并识别未知量：${problem}` },
        { title: '执行求解', content: '使用代数变形或符号计算求出全部解' },
        { title: '验证解', content: '将解代回原方程并检查定义域' },
        { title: '得出结论', content: '汇总并报告方程的解集' },
      ],
      ode: [
        { title: '识别微分方程类型', content: `分析方程的阶数、线性性和初始条件：${problem}` },
        { title: '建立求解模型', content: '选择分离变量、特征方程或积分因子等标准方法' },
        { title: '求得通解', content: '执行符号求解并保留任意常数' },
        { title: '验证结论', content: '将结果代回微分方程检查' },
      ],
      general: [
        {
          title: '理解题意',
          content: `明确问题的已知条件、未知量和求解目标`,
        },
        {
          title: '制定策略',
          content: `根据问题类型选择合适的数学方法和工具`,
        },
        {
          title: '执行计算',
          content: `按照策略进行具体的计算或推理操作`,
        },
        {
          title: '整理结论',
          content: `汇总中间结果，给出清晰的最终答案`,
        },
      ],
    };

    const template = stepTemplates[type] || stepTemplates.general;
    return template.map((s, i) => JSON.stringify({
      stepTitle: s.title,
      keyPoint: this.inferKeyPoint(s.title),
      formula: '',
      process: s.content,
      result: this.generateRuleStepResult(problem, type, i),
      highlight: this.generateHighlight(s.title),
    }));
  }

  private generateRuleStepResult(problem: string, type: string, index: number): string {
    if (index === 3) {
      const content = this.generateStepContent(type === 'derivative' ? '导数' : type === 'integral' ? '积分' : type === 'limit' ? '极限' : '方程', problem);
      return content.result;
    }
    return `已完成：${type}问题的第${index + 1}步分析`;
  }

  /**
   * 识别“占位符式结果”。这类文本不是答案，绝不能被当成最终答案返回给前端
   * （以前 `（极限值）`、`（方程的解）` 会直接作为 finalAnswer 输出）。
   */
  private isPlaceholderResult(result: string): boolean {
    if (!result) return true;
    const text = result.trim();
    if (!text) return true;
    if (text.includes('执行中') || text.includes('...') || text.includes('…')) return true;
    // 整体被中文括号包住的泛称：`（极限值）`、`（方程的解）`、`（计算完成）`
    if (/^（[^）]{1,20}）$/.test(text)) return true;
    const placeholderKeywords = [
      '需逐项应用', '需部分分式', '取决于', '无法自动识别',
      '无法自动提取', '无法从', '未能', '请补充', '待补充', '暂无法',
      // 无信息泛化文本（A/B 消融实测：LaTeX 题面降级时 finalAnswer 全是这类输出，
      // 与 `（极限值）` 一样是"没有答案"的信号，绝不应原样透传给前端/错题本）
      '已整理结论', '整理如下', '综上所述，已完成',
    ];
    return placeholderKeywords.some((keyword) => text.includes(keyword));
  }

  // 从步骤中提取最终答案
  private extractFinalAnswerFromSteps(steps: string[], problem: string): string {
    for (let i = steps.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(steps[i]);
        if (parsed.result && !this.isPlaceholderResult(parsed.result)) {
          return parsed.result;
        }
      } catch (e) {
        // 非 JSON 步骤跳过；记录尝试过的位置便于排查"为何未提取到答案"
        this.logger.debug(`步骤[${i}]非 JSON，跳过提取: ${(e as Error).message}`);
        }
    }

    // 不编造答案：编一个看似合理的假答案比诚实地说「未得出」危害大得多
    // （会污染错题本、判题与用户评估）。以前这里会按题型返回硬编码假答案，
    // 例如所有极限题都返回 1 —— 已移除。
    return '未能从解题步骤中提取出确定的结果，请检查题目或重试。';
  }

  // 步骤级别的fallback（增强版：生成实际内容）
  private getStepFallback(description: string, problem: string): string {
    const stepContent = this.generateStepContent(description, problem);
    return JSON.stringify({
      stepTitle: description.substring(0, 15),
      keyPoint: this.inferKeyPoint(description),
      formula: stepContent.formula,
      process: stepContent.process,
      result: stepContent.result,
      highlight: stepContent.highlight,
    });
  }

  // 生成具体的步骤内容
  private generateStepContent(description: string, problem: string): any {
    const lowerDesc = description.toLowerCase();
    const lowerProb = problem.toLowerCase();

    // 导数相关
    if (lowerDesc.includes('derivative') || lowerDesc.includes('导数') || lowerProb.includes('d/dx') || lowerProb.includes('导数')) {
      return this.generateDerivativeContent(problem);
    }
    
    // 积分相关
    if (lowerDesc.includes('integral') || lowerDesc.includes('积分') || lowerProb.includes('∫') || lowerProb.includes('积分')) {
      return this.generateIntegralContent(problem);
    }
    
    // 极限相关
    if (lowerDesc.includes('limit') || lowerDesc.includes('极限') || lowerProb.includes('lim') || lowerProb.includes('极限')) {
      return this.generateLimitContent(problem);
    }
    
    // 方程相关
    if (lowerDesc.includes('equation') || lowerDesc.includes('方程') || lowerProb.includes('=') || lowerProb.includes('方程')) {
      return this.generateEquationContent(problem);
    }
    
    // 通用步骤
    return {
      formula: '',
      process: `执行${description}：根据数学基本原理进行分析和计算`,
      result: '步骤执行完成，但本地规则未能给出可验证的确定结果',
      highlight: '步骤清晰，逻辑正确',
    };
  }

  // 生成导数步骤内容
  private generateDerivativeContent(problem: string): any {
    const match = problem.match(/(?:求|计算|d\/dx|y'?\s*=\s*)(.+?)(?:的|在|当|$)/);
    const func = match ? match[1].trim() : problem;
    
    if (func.includes('x^')) {
      const powerMatch = func.match(/x\^(\d+)/);
      if (powerMatch) {
        const n = parseInt(powerMatch[1]);
        return {
          formula: `\\frac{d}{dx}(x^{${n}}) = ${n}x^{${n-1}}`,
          process: `应用幂法则：\\frac{d}{dx}(x^n) = nx^{n-1}，其中n=${n}`,
          result: `${n}x^{${n-1}}`,
          highlight: '幂法则是求导的基本方法',
        };
      }
    }
    if (func.includes('sin')) {
      const inner = func.includes('(') ? func.match(/sin\(([^)]+)\)/)?.[1] || 'x' : 'x';
      if (inner === 'x') {
        return {
          formula: '\\frac{d}{dx}(\\sin x) = \\cos x',
          process: '三角函数基本求导公式',
          result: '\\cos x',
          highlight: 'sin的导数是cos，符号保持不变',
        };
      }
      return {
        formula: `\\frac{d}{dx}(\\sin(${inner})) = \\cos(${inner}) \\cdot ${inner}'`,
        process: `使用链式法则：外导cos(${inner}) × 内导(${inner})'`,
        result: `\\cos(${inner}) \\cdot (${inner})'`,
        highlight: '链式法则：外导×内导',
      };
    }
    if (func.includes('cos')) {
      return {
        formula: '\\frac{d}{dx}(\\cos x) = -\\sin x',
        process: '三角函数基本求导公式',
        result: '-\\sin x',
        highlight: 'cos的导数是-sin，注意负号',
      };
    }
    if (func.includes('e^') || func.includes('exp')) {
      const inner = func.match(/(?:e\^|exp)\(?([^)]+)\)?/)?.[1] || 'x';
      if (inner === 'x') {
        return {
          formula: '\\frac{d}{dx}(e^x) = e^x',
          process: '指数函数e^x的导数等于自身',
          result: 'e^x',
          highlight: "e^x是唯一求导后不变的函数",
        };
      }
      return {
        formula: `\\frac{d}{dx}(e^{${inner}}) = e^{${inner}} \\cdot (${inner})'`,
        process: `链式法则求复合指数函数`,
        result: `e^{${inner}} \\cdot (${inner})'`,
        highlight: '外层e^u导数仍为e^u，需乘内层导数',
      };
    }
    if (func.includes('ln') || func.includes('log')) {
      return {
        formula: '\\frac{d}{dx}(\\ln x) = \\frac{1}{x}',
        process: '对数函数基本求导公式',
        result: '\\frac{1}{x}',
        highlight: 'ln x的导数是1/x',
      };
    }
    if (func.includes('tan')) {
      return {
        formula: '\\frac{d}{dx}(\\tan x) = \\sec^2 x',
        process: '三角函数基本求导公式',
        result: '\\sec^2 x',
        highlight: 'tan的导数是sec²x',
      };
    }
    if (func.includes('*') || func.includes('·')) {
      return {
        formula: '(uv)\' = u\'v + uv\'',
        process: '乘积函数需使用乘积法则分别求导',
        result: `(${func})' 需逐项应用乘积法则后展开，本地规则未能给出确定结果`,
        highlight: '乘积法则：前导后+前导后导',
      };
    }
    return {
      formula: 'f\'(x) = ...',
      process: `对"${func}"应用求导法则（幂法则、链式法则、乘积法则等）`,
      result: `（需对"${func}"逐项求导）`,
      highlight: `核心：识别"${func}"的复合结构，选择合适的求导法则`,
    };
  }

  // 生成积分步骤内容
  private generateIntegralContent(problem: string): any {
    const match = problem.match(/(?:求|计算|∫|积分\s*)(.+?)(?:的|$)/);
    const func = match ? match[1].trim() : problem;

    if (func.includes('x^')) {
      const powerMatch = func.match(/x\^(\d+)/);
      if (powerMatch) {
        const n = parseInt(powerMatch[1]);
        return {
          formula: `\\int x^{${n}} \\,dx = \\frac{x^{${n+1}}}{${n+1}} + C`,
          process: `幂函数积分法则：\\int x^n dx = \\frac{x^{n+1}}{n+1} + C，其中n=${n}`,
          result: `\\frac{x^{${n+1}}}{${n+1}} + C`,
          highlight: '积分号内x^n直接累加指数',
        };
      }
    }
    if (func.includes('sin')) {
      return {
        formula: '\\int \\sin x \\,dx = -\\cos x + C',
        process: '三角函数基本积分公式',
        result: '-\\cos x + C',
        highlight: 'sin积分为-cos，必写积分常数+C',
      };
    }
    if (func.includes('cos')) {
      return {
        formula: '\\int \\cos x \\,dx = \\sin x + C',
        process: '三角函数基本积分公式',
        result: '\\sin x + C',
        highlight: 'cos积分为sin，必须+C',
      };
    }
    if (func.includes('1/x') || func.includes('1÷x')) {
      return {
        formula: '\\int \\frac{1}{x} \\,dx = \\ln|x| + C',
        process: '基本对数积分公式',
        result: '\\ln|x| + C',
        highlight: '1/x积分得ln|x|，注意绝对值',
      };
    }
    if (func.includes('e^')) {
      return {
        formula: '\\int e^x \\,dx = e^x + C',
        process: '指数函数基本积分公式',
        result: 'e^x + C',
        highlight: 'e^x积分等于自身，加积分常数',
      };
    }
    if (func.includes('sec^2') || func.includes('tan')) {
      return {
        formula: '\\int \\sec^2 x \\,dx = \\tan x + C',
        process: '三角函数的平方关系积分',
        result: '\\tan x + C',
        highlight: 'sec²x积分为tan x',
      };
    }
    if (func.includes('/') || func.includes('÷')) {
      return {
        formula: '\\int \\frac{u}{v} \\,dx = ...',
        process: `有理函数"${func}"的积分需分步处理`,
        result: '（需部分分式分解或换元积分）',
        highlight: '有理函数积分的关键：分解为简单分式',
      };
    }
    return {
      formula: '\\int f(x) \\,dx = ...',
      process: `对"${func}"应用积分方法（幂法则、换元法、分部积分等）`,
      result: '无法自动识别被积函数，请补充标准表达式。',
      highlight: `积分核心：识别"${func}"的类型并选择合适方法，切记+C`,
    };
  }

  // 生成极限步骤内容
  private generateLimitContent(problem: string): any {
    // 不能把泛称当答案：无法确定时保留为空，由上游标记为“未得出确定结果”
    let result = '本地规则未能确定该极限值，需符号计算或 AI 求解';
    let method = '';

    if (problem.includes('sin') && problem.includes('/')) {
      if (problem.includes('→0') || problem.includes('->0')) {
        method = '重要极限 lim(x→0) sin(x)/x = 1';
      } else {
        method = '三角函数极限：应用三角恒等式化简';
      }
    } else if (problem.includes('(1+') && problem.includes('^')) {
      method = '重要极限 lim(x→0)(1+x)^(1/x)=e';
      result = 'e^x 的相关形式';
    } else if (problem.includes('→0') || problem.includes('->0')) {
      method = '代入法或等价无穷小替换';
    } else if (problem.includes('→∞') || problem.includes('->∞')) {
      if (problem.includes('/')) {
        method = '比较分子分母最高次幂系数';
        result = '该极限由分子分母最高次项比值决定，本地规则未能给出确定结果';
      } else {
        method = '分析函数在无穷远处的渐近行为';
      }
    } else {
      method = '直接代入目标点检查是否为不定式';
    }

    return {
      formula: problem.includes('sin') && problem.includes('/')
        ? '\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1'
        : `lim ${problem.replace(/→/g, '→').replace(/->/g, '→')}`,
      process: method || '应用极限运算法则',
      result,
      highlight: '关键：先检查是否可直接代入，若为0/0型则用重要极限或洛必达法则',
    };
  }

  // 生成方程步骤内容
  private generateEquationContent(problem: string): any {
    if (problem.includes('x^2') && problem.includes('=0')) {
      return {
        formula: "x^2 = 0 \implies x = 0",
        process: "解方程：x^2 = 0",
        result: "x = 0",
        highlight: "注意方程的解的个数",
      };
    }
    return {
      formula: '',
      process: "应用解方程的方法（移项、因式分解等）",
      result: "本地规则未能给出该方程的确定解，需符号计算或 AI 求解",
      highlight: "注意检验解的正确性",
    };
  }

  // 检查SymPy是否可用
  private isSymPyAvailable(): boolean {
    const url = this.configService.get<string>('SYMPY_SERVICE_URL');
    return !!url;
  }

  /**
   * 清洗数学表达式：去掉中文与全角标点，避免 SymPy 把中文字符当成符号
   * 参与运算（会返回 3*x**2*导*求*： 这类脏结果）。
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

  private extractMathExpression(problem: string): string {
    // 极限表达式：剥离 lim(x→a) 前缀，只保留函数本体
    const limPrefix = /lim\s*\(([^)]+)\)\s*(.+)/i;
    const limMatch = problem.match(limPrefix);
    if (limMatch) {
      const cleaned = this.sanitizeMathExpression(limMatch[2]);
      if (cleaned) return cleaned;
    }

    const patterns = [
      /(?:求|计算|y\s*=\s*)(.+?)(?:的|在|当|,|，|$)/,
      /f\(x\)\s*=\s*(.+)/,
      /lim\s*(.+)/i, /lim\s*\[(.+)\]/i,
      /∫\s*(.+?)\s*d[x-z]/i,
      /d\/dx\s*\((.+)\)/,
    ];
    for (const p of patterns) {
      const m = problem.match(p);
      if (m) {
        const cleaned = this.sanitizeMathExpression(m[1]);
        if (cleaned) return cleaned;
      }
    }

    return this.sanitizeMathExpression(problem) || problem;
  }

  private detectVariable(problem: string): string {
    const varMatch = problem.match(/(?:关于|对|w\.?r\.?t\.?\s*|d\/d)([a-z])/i);
    if (varMatch) return varMatch[1];
    if (problem.match(/d\/dx|对x|关于x/)) return 'x';
    if (problem.match(/d\/dy|对y|关于y/)) return 'y';
    if (problem.match(/d\/dt|对t|关于t/)) return 't';
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

  private async executeSymPy(description: string, problem: string): Promise<string> {
    try {
      const sympyServiceUrl = this.configService.get<string>('SYMPY_SERVICE_URL');
      if (!sympyServiceUrl) {
        throw new Error('SymPy服务未配置');
      }

      const lowerDesc = description.toLowerCase();
      const lowerProb = problem.toLowerCase();
      const expr = this.extractMathExpression(problem);
      const variable = this.detectVariable(problem);

      let endpoint: string;
      let payload: any;
      let operationLabel: string;

      if (lowerDesc.includes('导数') || lowerDesc.includes('derivative') || lowerProb.includes('求导') || lowerProb.includes('d/dx')) {
        endpoint = '/derivative';
        payload = { expr, variable, order: 1 };
        operationLabel = '求导';
      } else if (lowerDesc.includes('二阶导') || lowerDesc.includes('2阶导') || lowerDesc.includes('second derivative')) {
        endpoint = '/derivative';
        payload = { expr, variable, order: 2 };
        operationLabel = '二阶求导';
      } else if (lowerDesc.includes('积分') || lowerDesc.includes('integral') || lowerProb.includes('∫')) {
        endpoint = '/integral';
        payload = { expr, variable };
        operationLabel = '积分';
      } else if (lowerDesc.includes('极限') || lowerDesc.includes('limit') || lowerProb.includes('lim')) {
        const approach = this.extractApproach(problem);
        endpoint = '/limit';
        payload = { expr, variable, approach };
        operationLabel = '求极限';
      } else if (lowerDesc.includes('方程') || lowerDesc.includes('equation') || lowerProb.includes('=')) {
        const cleanedExpr = expr.replace(/^(?:解方程|求解方程|解|求|方程式?)\s*/i, '');
        endpoint = '/solve';
        payload = { equation: cleanedExpr, variable };
        operationLabel = '解方程';
      } else if (lowerDesc.includes('化简') || lowerDesc.includes('simplify')) {
        endpoint = '/simplify';
        payload = { expr };
        operationLabel = '化简';
      } else {
        endpoint = '/calculate';
        payload = { expr: problem };
        operationLabel = '计算';
      }

      this.logger.log(`SymPy路由: ${endpoint} ← expr="${expr.substring(0, 50)}", var=${variable}`);

      let data: any;
      try {
        const response = await firstValueFrom(
          this.httpService.post(`${sympyServiceUrl}${endpoint}`, payload, {
            timeout: SYMPY_HTTP_TIMEOUT_MS,
            headers: sympyRequestHeaders(this.configService),
          }),
        );
        data = response.data;
      } catch (error) {
        // 服务端硬化后失败返回真正的 4xx/5xx（带 error_code），错误体仍然可读
        data = extractSympyErrorPayload(error);
        if (!data) {
          throw error;
        }
      }

      if (data.success && data.result) {
        const sympySteps: string[] = data.steps || [];
        const resultStr = data.result;
        const latex = data.latex || '';

        const processText = sympySteps.length > 0
          ? sympySteps.join('\n')
          : `对 "${expr}" 执行${operationLabel}运算 → ${resultStr}`;

        return JSON.stringify({
          stepTitle: description.substring(0, 15),
          keyPoint: '符号计算',
          formula: latex,
          process: processText,
          result: resultStr,
          highlight: '',
        });
      }

      return data.result || data.error || '计算结果不可用';
    } catch (error) {
      this.logger.warn('SymPy执行失败', error.message);
      throw error;
    }
  }

  // 执行LLM推理（CoT + Self-Consistency增强版）
  private async executeLLM(description: string, problem: string, context: AgentContext): Promise<string> {
    try {
      if (!this.aiModelsService.isModelAvailable(AIModelProvider.QWEN)) {
        throw new Error('Qwen模型未配置');
      }

      const systemPrompt = `你是一位精通高等数学的解题专家。请使用思维链(Chain of Thought)方法逐步求解此数学问题。

## 解题规范
你必须遵循以下步骤进行推理，每一步都要写出思考过程：

### 第1步：问题理解(COT-Understand)
- 明确题目要求的计算目标（求极限/导数/积分/证明等）
- 识别题目中的关键条件和已知信息
- 判断题目类型和难度

### 第2步：策略制定(COT-Strategy)  
- 列举出至少2种可能的解题方法
- 比较各方法的优劣，选择最优方案
- 说明选择此方案的理由

### 第3步：逐步执行(COT-Execute)
- 严格按照选定的方法逐步计算
- 每一步写出使用的公式/定理名称
- 写出详细的代数/微积分运算过程
- 标记容易出错的关键步骤

### 第4步：自我验证(Self-Consistency Check)
- 检查每一步的数学逻辑是否正确
- 使用替代方法（如代入验证、逆向运算）验证结果
- 确认最终答案的合理性和完整性
- 排除常见的计算错误（符号错误、遗漏常数项、公式误用等）

## 输出格式
严格按JSON格式输出（不要包含markdown代码块标记）：
{
  "stepTitle": "简明扼要的步骤标题",
  "keyPoint": "本步使用的核心数学方法/定理名称",
  "cot_reasoning": "完整的思维链推理过程，包含所有的思考和分析",
  "formula": "关键的LaTeX数学公式",
  "process": "具体的计算过程",
  "result": "本步骤的计算结果",
  "self_check": "本步的自检验证结论",
  "highlight": "常见错误提示和关键注意事项",
  "confidence": "对本步结果的确信度(0.0-1.0)"
}

## 重要提醒
- 绝不凭空编造定理或公式，只使用标准高等数学教材中确认存在的定理
- 涉及计算时，明确指出使用的方法（洛必达/换元/分部积分等）
- 积分问题必须添加积分常数C（不定积分）或明确积分限（定积分）
- 如果无法确定答案，请诚实说明不确定性，不要编造

当前求解任务: ${description}
原始数学问题: ${problem}`;

      const userPrompt = `请按照思维链方法，逐步求解以下数学问题：

**问题**: ${problem}
**当前步骤**: ${description}

请从问题理解开始，完整执行COT推理流程，并在每一步完成后进行自我验证。`;

      const response = await this.aiModelsService.chat(AIModelProvider.QWEN, {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        maxTokens: 2048,
      });

      const content = response.content || '';
      const parsed = extractAiJson(content);
      if (parsed) {
        return JSON.stringify({
          stepTitle: parsed.stepTitle || description.substring(0, 15),
          keyPoint: parsed.keyPoint || this.inferKeyPoint(description),
          formula: parsed.formula || '',
          process: parsed.cot_reasoning || parsed.process || content.substring(0, 500),
          result: parsed.result || '',
          highlight: parsed.highlight || this.generateHighlight(description),
          confidence: parsed.confidence || 0.5,
          selfCheck: parsed.self_check || '',
        });
      }

      this.logger.warn(`步骤 JSON 解析失败，返回原始内容（前 120 字符: ${content.slice(0, 120).replace(/\s+/g, ' ')}）`);
      return content || '解题过程不可用';
    } catch (error) {
      this.logger.warn('Qwen LLM执行失败', error.message);
      throw error;
    }
  }

  // 生成最终答案（CoT + Self-Consistency增强版）
  private async generateFinalAnswer(problem: string, solutionSteps: string[], context: AgentContext): Promise<string> {
    try {
      if (!this.aiModelsService.isModelAvailable(AIModelProvider.QWEN)) {
        throw new Error('Qwen模型未配置');
      }

      const systemPrompt = `你是高等数学解题结果审核专家。请使用Self-Consistency方法验证并输出最终答案。

## 任务流程
1. 审阅以下所有解题步骤，检查每一步的逻辑连贯性和数学正确性
2. 使用至少一种替代方法（如逆向运算）验证最终结果
3. 若发现不一致，指出问题并提供修正
4. 输出最终的LaTeX格式答案

## 自一致性验证规则(Self-Consistency Protocol)
- 对导数题：对原函数求导后再积分验证，或使用极限定义验证
- 对积分题：对原函数求导验证是否等于被积函数
- 对极限题：将答案代入原式验证或使用替代方法重算
- 对方程题：将解代入原方程验证

## 输出格式
只输出JSON（不要markdown标记）：
{
  "final_answer_latex": "LaTeX格式的最终答案",
  "verification_method": "使用的验证方法说明",
  "verification_result": "验证结果（通过/修正/不确定）",
  "consistency_score": "自一致性评分(0.0-1.0)",
  "alternative_answers": ["若存在替代可能的答案"]
}

## 注意事项
- 积分不定积分必须包含积分常数C
- 定积分结果必须是确定数值
- 级数收敛需标明收敛范围
- 若无法得出确切答案，请说明原因而非编造

解题步骤记录:
${solutionSteps.join('\n---\n')}

原始问题: ${problem}`;

      const response = await this.aiModelsService.chat(AIModelProvider.QWEN, {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请审核以上解题过程，提取并验证最终答案：\n${problem}` },
        ],
        temperature: 0.05,
        maxTokens: 1024,
      });

      let answer = response.content || '';
      const parsedAnswer = extractAiJson(answer);
      if (parsedAnswer?.final_answer_latex) {
        return parsedAnswer.final_answer_latex;
      }

      answer = answer.replace(/^[`\s]*|[`\s]*$/g, '').replace(/\n/g, ' ').trim();
      return answer.length > 500 ? answer.substring(0, 500) : (answer || '无法生成最终答案');
    } catch (error) {
      this.logger.warn('Qwen AI生成最终答案失败', error.message);
      throw error;
    }
  }
}
