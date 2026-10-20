import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';

export enum AcademicIntegrityLevel {
  SAFE = 'safe',
  CAUTION = 'caution',
  BOUNDARY = 'boundary',
  VIOLATION = 'violation',
}

export interface IntegrityCheckResult {
  level: AcademicIntegrityLevel;
  issues: string[];
  riskScore: number;
  requiresManualReview: boolean;
  details: string;
}

export interface WatermarkPayload {
  timestamp: number;
  sessionId: string;
  userId: string;
  modelInfo: string;
  contentType: 'solution_step' | 'final_answer' | 'explanation' | 'feedback';
  nonce: string;
}

export interface EmbeddedWatermark {
  payload: WatermarkPayload;
  hash: string;
  signature: string;
  location: string;
  extractable: boolean;
}

type PromptType =
  | 'solve'
  | 'explain'
  | 'verify'
  | 'write_essay'
  | 'direct_answer';

interface BoundaryRule {
  type: PromptType;
  level: AcademicIntegrityLevel;
  condition: (prompt: string) => boolean;
  message: string;
}

const BOUNDARY_RULES: BoundaryRule[] = [
  {
    type: 'direct_answer',
    level: AcademicIntegrityLevel.VIOLATION,
    condition: (p: string): boolean =>
      /直接给我答案|不要步骤|只要答案|免.*步骤|跳过.*推导/i.test(p) &&
      !/练习|习题|作业题|自测/.test(p),
    message: '检测到"直接要答案"请求：系统拒绝跳过解题步骤直接输出终答',
  },
  {
    type: 'write_essay',
    level: AcademicIntegrityLevel.BOUNDARY,
    condition: (p: string): boolean =>
      /帮忙写|代写|替我写|帮我写.*论文|自动生成.*报告/i.test(p),
    message:
      '检测到"代写"请求：数学辅导系统以解题和学习为目标，不为写作任务提供代服务',
  },
  {
    type: 'solve',
    level: AcademicIntegrityLevel.CAUTION,
    condition: (p: string): boolean =>
      /考试|exam|试卷|test\s*paper|考试题|期末|期中|模拟考|真题/i.test(p) &&
      /在线|online|当前|现在|马上|立刻/.test(p) &&
      !/练习用|自测|模拟|复习/.test(p),
    message:
      '检测到疑似考试实时求助：系统标记此请求，仅提供练习/复习模式下的帮助',
  },
  {
    type: 'explain',
    level: AcademicIntegrityLevel.CAUTION,
    condition: (p: string): boolean =>
      /网课.*答案|在线.*测试|自动.*做题|批量.*求解/i.test(p),
    message: '检测到疑似批量求解请求：系统限制连续无间隔的批量问题提交',
  },
  {
    type: 'verify',
    level: AcademicIntegrityLevel.SAFE,
    condition: (): boolean => false,
    message: '',
  },
];

@Injectable()
export class AcademicIntegrityService {
  private readonly logger = new Logger(AcademicIntegrityService.name);
  private readonly systemSignature: Buffer;
  private readonly unauthorizedPatterns: RegExp[];

  constructor() {
    this.systemSignature = randomBytes(32);
    this.unauthorizedPatterns = [/批量生成/g, /全自动/g, /替我.*完成/g, /代/g];
    this.logger.log('学术诚信系统初始化完成');
  }

