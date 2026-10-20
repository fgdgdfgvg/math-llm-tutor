import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { IsOptional, IsString, IsIn } from 'class-validator';
import {
  describeErrorForLog,
  describeHttpError,
} from '../../common/utils/redact';

export class SolveProblemDto {
  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsString()
  problem?: string;

  @IsOptional()
  @IsString()
  @IsIn(['DeepSeek', 'KatCoder'])
  model?: 'DeepSeek' | 'KatCoder';
}

interface KnowledgePoint {
  id: string;
  name: string;
  description: string;
  formula?: string;
  latex?: string;
  difficulty: string;
  tags: string[];
}

interface StructuredSolution {
  solutionSteps: string;
  knowledgeAnalysis: string;
  finalAnswer: string;
}

@Injectable()
export class AiSolverService {
  private readonly logger = new Logger(AiSolverService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly knowledgeService: KnowledgeService,
  ) {}

  async solve(solveProblemDto: SolveProblemDto): Promise<any> {
    const { prompt, problem, model } = solveProblemDto;
    const actualPrompt = prompt || problem || '';
    const actualModel = model || 'DeepSeek';

    if (!actualPrompt || actualPrompt.trim() === '') {
      throw new BadRequestException('问题内容不能为空');
    }

    const knowledgePoints = await this.findRelevantKnowledge(actualPrompt);

    const apiKey =
      actualModel === 'DeepSeek'
        ? this.configService.get<string>('DEEPSEEK_API_KEY')
        : this.configService.get<string>('KATCODER_API_KEY');

    const baseUrl =
      actualModel === 'DeepSeek'
        ? this.configService.get<string>('DEEPSEEK_BASE_URL')
        : this.configService.get<string>('KATCODER_BASE_URL');

    if (!apiKey || !baseUrl) {
      // 未配置大模型密钥时返回 503（而非 500），前端据此提示用户改用智能体模式，
      // 智能体模式完全依赖本地 SymPy 计算，无需任何 API Key
      const envKey =
        actualModel === 'DeepSeek' ? 'DEEPSEEK_API_KEY' : 'KATCODER_API_KEY';
      throw new ServiceUnavailableException(
        `AI 模型（${actualModel}）未配置：请在后端 .env 中设置 ${envKey}，或改用「智能体模式」（无需 API Key）`,
      );
    }

    // 模型名：优先环境变量，其次按服务商给默认值。
    // 注意：不同服务商的模型命名不同——DeepSeek 官方用 deepseek-chat/deepseek-reasoner，
    // SiliconFlow 网关用 deepseek-ai/DeepSeek-V3。默认走 SiliconFlow 命名以匹配默认 baseUrl，
    // 若 baseUrl 指向官方端点，务必同步设置 DEEPSEEK_MODEL=deepseek-chat（否则 404）。
    const modelId =
      actualModel === 'DeepSeek'
        ? this.configService.get<string>('DEEPSEEK_MODEL') ||
          'deepseek-ai/DeepSeek-V3'
        : this.configService.get<string>('KATCODER_MODEL') ||
          'katcoder-math-v1';

    const requestUrl = `${baseUrl}/chat/completions`;

    const knowledgeContext = this.buildKnowledgeContext(knowledgePoints);

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    const systemPrompt = `你是一个专业的数学辅导AI助手，具有丰富的高等数学教学经验。请使用思维链(Chain of Thought)方法，用中文逐步解答用户提出的数学问题。

【思维链解题要求】
你必须遵循4阶段推理流程：
1. 问题理解：明确题目要求、识别关键条件、分析题目类型
2. 策略制定：列举至少2种可行解法，选择最优方案并说明理由
3. 逐步执行：按选定方法逐步计算，每一步标注使用的公式/定理
4. 自我验证：使用替代方法（代入验证/逆向运算）确认结果的正确性

${knowledgeContext}

【重要】你必须严格按照以下JSON格式返回结果，不要包含任何其他说明文字：

{
  "solution_steps": "这里是详细的解题步骤，每一步都要清晰说明操作和理由，用换行分隔每个步骤。必须包含思维链推理过程",
  "knowledge_analysis": "这里是与本题相关的知识点分析（必须达到300字以上），需要包含以下内容：\\n\\n【核心概念】详细解释题目涉及的核心数学概念，包括定义、数学表达、几何意义等。\\n\\n【关键特征】分析概念的关键特征和性质，如连续性、可导性、收敛性等。\\n\\n【解题方法】总结本题使用的解题方法和技巧，说明为什么选择这种方法。\\n\\n【相关知识点】列出与此题相关的其他知识点，说明它们之间的联系。\\n\\n【常见错误】分析学生容易犯的错误类型，给出预防建议。\\n\\n【应用场景】说明这些知识点在实际问题中的应用场景。",
  "final_answer": "最终答案（简洁明了的LaTeX格式）",
  "self_check": "自我验证过程和结论",
  "confidence": "对答案确信度的评估(0.0-1.0)"
}

注意：
- solution_steps 应该包含完整的解题过程和思维链推理，每一步都要清晰
- knowledge_analysis 必须详细，至少300字，包含核心概念、关键特征、解题方法、相关知识点、常见错误、应用场景六个部分
- 如果是计算题，final_answer 只写最终结果
- 绝不编造定理或公式，只使用标准高等数学教材中确认存在的定理
- 积分题必须检查积分常数C（不定积分）或积分限（定积分）`;

    const body = {
      model: modelId,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: actualPrompt,
        },
      ],
    };

    this.logger.log(`Sending request to ${modelId} at ${requestUrl}`);

    try {
      const response = await firstValueFrom(
        this.httpService.post(requestUrl, body, {
          headers,
          timeout: 60000,
        }),
      );

      this.logger.log('Successfully received response from AI API.');

      const aiContent = response.data.choices?.[0]?.message?.content || '';
      const structuredResult = this.parseStructuredResponse(aiContent);

      return {
        ...response.data,
        knowledgePoints,
        structuredResult,
        solutionSteps: structuredResult.solutionSteps,
        knowledgeAnalysis: structuredResult.knowledgeAnalysis,
        finalAnswer: structuredResult.finalAnswer,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      // 旧实现打印 axiosError.stack 与整个 response.data：前者可能带局部变量快照，
      // 后者会把上游原始报文（含回显的请求头）写进日志；
      // 抛给客户端的 message 里也原样带了上游响应体 —— 属于信息泄露。
      // 统一改为脱敏摘要上游只保留状态码与错误码。
      this.logger.error(
        `Failed to call AI API: ${describeErrorForLog(axiosError)}`,
      );

      if (axiosError.response) {
        const summary = describeHttpError(axiosError);
        throw new InternalServerErrorException(
          `AI服务返回错误${summary.status ? `（HTTP ${summary.status}）` : ''}${summary.upstreamCode ? ` [${summary.upstreamCode}]` : ''}`,
        );
      }

      if (axiosError.code === 'ECONNABORTED') {
        throw new InternalServerErrorException('AI服务请求超时，请稍后重试');
      }

      throw new InternalServerErrorException(
        `AI服务调用失败: ${axiosError.message}`,
      );
    }
  }

  private parseStructuredResponse(content: string): StructuredSolution {
    let solutionSteps = '';
    let knowledgeAnalysis = '';
    let finalAnswer = '';

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        solutionSteps = parsed.solution_steps || parsed.solutionSteps || '';
        knowledgeAnalysis =
          parsed.knowledge_analysis || parsed.knowledgeAnalysis || '';
        finalAnswer = parsed.final_answer || parsed.finalAnswer || '';
      }
    } catch (e) {
      this.logger.warn('Failed to parse JSON, using fallback parsing');

      const stepsMatch = content.match(
        /(?:solution_steps|解题步骤)[：:]\s*([\s\S]*?)(?=(?:knowledge_analysis|知识点|final_answer|最终答案|常见易错点)|$)/i,
      );
      if (stepsMatch) {
        solutionSteps = stepsMatch[1].trim();
      }

      const knowledgeMatch = content.match(
        /(?:knowledge_analysis|知识点分析|涉及知识点)[：:]\s*([\s\S]*?)(?=(?:final_answer|最终答案)|$)/i,
      );
      if (knowledgeMatch) {
        knowledgeAnalysis = knowledgeMatch[1].trim();
      }

      const answerMatch = content.match(
        /(?:final_answer|最终答案)[：:]\s*([\s\S]*?)(?=##|$)/i,
      );
      if (answerMatch) {
        finalAnswer = answerMatch[1].trim();
      }

      if (!solutionSteps && !knowledgeAnalysis) {
        const sections = content.split(/##\s*/);
        for (const section of sections) {
          if (section.includes('解题步骤') || section.includes('步骤')) {
            solutionSteps = section.replace(/解题步骤[：:]?\s*/, '').trim();
          } else if (section.includes('知识点') || section.includes('分析')) {
            knowledgeAnalysis = section
              .replace(/知识点[分析]*[：:]?\s*/, '')
              .trim();
          }
        }
      }

      if (!solutionSteps && !knowledgeAnalysis) {
        solutionSteps = content;
      }
    }

    if (!knowledgeAnalysis || knowledgeAnalysis.length < 100) {
      knowledgeAnalysis = this.generateDefaultKnowledgeAnalysis(solutionSteps);
    }

    return {
      solutionSteps,
      knowledgeAnalysis,
      finalAnswer,
    };
  }

  private generateDefaultKnowledgeAnalysis(solutionSteps: string): string {
    const keywords = this.extractKeywords(solutionSteps);
    let analysis = '【知识点分析】\n\n';

    if (keywords.includes('极限')) {
      analysis += `【核心概念】极限是微积分的基础概念，描述函数在某点附近的行为趋势。当自变量无限接近某一点时，函数值无限接近一个确定的常数。\n\n`;
      analysis += `【关键特征】极限存在的充要条件是左右极限存在且相等。常见的极限类型包括确定型极限和未定式极限（如0/0、∞/∞型）。\n\n`;
      analysis += `【解题方法】求极限的常用方法包括：直接代入法、因式分解法、有理化法、等价无穷小替换、洛必达法则、泰勒展开等。\n\n`;
    }

    if (keywords.includes('导数') || keywords.includes('求导')) {
      analysis += `【核心概念】导数表示函数在某点的瞬时变化率，几何意义是曲线在该点切线的斜率。导数的本质是差商的极限。\n\n`;
      analysis += `【关键特征】函数可导必连续，但连续不一定可导。可导点处函数曲线是光滑的，没有尖点。\n\n`;
      analysis += `【解题方法】求导的基本方法包括：利用基本求导公式、链式法则（复合函数求导）、乘积法则、商法则、隐函数求导等。\n\n`;
    }

    if (keywords.includes('积分')) {
      analysis += `【核心概念】积分是导数的逆运算，分为不定积分和定积分。不定积分求原函数，定积分计算曲线下的面积。\n\n`;
      analysis += `【关键特征】不定积分的结果包含积分常数C。定积分的值与积分变量符号无关，只与被积函数和积分区间有关。\n\n`;
      analysis += `【解题方法】积分的基本方法包括：直接积分法、换元积分法（第一类和第二类）、分部积分法、有理函数积分等。\n\n`;
    }

    if (keywords.includes('洛必达')) {
      analysis += `【核心概念】洛必达法则是处理0/0型或∞/∞型未定式极限的重要工具，通过将分子分母分别求导来简化极限计算。\n\n`;
      analysis += `【关键特征】使用洛必达法则前必须确认是未定式，且分子分母在去心邻域内可导。可以多次使用直到不再是未定式。\n\n`;
      analysis += `【解题方法】洛必达法则的使用步骤：1) 确认是0/0或∞/∞型未定式；2) 对分子分母分别求导；3) 计算新的极限；4) 如仍为未定式则重复步骤。\n\n`;
    }

    if (keywords.includes('泰勒') || keywords.includes('级数')) {
      analysis += `【核心概念】泰勒级数是用多项式逼近函数的重要工具。函数在某点的泰勒展开式包含了该点的所有导数信息，可以用于近似计算和极限求解。\n\n`;
      analysis += `【关键特征】泰勒级数的收敛性取决于函数的解析性和展开点的选择。收敛半径决定了级数的有效范围。\n\n`;
      analysis += `【解题方法】泰勒展开的关键步骤：1) 选择合适的展开点；2) 计算各阶导数；3) 写出泰勒级数；4) 确定收敛域。\n\n`;
    }

    if (!analysis.includes('核心概念')) {
      analysis = `【核心概念】本题涉及高等数学的基本概念和方法。理解这些概念的定义、性质和应用是解题的关键。\n\n`;
      analysis += `【关键特征】数学概念之间往往存在内在联系，掌握这些联系有助于深入理解问题本质。\n\n`;
      analysis += `【解题方法】解题时要遵循规范的步骤：理解题意、分析条件、选择方法、逐步求解、验证结果。\n\n`;
    }

    analysis += `【常见错误】学生在解题时常犯的错误包括：概念理解不清、公式记忆错误、计算粗心、步骤遗漏等。建议多练习基础题目，加深概念理解。\n\n`;
    analysis += `【应用场景】这些知识点在物理学、工程学、经济学等领域有广泛应用，如速度与加速度的计算、面积和体积的求解、最优化问题等。`;

    return analysis;
  }

  private async findRelevantKnowledge(
    prompt: string,
  ): Promise<KnowledgePoint[]> {
    const keywords = this.extractKeywords(prompt);
    const allConcepts = await this.knowledgeService.getAllConcepts();

    const relevantConcepts = allConcepts.filter((concept) => {
      const conceptText =
        `${concept.name} ${concept.description} ${(concept.tags || []).join(' ')}`.toLowerCase();
      return keywords.some((keyword) =>
        conceptText.includes(keyword.toLowerCase()),
      );
    });

    return relevantConcepts.slice(0, 5);
  }

  private extractKeywords(prompt: string): string[] {
    const mathKeywords = [
      '极限',
      '导数',
      '积分',
      '微分',
      '级数',
      '泰勒',
      '洛必达',
      '连续',
      '函数',
      '方程',
      '不等式',
      '矩阵',
      '行列式',
      'limit',
      'derivative',
      'integral',
      'lim',
      'dx',
      '求导',
      '微积分',
      '链式法则',
      '复合函数',
    ];

    const foundKeywords: string[] = [];
    const lowerPrompt = prompt.toLowerCase();

    for (const keyword of mathKeywords) {
      if (lowerPrompt.includes(keyword.toLowerCase())) {
        foundKeywords.push(keyword);
      }
    }

    return foundKeywords;
  }

  private buildKnowledgeContext(knowledgePoints: KnowledgePoint[]): string {
    if (knowledgePoints.length === 0) {
      return '';
    }

    const context = knowledgePoints
      .map((kp) => {
        let info = `【${kp.name}】\n定义: ${kp.description}`;
        if (kp.formula) info += `\n公式: ${kp.formula}`;
        if (kp.latex) info += `\nLaTeX: ${kp.latex}`;
        return info;
      })
      .join('\n\n');

    return `相关知识点参考:\n${context}`;
  }
}
