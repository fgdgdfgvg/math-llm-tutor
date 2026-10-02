import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BaseAgent } from '../agent.base';
import { AgentInput, AgentContext, SolvePlan } from '../agent.types';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { AIModelsService } from '../ai-models.service';
import { AIModelProvider } from '../ai-models.types';
import { extractAiJson } from '../ai-json.utils';
import { describeErrorForLog } from '../../../common/utils/redact';

// 规划智能体
export class PlannerAgent extends BaseAgent {
  constructor(
    config: any,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly knowledgeService: KnowledgeService,
    private readonly aiModelsService: AIModelsService,
  ) {
    super(config);
  }

  protected async process(input: AgentInput, context: AgentContext): Promise<SolvePlan> {
    const { problem } = input;

    // 1. 提取相关知识点（始终执行，不依赖AI）
    const knowledgePoints = await this.extractKnowledgePoints(problem);
    context.knowledgePoints = knowledgePoints;

    // 2. 使用AI分析题目类型和关键条件（有AI则用AI，无AI则用规则引擎）
    const plan = await this.generateSolvePlan(problem, knowledgePoints);
    this.logger.log(`Plan: ${JSON.stringify(plan)}`);
    context.plan = plan;

    return plan;
  }

  // 提取相关知识点（增强版：深度分析 + 知识图谱集成）
  private async extractKnowledgePoints(problem: string): Promise<any[]> {
    try {
      const keywords = this.extractKeywords(problem);
      const problemType = this.classifyProblemType(problem);

      if (keywords.length === 0) {
        this.logger.warn('未提取到关键词，使用问题类型作为知识检索');
        return await this.searchKnowledgeByProblemType(problemType, problem);
      }

      // 1. 尝试从知识图谱获取知识点
      let knowledgePoints: any[] = [];
      try {
        knowledgePoints = await this.getKnowledgeFromGraph(keywords, problemType);
        if (knowledgePoints.length > 0) {
          this.logger.log(`从知识图谱成功提取${knowledgePoints.length}个知识点`);
          return knowledgePoints;
        }
      } catch (graphError) {
        this.logger.warn('知识图谱查询失败，使用备用方法', graphError.message);
      }

      // 2. 尝试从所有概念中匹配
      const allConcepts = await this.knowledgeService.getAllConcepts();
      if (allConcepts && allConcepts.length > 0) {
        const relevantConcepts = allConcepts.filter((concept: any) => {
          const conceptText = `${concept.name} ${concept.description} ${(concept.tags || []).join(' ')}`.toLowerCase();
          return keywords.some((keyword: string) => conceptText.includes(keyword.toLowerCase()));
        });

        if (relevantConcepts.length > 0) {
          const result = relevantConcepts.slice(0, 5);
          this.logger.log(`从概念库成功提取${result.length}个知识点`);
          return result;
        }
      }

      // 3. 基于问题类型和关键词生成知识点
      this.logger.warn('未匹配到知识点，生成基于问题类型的知识点');
      return this.generateKnowledgePointsByType(problemType, keywords, problem);
    } catch (error) {
      this.logger.warn('提取知识点失败，生成基于规则的fallback', describeErrorForLog(error));
      const keywords = this.extractKeywords(problem);
      const problemType = this.classifyProblemType(problem);
      return this.generateKnowledgePointsByType(problemType, keywords, problem);
    }
  }

  // 根据问题类型搜索知识点
  private async searchKnowledgeByProblemType(problemType: string, problem: string): Promise<any[]> {
    try {
      const searchTerm = this.getProblemTypeKeyword(problemType);
      if (searchTerm) {
        const searchResult = await this.knowledgeService.searchConcepts(searchTerm);
        if (searchResult && Array.isArray(searchResult) && searchResult.length > 0) {
          return searchResult.slice(0, 3);
        }
      }
      return this.generateKnowledgePointsByType(problemType, [], problem);
    } catch (error) {
      return this.generateKnowledgePointsByType(problemType, [], problem);
    }
  }

