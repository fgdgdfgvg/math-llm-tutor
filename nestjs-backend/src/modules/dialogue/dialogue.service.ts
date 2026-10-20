import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { ErrorAnalysisService } from '../error-analysis/error-analysis.service';
import { LearningService } from '../learning/learning.service';
import {
  DialogueSession,
  DialogueSessionDocument,
  DialogueMessage,
} from './schemas/dialogue-session.schema';

export type { DialogueSession, DialogueMessage };

export interface StepFeedback {
  stepNumber: number;
  isCorrect: boolean;
  feedback: string;
  suggestions: string[];
  relatedConcepts: string[];
}

@Injectable()
export class DialogueService {
  private readonly logger = new Logger(DialogueService.name);

  constructor(
    @InjectModel(DialogueSession.name)
    private dialogueSessionModel: Model<DialogueSessionDocument>,
    private readonly knowledgeService: KnowledgeService,
    private readonly errorAnalysisService: ErrorAnalysisService,
    private readonly learningService: LearningService,
  ) {}

  async createSession(
    userId: string,
    context?: {
      problemId?: string;
      relatedConcepts?: string[];
    },
  ): Promise<DialogueSession> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const session = new this.dialogueSessionModel({
      id: sessionId,
      userId,
      messages: [],
      context: context || {},
    });

