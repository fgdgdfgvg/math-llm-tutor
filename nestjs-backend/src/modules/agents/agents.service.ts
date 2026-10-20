import { Injectable, Logger, Optional } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AgentOrchestrator, AgentProgressEvent } from './agent.orchestrator';
import { AgentInput, MultiAgentResult } from './agent.types';
import { UserProfilingService } from '../../common/services/user-profiling.service';
import { LocalComputationService } from './local-computation/local-computation.service';
import { AnswerEquivalenceService } from './answer-equivalence.service';
import { SolutionVerificationService } from './solution-verification.service';
import { describeErrorForLog } from '../../common/utils/redact';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    private readonly orchestrator: AgentOrchestrator,
    @Optional() private readonly userProfilingService?: UserProfilingService,
    @Optional()
    private readonly localComputationService?: LocalComputationService,
    @Optional()
    private readonly answerEquivalenceService?: AnswerEquivalenceService,
    @Optional()
    private readonly solutionVerificationService?: SolutionVerificationService,
  ) {}

  // 执行多智能体协作解题
  async solveProblem(
    problem: string,
    userId?: string,
  ): Promise<MultiAgentResult> {
    this.logger.log(`开始执行多智能体协作解题: ${problem.substring(0, 50)}...`);

    const startTime = Date.now();
    const input: AgentInput = {
      problem,
      metadata: {
        timestamp: startTime,
        requestId: this.generateRequestId(),
      },
    };

    if (this.userProfilingService && userId) {
      this.userProfilingService.getOrCreateProfile(userId, {
        nickname: `user_${userId}`,
      });
      const difficulty = this.userProfilingService.getAdaptiveDifficulty(
        userId,
        'general',
      );
      if (input.metadata) {
        input.metadata.difficulty = difficulty;
      }
    }

    try {
      const result = await this.orchestrator.execute(input);
      this.attachVerification(problem, result);
      this.logger.log(`多智能体协作解题完成，状态: ${result.status}`);

      this.orchestrator.progressEvents.next({
        type: 'complete',
        message: '解题完成',
        timestamp: Date.now(),
        data: result,
      });

      if (this.userProfilingService && userId) {
        const timeSpent = Date.now() - startTime;
        const category = result.knowledgePoints?.[0]?.name || 'general';
        const isCorrect = result.status === 'success';

        this.userProfilingService.recordPerformance(userId, {
          timestamp: Date.now(),
          problemCategory: category,
          problem,
          answer: result.finalAnswer || '',
          isCorrect,
          timeSpent,
          confidence: isCorrect ? 0.8 : 0.4,
          hintsUsed: 0,
        });
      }

      return result;
    } catch (error) {
      this.logger.error('多智能体协作解题失败', describeErrorForLog(error));

      this.orchestrator.progressEvents.next({
        type: 'agent_error',
        message: `解题失败: ${error.message}`,
        timestamp: Date.now(),
      });

      throw error;
    }
  }

  /**
   * Verifier 自校验闭环（代码审阅 2.9）：
   * 把最终答案代回原题，用数值/符号证据替换“让 LLM 自己检查自己”的软验证。
   * 校验失败不改变解题状态，只作为硬证据附加到 verificationResults（前端显示徽章）。
   */
  private attachVerification(problem: string, result: MultiAgentResult): void {
    if (!this.solutionVerificationService || !result?.finalAnswer) return;
    try {
      const report = this.solutionVerificationService.verifyByProblemText(
        problem,
        result.finalAnswer,
      );
      if (report.checks.length === 0) return;

      const existing = (result.verificationResults || []).filter(
        (item) => !item.stepId?.startsWith('verifier:'),
      );
      result.verificationResults = [
        ...existing,
        ...this.solutionVerificationService.toVerificationResults(report),
      ];
      const summary = report.checks
        .map((check) => `${check.kind}:${check.passed ? '通过' : '未通过'}`)
        .join('、');
      this.logger.log(
        `Verifier 自校验（${summary}）：${report.checks[0].summary}`,
      );
    } catch (error) {
      // 自校验是增强能力，异常不应影响解题主流程
      this.logger.warn(`Verifier 自校验异常（已忽略）: ${error.message}`);
    }
  }

  async diagnoseStudentAnswer(input: {
    problem: any;
    studentAnswer: string;
    solution?: any;
  }) {
    const problem =
      typeof input.problem === 'string'
        ? input.problem
        : input.problem?.originalText || input.problem?.content || '';
    const studentAnswer = input.studentAnswer || '';
    let expectedAnswer = input.solution?.finalAnswer || '';
    if (!expectedAnswer && this.localComputationService) {
      const solution = await this.localComputationService.solveProblem(problem);
      expectedAnswer = solution.finalAnswer;
    }
    // 等价判定交给 AnswerEquivalenceService（精确多项式差 → 解集 → 数值抽样）。
    // 仅有字符串比较时，`x+1` 与 `1+x`、`(x-1)(x+1)` 与 `x²-1` 都会被误判为错误。
    const equivalence = this.answerEquivalenceService
      ? this.answerEquivalenceService.compare(studentAnswer, expectedAnswer)
      : null;

    if (!equivalence) {
      const normalize = (value: string) =>
        value
          .toLowerCase()
          .replace(/\\left|\\right/g, '')
          .replace(/\\frac\\{([^}]+)\\}\\{([^}]+)\\}/g, '($1)/($2)')
          .replace(/[{}$\\\s]/g, '')
          .replace(/[，。；：]/g, '')
          .replace(/答案[:：=]/g, '');
      const isCorrect = normalize(studentAnswer) === normalize(expectedAnswer);
      return {
        isCorrect,
        expectedAnswer,
        studentAnswer,
        verdict: isCorrect ? 'correct' : 'incorrect',
        confidence: expectedAnswer ? 0.6 : 0.4,
        message: isCorrect
          ? '答案正确'
          : `答案不一致，参考答案为：${expectedAnswer || '暂无'}`,
        details: isCorrect
          ? ['答案与计算结果一致']
          : ['请检查表达式、符号和常数项'],
      };
    }

    const isCorrect =
      equivalence.verdict === 'correct' || equivalence.verdict === 'equivalent';
    const message =
      equivalence.verdict === 'correct' || equivalence.verdict === 'equivalent'
        ? '答案正确'
        : equivalence.verdict === 'unknown'
          ? `无法自动判定，请对照参考答案自行核对：${expectedAnswer || '暂无'}`
          : `答案不一致，参考答案为：${expectedAnswer || '暂无'}`;

    return {
      isCorrect,
      expectedAnswer,
      studentAnswer,
      verdict: equivalence.verdict,
      confidence: expectedAnswer ? equivalence.confidence : 0.4,
      message,
      details: equivalence.evidence,
    };
  }

  async generateStudentFeedback(input: {
    problem: any;
    studentAnswer: string;
    diagnosis?: any;
  }) {
    const diagnosis =
      input.diagnosis || (await this.diagnoseStudentAnswer(input));
    return {
      isCorrect: diagnosis.isCorrect,
      summary: diagnosis.isCorrect
        ? '解答正确，继续保持。'
        : '解答需要进一步检查。',
      suggestions: diagnosis.isCorrect
        ? ['可以尝试使用另一种方法验证结果。']
        : [
            '重新识别题型并列出已知条件。',
            '逐步检查代数运算和边界条件。',
            `参考答案：${diagnosis.expectedAnswer || '暂无'}`,
          ],
      nextSteps: diagnosis.isCorrect
        ? ['挑战更高难度的同类题。']
        : ['查看完整解题步骤后重新作答。'],
      diagnosis,
    };
  }

  getProgressEvents(): Observable<AgentProgressEvent> {
    return this.orchestrator.progressEvents.asObservable();
  }

  // 生成请求ID
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 获取智能体状态
  getAgentStatus() {
    const agents = this.orchestrator.getAgents();
    return agents.map((agent) => ({
      name: agent.name,
      config: agent.getConfig(),
    }));
  }

  // 更新智能体配置
  updateAgentConfig(agentName: string, config: any) {
    const agent = this.orchestrator.getAgent(agentName);
    if (agent) {
      // 这里可以添加更新智能体配置的逻辑
      this.logger.log(`更新智能体配置: ${agentName}`);
    }
  }

  // 获取编排器配置
  getOrchestratorConfig() {
    return this.orchestrator.getConfig();
  }

  // 更新编排器配置
  updateOrchestratorConfig(config: any) {
    this.orchestrator.updateConfig(config);
    this.logger.log('更新编排器配置');
  }
}