  // 从知识图谱获取知识点
  private async getKnowledgeFromGraph(keywords: string[], problemType: string): Promise<any[]> {
    const knowledgePoints: any[] = [];
    const usedConcepts = new Set<string>();

    // 优先搜索与问题类型相关的核心知识点
    const typeKeyword = this.getProblemTypeKeyword(problemType);
    if (typeKeyword) {
      try {
        const typeResults = await this.knowledgeService.searchConcepts(typeKeyword);
        if (typeResults && Array.isArray(typeResults)) {
          for (const concept of typeResults) {
            if (!usedConcepts.has(concept.name)) {
              knowledgePoints.push(concept);
              usedConcepts.add(concept.name);
              if (knowledgePoints.length >= 3) break;
            }
          }
        }
      } catch (error) {
        // 忽略错误，继续使用其他关键词
      }
    }

    // 搜索关键词相关的知识点
    for (const keyword of keywords) {
      if (knowledgePoints.length >= 5) break;
      try {
        const results = await this.knowledgeService.searchConcepts(keyword);
        if (results && Array.isArray(results)) {
          for (const concept of results) {
            if (!usedConcepts.has(concept.name)) {
              knowledgePoints.push(concept);
              usedConcepts.add(concept.name);
              if (knowledgePoints.length >= 5) break;
            }
          }
        }
      } catch (error) {
        // 忽略错误，继续下一个关键词
      }
    }

    return knowledgePoints;
  }

  // 根据问题类型生成知识点
  private generateKnowledgePointsByType(problemType: string, keywords: string[], problem: string): any[] {
    const typeBasedKnowledge: Record<string, any[]> = {
      limit: [
        { name: '极限的定义', description: '函数在某点的极限描述了函数值在该点附近的变化趋势', formula: '\\lim_{x \\to a} f(x) = L' },
        { name: '洛必达法则', description: '用于求解0/0或∞/∞型不定式极限', formula: '\\lim \\frac{f(x)}{g(x)} = \\lim \\frac{f\'(x)}{g\'(x)}' },
        { name: '连续性', description: '函数在一点连续要求极限值等于函数值', formula: '\\lim_{x \\to a} f(x) = f(a)' },
      ],
      derivative: [
        { name: '导数的定义', description: '导数表示函数在某一点的瞬时变化率', formula: "f\'(x) = \\lim_{h \\to 0} \\frac{f(x+h)-f(x)}{h}" },
        { name: '幂法则', description: '多项式函数求导的基本法则', formula: "\\frac{d}{dx}(x^n) = nx^{n-1}" },
        { name: '链式法则', description: '复合函数求导的基本方法', formula: '(f(g(x)))\' = f\'(g(x)) \\cdot g\'(x)' },
      ],
      integral: [
        { name: '积分的概念', description: '积分是微分的逆运算，用于计算面积、体积等', formula: '\\int_a^b f(x) dx' },
        { name: '牛顿-莱布尼茨公式', description: '将定积分与原函数联系起来', formula: '\\int_a^b f(x) dx = F(b) - F(a)' },
        { name: '换元积分法', description: '通过变量代换简化积分计算', formula: '\\int f(g(x))g\'(x)dx = \\int f(u)du' },
      ],
      equation: [
        { name: '方程的解', description: '满足方程的未知数的值', formula: '' },
        { name: '一元二次方程', description: '形如ax²+bx+c=0的方程', formula: 'x = \\frac{-b \\pm \\sqrt{b²-4ac}}{2a}' },
        { name: '方程组', description: '由多个方程组成的系统', formula: '' },
      ],
      series: [
        { name: '级数收敛性', description: '无穷级数的和是否存在有限极限', formula: '\\sum_{n=1}^{\\infty} a_n' },
        { name: '泰勒展开', description: '将函数展开为无穷级数形式', formula: 'f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n' },
        { name: '幂级数', description: '形如\\sum a_n(x-a)^n的级数', formula: '' },
      ],
      geometry: [
        { name: '几何图形', description: '点、线、面、体等几何对象', formula: '' },
        { name: '坐标系', description: '用于定位几何对象的参考系', formula: '' },
        { name: '向量', description: '具有大小和方向的量', formula: '\\vec{v} = (v_1, v_2, v_3)' },
      ],
    };

    const points = typeBasedKnowledge[problemType] || typeBasedKnowledge.limit;
    return points.map((kp, index) => ({
      id: `knowledge_${problemType}_${index + 1}`,
      name: kp.name,
      type: 'Concept',
      description: kp.description,
      formula: kp.formula,
      difficulty: 'medium',
      tags: [problemType, ...keywords.slice(0, 2)],
      relevance: 0.8 - index * 0.1, // 相关性递减
    }));
  }