    const savedSession = await session.save();
    return savedSession.toObject() as DialogueSession;
  }

  async sendMessage(
    sessionId: string,
    message: string,
    type: 'question' | 'answer' | 'hint' | 'feedback' = 'question',
  ): Promise<DialogueMessage[]> {
    const session = await this.dialogueSessionModel.findOne({ id: sessionId });
    if (!session) {
      throw new Error('Session not found');
    }

    // 添加用户消息
    const userMessage: DialogueMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
      type,
    };
    session.messages.push(userMessage);

    // 生成助手回复
    const assistantMessage = await this.generateResponse(
      session.toObject() as DialogueSession,
      message,
      type,
    );
    session.messages.push(assistantMessage);
    session.lastUpdated = new Date();

    await session.save();
    return [userMessage, assistantMessage];
  }

  async analyzeStep(
    sessionId: string,
    stepNumber: number,
    stepContent: string,
  ): Promise<StepFeedback> {
    const session = await this.dialogueSessionModel.findOne({ id: sessionId });
    if (!session) {
      throw new Error('Session not found');
    }

    // 分析步骤内容
    const errorDiagnoses = await this.errorAnalysisService.analyzeError(
      stepContent,
      '',
    );
    const isCorrect = errorDiagnoses.length === 0;

    // 生成反馈
    let feedback = '';
    const suggestions: string[] = [];
    const relatedConcepts: string[] = [];

    if (isCorrect) {
      feedback = '这一步是正确的！';
      suggestions.push('继续保持，下一步加油！');
    } else {
      feedback = `这一步存在错误：${errorDiagnoses[0].description}`;
      suggestions.push(...errorDiagnoses[0].tips);
      relatedConcepts.push(
        ...errorDiagnoses[0].relatedConcepts.map((c) => c.conceptName),
      );
    }

    return {
      stepNumber,
      isCorrect,
      feedback,
      suggestions,
      relatedConcepts,
    };
  }

  async getSession(sessionId: string): Promise<DialogueSession | null> {
    const session = await this.dialogueSessionModel.findOne({ id: sessionId });
    return session ? (session.toObject() as DialogueSession) : null;
  }

  async listSessions(userId: string): Promise<DialogueSession[]> {
    const sessions = await this.dialogueSessionModel.find({ userId });
    return sessions.map((session) => session.toObject() as DialogueSession);
  }

  async closeSession(sessionId: string): Promise<boolean> {
    const result = await this.dialogueSessionModel.deleteOne({ id: sessionId });
    return result.deletedCount > 0;
  }

  private async generateResponse(
    session: DialogueSession,
    message: string,
    type: 'question' | 'answer' | 'hint' | 'feedback',
  ): Promise<DialogueMessage> {
    let responseContent = '';
    let responseType: 'question' | 'answer' | 'hint' | 'feedback' = 'answer';

    switch (type) {
      case 'question':
        responseContent = await this.handleQuestion(
          message,
          session.context as Record<string, unknown>,
        );
        break;
      case 'answer':
        responseContent = await this.handleAnswer(
          message,
          session.context as Record<string, unknown>,
        );
        break;
      case 'hint':
        responseContent = await this.handleHint(
          message,
          session.context as Record<string, unknown>,
        );
        responseType = 'hint';
        break;
      case 'feedback':
        responseContent = await this.handleFeedback(
          message,
          session.context as Record<string, unknown>,
        );
        responseType = 'feedback';
        break;
    }

    return {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'assistant',
      content: responseContent,
      timestamp: new Date(),
      type: responseType,
    };
  }

  private async handleQuestion(
    question: string,
    context: Record<string, unknown>,
  ): Promise<string> {
    // 分析问题类型
    if (question.includes('为什么') || question.includes('why')) {
      return await this.answerWhyQuestion(question);
    } else if (question.includes('如何') || question.includes('how')) {
      return await this.answerHowQuestion(question);
    } else if (question.includes('什么') || question.includes('what')) {
      return await this.answerWhatQuestion(question);
    } else {
      return await this.answerGeneralQuestion(question);
    }
  }

  private async handleAnswer(
    answer: string,
    context: Record<string, unknown>,
  ): Promise<string> {
    // 分析答案
    const errorDiagnoses = await this.errorAnalysisService.analyzeError(
      answer,
      '',
    );

    if (errorDiagnoses.length === 0) {
      return '你的答案看起来是正确的！继续保持。';
    } else {
      return `我发现你的答案中存在一些问题：${errorDiagnoses[0].description}。${errorDiagnoses[0].tips[0]}`;
    }
  }

  private async handleHint(
    message: string,
    context: Record<string, unknown>,
  ): Promise<string> {
    // 生成提示
    if (
      context.relatedConcepts &&
      Array.isArray(context.relatedConcepts) &&
      context.relatedConcepts.length > 0
    ) {
      const concept = await this.knowledgeService.getConcept(
        context.relatedConcepts[0] as string,
      );
      if (concept) {
        return `提示：回忆一下${concept.name}的定义和性质，特别是${concept.description.substring(0, 100)}...`;
      }
    }
    return '提示：尝试从基本概念出发，逐步分析问题。';
  }

  private async handleFeedback(
    feedback: string,
    context: Record<string, unknown>,
  ): Promise<string> {
    // 处理反馈
    return `感谢你的反馈！我会将你的建议记录下来，不断改进系统。`;
  }

  private async answerWhyQuestion(question: string): Promise<string> {
    // 回答为什么类型的问题
    if (question.includes('洛必达')) {
      return '洛必达法则适用于0/0或∞/∞型未定式，因为它通过求导将极限问题转化为更简单的形式，利用了导数的性质来简化计算。';
    } else if (question.includes('链式法则')) {
      return '链式法则用于复合函数求导，因为复合函数的变化率是外层函数和内层函数变化率的乘积，这是由导数的定义推导出来的。';
    } else if (question.includes('分部积分')) {
      return '分部积分法是由乘积法则推导而来的，适用于两个函数乘积的积分，通过交换u和v的角色来简化积分计算。';
    } else if (question.includes('换元')) {
      return '换元积分法通过变量替换将复杂的积分转化为简单的积分，利用了积分的变量替换性质。';
    } else {
      return '这是一个很好的问题！让我为你详细解释一下...';
    }
  }

  private async answerHowQuestion(question: string): Promise<string> {
    // 回答如何类型的问题
    if (question.includes('求导')) {
      return '求导的基本步骤是：1. 识别函数类型；2. 应用相应的求导法则（如幂函数法则、乘积法则、链式法则等）；3. 简化结果。';
    } else if (question.includes('积分')) {
      return '积分的基本步骤是：1. 识别被积函数类型；2. 应用相应的积分方法（如换元法、分部积分法等）；3. 加上积分常数（不定积分）或代入上下限（定积分）。';
    } else if (question.includes('极限')) {
      return '求极限的基本步骤是：1. 直接代入看是否有意义；2. 如果是未定式，应用相应的方法（如洛必达法则、等价无穷小替换等）；3. 简化并计算结果。';
    } else {
      return '解决这个问题的步骤是：1. 理解问题；2. 应用相关概念和公式；3. 逐步计算；4. 验证结果。';
    }
  }

  private async answerWhatQuestion(question: string): Promise<string> {
    // 回答什么类型的问题
    if (question.includes('导数')) {
      return "导数表示函数在某点的瞬时变化率，几何意义是曲线在该点切线的斜率。数学定义是差商的极限：f'(x) = lim(h→0) [f(x+h) - f(x)]/h。";
    } else if (question.includes('积分')) {
      return '积分是导数的逆运算，分为不定积分和定积分。不定积分是求原函数的过程，定积分表示函数曲线下的面积。';
    } else if (question.includes('极限')) {
      return '极限描述函数在某点附近的行为趋势。数学定义是：对于任意ε>0，存在δ>0，当0<|x-a|<δ时，|f(x)-L|<ε，则称L为f(x)当x趋近于a时的极限。';
    } else {
      return '这是一个关于数学概念的问题，让我为你解释一下...';
    }
  }

  private async answerGeneralQuestion(question: string): Promise<string> {
    // 回答一般问题
    // 这里可以集成ChatGPT等模型，模拟教师与学生进行解题思路讨论
    // 由于是模拟，这里返回一个通用回答
    return '我理解你的问题。让我们一起分析一下：首先，我们需要明确问题的核心，然后应用相关的数学概念和方法来解决它。如果你能提供更多具体信息，我可以给你更详细的帮助。';
  }

  // 清理过期会话（MongoDB会自动处理过期会话，此方法用于手动清理）
  async cleanupSessions(): Promise<void> {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const result = await this.dialogueSessionModel.deleteMany({
      lastUpdated: { $lt: twentyFourHoursAgo },
    });

    this.logger.log(`Cleaned up ${result.deletedCount} expired sessions`);
  }
}