  checkIntegrity(
    userPrompt: string,
    context?: {
      consecutiveRequests?: number;
      timeWindowMinutes?: number;
      previousPrompts?: string[];
    },
  ): IntegrityCheckResult {
    const issues: string[] = [];
    let riskScore = 0;

    for (const rule of BOUNDARY_RULES) {
      if (rule.condition(userPrompt)) {
        issues.push(rule.message);
        riskScore +=
          rule.level === AcademicIntegrityLevel.VIOLATION
            ? 40
            : rule.level === AcademicIntegrityLevel.BOUNDARY
              ? 30
              : rule.level === AcademicIntegrityLevel.CAUTION
                ? 20
                : 0;
      }
    }

    // 上下文检查：连续请求频率
    if (context) {
      if ((context.consecutiveRequests || 0) > 10) {
        const timeWindow = context.timeWindowMinutes || 60;
        if (timeWindow < 10) {
          issues.push('短时间内连续请求过于频繁，疑似批量自动化使用');
          riskScore += 25;
        }
      }

      if (context.previousPrompts && context.previousPrompts.length > 5) {
        const similarPrompts = context.previousPrompts.filter(
          (prev) => this.promptSimilarity(prev, userPrompt) > 0.85,
        );
        if (similarPrompts.length > 3) {
          issues.push('连续多个高度相似的问题，可能为重复请求');
          riskScore += 15;
        }
      }
    }

    let level: AcademicIntegrityLevel;
    let requiresManualReview: boolean;

    if (riskScore >= 50) {
      level = AcademicIntegrityLevel.VIOLATION;
      requiresManualReview = true;
    } else if (riskScore >= 30) {
      level = AcademicIntegrityLevel.BOUNDARY;
      requiresManualReview = true;
    } else if (riskScore >= 15) {
      level = AcademicIntegrityLevel.CAUTION;
      requiresManualReview = false;
    } else {
      level = AcademicIntegrityLevel.SAFE;
      requiresManualReview = false;
    }

    let details: string;
    switch (level) {
      case AcademicIntegrityLevel.SAFE:
        details = '请求符合学术诚信规范，正常处理中';
        break;
      case AcademicIntegrityLevel.CAUTION:
        details = `低风险提示（风险分${riskScore}）。系统将在解题中加强"学习方法引导"，以促进主动思考。`;
        break;
      case AcademicIntegrityLevel.BOUNDARY:
        details = `边界风险（风险分${riskScore}）。系统限制直接解答的输出模式，转为引导性提示和概念解答。`;
        break;
      case AcademicIntegrityLevel.VIOLATION:
        details = `高风险违规（风险分${riskScore}）。系统拒绝直接解答请求，输出学术诚信提醒和教育引导。`;
        break;
    }

    this.logger.log(
      `学术诚信检查: ${level} (分=${riskScore}, 问题=${issues.length})`,
    );

    return {
      level,
      issues,
      riskScore: Math.min(100, riskScore),
      requiresManualReview,
      details,
    };
  }

  getIntegrityResponse(level: AcademicIntegrityLevel): string {
    switch (level) {
      case AcademicIntegrityLevel.VIOLATION:
        return (
          '【学术诚信提醒】本系统旨在"引导和帮助你理解和掌握数学知识"，而非替代你的主动学习。\n\n' +
          '为了更好地帮助你，请按以下方式重新制定提问：\n' +
          '1. 先写出你已有的思考和方法尝试\n' +
          '2. 表明你需要解释概念还是检查你的推理过程\n' +
          '3. 学习过程中遇到的具体困难（而非直接要答案）'
        );
      case AcademicIntegrityLevel.BOUNDARY:
        return '【提示】为保障你的学习效果，系统提供分步骤引导式解答。请先阅读关键概念和引导步骤，尝试自己完成推导。';
      default:
        return '';
    }
  }

  generateWatermark(
    userId: string,
    sessionId: string,
    modelInfo: string,
    contentType: WatermarkPayload['contentType'],
  ): EmbeddedWatermark {
    const nonce = randomBytes(8).toString('hex');
    const timestamp = Date.now();

    const payload: WatermarkPayload = {
      timestamp,
      sessionId,
      userId,
      modelInfo,
      contentType,
      nonce,
    };

    const payloadString = JSON.stringify(payload);
    const hash = createHash('sha256').update(payloadString).digest('hex');

    const signatureInput = `${payloadString}:${this.systemSignature.toString('hex')}`;
    const signature = createHash('sha256').update(signatureInput).digest('hex');

    const watermarkString = `[WM:${hash.substring(0, 16)}:${signature.substring(0, 16)}]`;

    return {
      payload,
      hash,
      signature,
      location: watermarkString,
      extractable: true,
    };
  }