  // 获取问题类型对应的关键词
  private getProblemTypeKeyword(problemType: string): string {
    const typeMap: Record<string, string> = {
      limit: '极限',
      derivative: '导数',
      integral: '积分',
      equation: '方程',
      series: '级数',
      geometry: '几何',
    };
    return typeMap[problemType] || '数学';
  }

  // 通过问题文本搜索知识点
  private async searchKnowledgeByProblem(problem: string): Promise<any[]> {
    try {
      const keywords = this.extractKeywords(problem);
      const results: any[] = [];
      for (const kw of keywords.slice(0, 3)) {
        try {
          const searchResult = await this.knowledgeService.searchConcepts(kw);
          if (searchResult && Array.isArray(searchResult)) {
            results.push(...searchResult.slice(0, 2));
          }
        } catch (e) {
          // 单个关键词搜索失败不影响其他
        }
      }
      return results.length > 0 ? results : this.generateMockKnowledgePoints(keywords, problem);
    } catch (error) {
      return this.generateMockKnowledgePoints(this.extractKeywords(problem), problem);
    }
  }

  // 生成模拟知识点（当知识库不可用时的fallback）
  private generateMockKnowledgePoints(keywords: string[], problem: string): any[] {
    const keywordToKnowledge: Record<string, { name: string; description: string; formula?: string }> = {
      '极限': { name: '极限的定义', description: '函数在某点的极限描述了函数值在该点附近的变化趋势', formula: '\\lim_{x \\to a} f(x) = L' },
      '导数': { name: '导数的定义', description: '导数表示函数在某一点的瞬时变化率', formula: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h)-f(x)}{h}" },
      '积分': { name: '积分的概念', description: '积分是微分的逆运算，用于计算面积、体积等', formula: '\\int_a^b f(x) dx' },
      '级数': { name: '级数收敛性', description: '无穷级数的和是否存在有限极限', formula: '\\sum_{n=1}^{\\infty} a_n' },
      '洛必达': { name: '洛必达法则', description: '用于求解0/0或∞/∞型不定式极限', formula: "\\lim \\frac{f(x)}{g(x)} = \\lim \\frac{f'(x)}{g'(x)}" },
      '泰勒': { name: '泰勒展开', description: '将函数展开为无穷级数形式', formula: 'f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n' },
      '连续': { name: '连续性', description: '函数在一点连续要求极限值等于函数值', formula: '\\lim_{x \\to a} f(x) = f(a)' },
      '链式': { name: '链式法则', description: '复合函数求导的基本方法', formula: '(f(g(x)))\' = f\'(g(x)) \\cdot g\'(x)' },
    };

    const mockPoints: any[] = [];
    const usedNames = new Set<string>();

    for (const kw of keywords) {
      for (const [key, kp] of Object.entries(keywordToKnowledge)) {
        if ((kw.includes(key) || key.includes(kw)) && !usedNames.has(kp.name)) {
          mockPoints.push({
            id: `mock_${kp.name.replace(/\s/g, '_')}`,
            name: kp.name,
            type: 'Concept',
            description: kp.description,
            formula: kp.formula,
            difficulty: 'medium',
            tags: [kw],
          });
          usedNames.add(kp.name);
          break;
        }
      }
    }

    if (mockPoints.length === 0) {
      mockPoints.push({
        id: 'mock_general',
        name: '数学分析基础',
        type: 'Concept',
        description: `针对"${problem.substring(0, 30)}..."的相关数学概念`,
        difficulty: 'medium',
        tags: keywords.slice(0, 3),
      });
    }

    return mockPoints.slice(0, 5);
  }

  // 提取关键词（增强版）
  private extractKeywords(problem: string): string[] {
    const mathKeywords = [
      '极限', '导数', '积分', '微分', '级数', '泰勒', '洛必达', '连续', '函数', '方程',
      '不等式', '矩阵', '行列式', 'limit', 'derivative', 'integral', 'lim', 'dx', '求导', '微积分',
      '链式法则', '复合函数', '偏导数', '多重积分', '微分方程', '概率', '统计', '线性代数',
      'sin', 'cos', 'tan', 'ln', 'log', 'sqrt', 'exp',
    ];

    const foundKeywords: string[] = [];
    const lowerProblem = problem.toLowerCase();

    for (const keyword of mathKeywords) {
      if (lowerProblem.includes(keyword.toLowerCase()) && !foundKeywords.includes(keyword)) {
        foundKeywords.push(keyword);
      }
    }

    return foundKeywords.length > 0 ? foundKeywords : [problem.substring(0, 10)];
  }

  // 生成解题计划（分层规划机制）
  private async generateSolvePlan(problem: string, knowledgePoints: any[]): Promise<SolvePlan> {
    const problemType = this.classifyProblemType(problem);

    try {
      if (this.aiModelsService.isModelAvailable(AIModelProvider.HUGGINGFACE)) {
        const knowledgeContext = this.buildKnowledgeContext(knowledgePoints);
        const systemPrompt = `你是一个专业的数学问题分析专家，使用分层规划方法分析题目。

${knowledgeContext}

请分析以下数学题目并输出JSON格式结果，包含三级规划体系：
{
  "problemType": "题目类型",
  "keyConditions": ["关键条件1", "关键条件2"],
  "macroStrategy": "宏观策略",
  "steps": [{
    "id": "step1", 
    "description": "中观步骤", 
    "tool": "sympy或llm",
    "microOperations": ["微观操作1", "微观操作2"]
  }],
  "estimatedDifficulty": "easy/medium/hard",
  "alternativeApproaches": ["替代方法1", "替代方法2"]
}

问题: ${problem}`;

        const response = await this.aiModelsService.chat(AIModelProvider.HUGGINGFACE, {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: problem },
          ],
          temperature: 0.3,
        });

        const aiContent = response.content || '';
        const plan = this.parsePlan(aiContent);
        this.logger.log(`AI(HuggingFace-MiniMax)生成解题计划成功: ${plan.problemType}, ${plan.steps.length}步`);
        return plan;
      }
    } catch (error) {
      this.logger.warn('HuggingFace AI生成计划失败，使用规则引擎', error.message);
    }

    // 规则引擎Fallback（不依赖AI）
    const ruleBasedPlan = this.getRuleBasedSolvePlan(problem, problemType, knowledgePoints);
    this.logger.log(`使用规则引擎生成计划: ${ruleBasedPlan.problemType}, ${ruleBasedPlan.steps.length}步`);
    return ruleBasedPlan;
  }

  // 基于规则的题目分类
  private classifyProblemType(problem: string): string {
    const p = problem.toLowerCase();

    if (p.includes('极限') || p.includes('limit') || p.includes('lim')) return 'limit';
    if (p.includes('导数') || p.includes('derivative') || p.includes('求导') || p.includes('微分')) return 'derivative';
    if (p.includes('积分') || p.includes('integral') || p.includes('∫')) return 'integral';
    if (p.includes('级数') || p.includes('series') || p.includes('sum')) return 'series';
    if (p.includes('方程') || p.includes('equation') || p.includes('solve')) return 'equation';
    if (p.includes('证明') || p.includes('proof') || p.includes('prove')) return 'proof';
    if (p.includes('几何') || p.includes('geometry') || p.includes('shape')) return 'geometry';

    return 'general';
  }

  // 基于规则的解题计划生成器（核心fallback，支持分层规划）
  private getRuleBasedSolvePlan(problem: string, problemType: string, knowledgePoints: any[]): SolvePlan {
    const keyConditions = this.extractKeyConditions(problem);

    const planTemplates: Record<string, any> = {
      limit: {
        macroStrategy: '识别极限类型，应用适当方法求解，验证结果',
        steps: [
          {
            id: 'step1', 
            description: '识别极限类型与不定式形式', 
            tool: 'llm', 
            expectedOutput: '确定是0/0、∞/∞或其他类型',
            microOperations: ['分析函数结构', '代入趋近值判断不定式类型', '确定适用的求解方法']
          },
          {
            id: 'step2', 
            description: '应用适当的极限求解方法', 
            tool: 'sympy', 
            expectedOutput: '化简后的表达式',
            microOperations: ['应用洛必达法则或等价无穷小替换', '进行代数化简', '检查化简结果']
          },
          {
            id: 'step3', 
            description: '代入极限值计算最终结果', 
            tool: 'sympy', 
            expectedOutput: '数值或表达式结果',
            microOperations: ['代入极限值', '计算最终结果', '检查结果的合理性']
          },
          {
            id: 'step4', 
            description: '验证结果的合理性', 
            tool: 'llm', 
            expectedOutput: '确认答案正确',
            microOperations: ['反向验证', '检查特殊情况', '确认结果符合数学原理']
          },
        ],
        alternativeApproaches: ['洛必达法则', '等价无穷小替换', '重要极限公式']
      },
      derivative: {
        macroStrategy: '分析函数结构，应用求导法则，化简结果',
        steps: [
          {
            id: 'step1', 
            description: '识别待求导函数及其类型', 
            tool: 'llm', 
            expectedOutput: '明确函数结构',
            microOperations: ['识别函数类型', '分析复合结构', '确定需要的求导法则']
          },
          {
            id: 'step2', 
            description: '应用求导法则（基本/链式/乘积/商）', 
            tool: 'sympy', 
            expectedOutput: '导函数表达式',
            microOperations: ['应用基本求导公式', '使用链式法则处理复合函数', '处理乘积或商的导数']
          },
          {
            id: 'step3', 
            description: '化简导函数表达式', 
            tool: 'sympy', 
            expectedOutput: '最简形式的导数',
            microOperations: ['合并同类项', '因式分解', '整理表达式']
          },
        ],
        alternativeApproaches: ['直接求导', '对数求导法', '隐函数求导法']
      },
      integral: {
        macroStrategy: '分析被积函数，选择积分方法，验证结果',
        steps: [
          {
            id: 'step1', 
            description: '分析被积函数的结构特点', 
            tool: 'llm', 
            expectedOutput: '识别积分类型',
            microOperations: ['识别被积函数类型', '分析结构特点', '确定积分方法']
          },
          {
            id: 'step2', 
            description: '选择合适的积分方法', 
            tool: 'llm', 
            expectedOutput: '换元/分部/部分分式等',
            microOperations: ['选择换元法/分部积分法/部分分式分解', '确定变量替换', '制定积分策略']
          },
          {
            id: 'step3', 
            description: '执行积分运算', 
            tool: 'sympy', 
            expectedOutput: '原函数+常数C',
            microOperations: ['执行积分运算', '添加积分常数C', '检查积分过程']
          },
          {
            id: 'step4', 
            description: '验证结果（对原函数求导）', 
            tool: 'sympy', 
            expectedOutput: '确认还原被积函数',
            microOperations: ['对原函数求导', '验证是否等于被积函数', '修正可能的错误']
          },
        ],
        alternativeApproaches: ['换元积分法', '分部积分法', '部分分式分解']
      },
      general: {
        macroStrategy: '理解题意，选择方法，执行计算，验证结果',
        steps: [
          {
            id: 'step1', 
            description: '理解题意并明确已知条件和目标', 
            tool: 'llm', 
            expectedOutput: '问题拆解',
            microOperations: ['分析题目要求', '提取已知条件', '明确求解目标']
          },
          {
            id: 'step2', 
            description: '选择适用的数学方法和公式', 
            tool: 'llm', 
            expectedOutput: '方法选择',
            microOperations: ['回忆相关数学知识', '选择合适的方法', '确定计算公式']
          },
          {
            id: 'step3', 
            description: '执行计算或推理过程', 
            tool: 'sympy', 
            expectedOutput: '中间结果',
            microOperations: ['执行具体计算', '进行逻辑推理', '记录中间步骤']
          },
          {
            id: 'step4', 
            description: '整理并验证最终答案', 
            tool: 'llm', 
            expectedOutput: '最终结论',
            microOperations: ['整理计算结果', '验证答案正确性', '给出最终结论']
          },
        ],
        alternativeApproaches: ['直接计算', '代数方法', '几何方法']
      },
    };

    const template = planTemplates[problemType] || planTemplates.general;
    const difficultyMap: Record<string, SolvePlan['estimatedDifficulty']> = {
      limit: problem.includes('∞') ? 'hard' : 'medium',
      derivative: problem.includes('隐函数') || problem.includes('参数') ? 'hard' : 'easy',
      integral: problem.includes('广义') || problem.includes('瑕') ? 'hard' : 'medium',
    };

    return {
      problemType: this.getTypeLabel(problemType),
      keyConditions: keyConditions.length > 0 ? keyConditions : [problem],
      macroStrategy: template.macroStrategy,
      steps: template.steps,
      estimatedDifficulty: difficultyMap[problemType] || 'medium',
      alternativeApproaches: template.alternativeApproaches,
    };
  }

  private getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      limit: '极限计算', derivative: '导数求解', integral: '积分计算',
      series: '级数求和', equation: '方程求解', proof: '数学证明',
      geometry: '几何问题', general: '综合数学问题',
    };
    return labels[type] || '数学问题';
  }

  // 提取关键条件（过滤掉动词残渣与超长片段）
  private extractKeyConditions(problem: string): string[] {
    const conditions: string[] = [];

    // 先按常见动词切分，去掉「求/计算/解」等引导词带来的残渣（如「导：x^3」）
    const cleaned = problem
      .replace(/(?:请|尝试|帮我|谢谢)/g, '')
      .replace(/(?:求导数|求导|求积分|计算积分|求极限|计算极限|解方程|求解|计算|求|证明|判断)/g, '，');

    const patterns = [
      /(?:x|t|n)\s*[→⇒]\s*([^\s,，。]+)/gi,
      /\(([^()]{2,30})\)/g,
      /[\^_{}]|\\frac|\\lim|\\int|[0-9a-zA-Z]+\s*[+\-*/=]/g,
    ];

    // 等式/表达式片段（含数学符号的短片段才是真正的「关键条件」）
    for (const segment of cleaned.split(/[,，。;；\n]/)) {
      const trimmed = segment.trim();
      if (trimmed.length >= 2 && trimmed.length <= 30 && /[0-9a-zA-Z^=+\-*/∫√]/.test(trimmed)) {
        conditions.push(trimmed);
      }
    }

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(problem)) !== null) {
        if (match[1] && match[1].length < 30) {
          conditions.push(match[1].trim());
        }
      }
    }

    const deduped = [...new Set(conditions)].filter((c) => !/^[：:，,。;；\s]+$/.test(c));
    return deduped.slice(0, 4);
  }

  // 解析解题计划（健壮版）
  private parsePlan(content: string): SolvePlan {
    const parsed = extractAiJson(content);
    if (parsed) {
      return {
        problemType: parsed.problemType || '未知类型',
        keyConditions: Array.isArray(parsed.keyConditions) ? parsed.keyConditions.map(String) : [],
        macroStrategy: parsed.macroStrategy || '标准解题策略',
        steps: parsed.steps?.map((s: any, i: number) => ({
          id: s.id || `step${i + 1}`,
          description: s.description || `步骤${i + 1}`,
          tool: s.tool || 'llm',
          expectedOutput: s.expectedOutput || '',
          microOperations: s.microOperations || [],
        })) || [],
        estimatedDifficulty: parsed.estimatedDifficulty || 'medium',
        alternativeApproaches: parsed.alternativeApproaches || [],
      };
    }

    this.logger.warn(`解析解题计划失败，无法从 AI 输出提取 JSON，使用规则引擎（前 200 字符: ${String(content).slice(0, 200).replace(/\s+/g, ' ')}）`);
    return this.getRuleBasedSolvePlan(content, this.classifyProblemType(content), []);
  }

  // 构建知识上下文
  private buildKnowledgeContext(knowledgePoints: any[]): string {
    if (!knowledgePoints || knowledgePoints.length === 0) return '';

    return knowledgePoints
      .slice(0, 3)
      .map((kp: any) => {
        let info = `【${kp.name}】${kp.description}`;
        if (kp.formula) info += `\n公式: ${kp.formula}`;
        return info;
      })
      .join('\n\n');
  }
}