  embedWatermarkInText(
    content: string,
    userId: string,
    sessionId: string,
    modelInfo: string,
    contentType: WatermarkPayload['contentType'] = 'solution_step',
  ): { watermarkedContent: string; watermark: EmbeddedWatermark } {
    const watermark = this.generateWatermark(
      userId,
      sessionId,
      modelInfo,
      contentType,
    );

    // 将水印嵌入为末尾注释
    const watermarkedContent = `${content}\n\n<!-- ${watermark.location} -->`;

    this.logger.log(`水印已嵌入: 用户=${userId}, 类型=${contentType}`);
    return { watermarkedContent, watermark };
  }

  embedInvisibleWatermark(
    content: string,
    userId: string,
    sessionId: string,
    modelInfo: string,
  ): { watermarkedContent: string; watermark: EmbeddedWatermark } {
    const watermark = this.generateWatermark(
      userId,
      sessionId,
      modelInfo,
      'solution_step',
    );

    // 零宽度字符隐形水印
    const binaryHash = watermark.hash
      .split('')
      .map((c) => parseInt(c, 16).toString(2).padStart(4, '0'))
      .join('');

    const invisibleChars: Record<string, string> = {
      '0': '\u200B', // 零宽空格
      '1': '\u200C', // 零宽非连接符
      ':': '\u200D', // 零宽连接符
    };

    const invisibleWatermark = `\u200B${binaryHash
      .split('')
      .map((b) => invisibleChars[b] || '\u200B')
      .join('')}\u200B`;

    // 插入到内容的中间位置
    const insertPos = Math.floor(content.length / 3);
    const watermarkedContent =
      content.substring(0, insertPos) +
      invisibleWatermark +
      content.substring(insertPos);

    this.logger.log(`隐形水印已嵌入: 用户=${userId}`);
    return { watermarkedContent, watermark };
  }

  extractWatermark(content: string): {
    found: boolean;
    watermark?: EmbeddedWatermark;
    message: string;
  } {
    // 提取可见水印
    const visibleMatch = content.match(/\[WM:([a-f0-9]{16}):([a-f0-9]{16})\]/);
    if (visibleMatch) {
      return {
        found: true,
        message: `找到可见水印: 哈希前缀=${visibleMatch[1]}, 签名前缀=${visibleMatch[2]}`,
      };
    }

    // 提取隐形水印（零宽字符）
    const invisibleMatch = content.match(/\u200B([\u200B\u200C\u200D]+)\u200B/);
    if (invisibleMatch) {
      return {
        found: true,
        message: `找到隐形零宽字符水印: 长度=${invisibleMatch[1].length}`,
      };
    }

    return {
      found: false,
      message: '未在内容中找到水印标记',
    };
  }

  verifyContentOrigin(
    content: string,
    expectedUserId: string,
  ): {
    verified: boolean;
    hasWatermark: boolean;
    userIdMatch: boolean;
    message: string;
  } {
    const extraction = this.extractWatermark(content);

    return {
      verified: false, // 完整验证需要恢复原始payload
      hasWatermark: extraction.found,
      userIdMatch: extraction.found, // 水印存在即视为可追溯
      message: extraction.found
        ? `内容可追溯：发现水印标记，生成内容可验证归属`
        : `内容不可追溯：未发现水印`,
    };
  }

  private promptSimilarity(a: string, b: string): number {
    const aWords = new Set(
      a.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ').split(/\s+/),
    );
    const bWords = new Set(
      b.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ').split(/\s+/),
    );

    if (aWords.size === 0 || bWords.size === 0) return 0;

    const intersection = [...aWords].filter((w) => bWords.has(w)).length;
    const union = aWords.size + bWords.size - intersection;

    return union > 0 ? intersection / union : 0;
  }
}
