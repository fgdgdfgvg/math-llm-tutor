import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, Document } from 'mongoose';
import {
  LearningRecord,
  LearningRecordDocument,
} from './schemas/learning-record.schema';
import { StudentKnowledgeService } from '../student/student-knowledge.service';
import type { StudentKnowledge } from '../student/schemas/student-knowledge.schema';
import { KnowledgePointMappingService } from '../knowledge/knowledge-point-mapping.service';

export interface LearningStats {
  totalConcepts: number;
  masteredConcepts: number;
  learningConcepts: number;
  totalPracticeTime: number;
  averageMastery: number;
  streakDays: number;
  weeklyProgress: number[];
}

export interface ConceptProgress {
  conceptId: string;
  conceptName: string;
  masteryLevel: number;
  lastPracticeDate: Date;
  nextReviewDate: Date;
  reviewCount: number;
  status: 'not_started' | 'learning' | 'reviewing' | 'mastered';
  /** 该知识点映射到的知识图谱概念 id，前端可直接用来回填节点掌握度 */
  conceptIds: string[];
  /** 真实练习统计，供图谱列表视图展示 */
  attemptsCount: number;
  correctCount: number;
  incorrectCount: number;
  /** 正确率（0-100 整数） */
  correctRate: number;
  /** 练习经历前半段 / 后半段正确率（仅统计练习≥4 次的知识点，用于评估适应与纠错能力） */
  earlyAccuracy: number | null;
  recentAccuracy: number | null;
}

export interface ReviewItem {
  conceptId: string;
  conceptName: string;
  dueDate: Date;
  priority: number;
  masteryLevel: number;
}

type LearningRecordWithTimestamps = LearningRecordDocument &
  Document & { createdAt: Date; updatedAt: Date };

@Injectable()
export class LearningService {
  private readonly logger = new Logger(LearningService.name);

  constructor(
    @InjectModel(LearningRecord.name)
    private readonly learningRecordModel: Model<LearningRecordDocument>,
    private readonly studentKnowledgeService: StudentKnowledgeService,
    private readonly knowledgePointMapping: KnowledgePointMappingService,
  ) {}

  /**
   * 统一数据源：练习页写入的 student-knowledge 记录。
   * 这样 /learning/* 与 /student/knowledge/* 返回的学习进度完全一致。
   */
  private async getKnowledgeRecords(
    userId: string,
  ): Promise<StudentKnowledge[]> {
    const records =
      await this.studentKnowledgeService.getAllStudentKnowledge(userId);
    return records.filter((r) => (r.attemptsCount || 0) > 0);
  }

  private getDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** 最近 7 天每天的练习次数（来自真实练习历史） */
  private buildWeeklyProgress(records: StudentKnowledge[]): number[] {
    const counts = new Map<string, number>();
    for (const record of records) {
      for (const entry of record.practiceHistory || []) {
        const key = this.getDateString(new Date(entry.date));
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }

    const progress: number[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      progress.push(counts.get(this.getDateString(date)) || 0);
    }
    return progress;
  }

  private getStatusFromMastery(
    masteryLevel: number,
  ): ConceptProgress['status'] {
    if (masteryLevel >= 0.8) return 'mastered';
    if (masteryLevel > 0) return 'learning';
    return 'not_started';
  }

  async recordLearning(
    userId: string,
    data: {
      conceptId: string;
      conceptName: string;
      action: 'view' | 'practice' | 'master' | 'review';
      masteryLevel?: number;
      timeSpent?: number;
      isCorrect?: boolean;
      problemText?: string;
      userAnswer?: string;
      correctAnswer?: string;
    },
  ): Promise<LearningRecord> {
    const existingRecord = await this.learningRecordModel
      .findOne({
        userId: new Types.ObjectId(userId),
        conceptId: data.conceptId,
      })
      .sort({ createdAt: -1 });

    let interval = 1;
    let easeFactor = 2.5;
    let reviewCount = 1;

    if (existingRecord) {
      reviewCount = existingRecord.reviewCount + 1;
      easeFactor = existingRecord.easeFactor;
      interval = this.calculateNextInterval(
        existingRecord,
        data.isCorrect ?? true,
      );
    }

    const nextReviewDate = this.calculateNextReviewDate(interval);

    const record = new this.learningRecordModel({
      userId: new Types.ObjectId(userId),
      ...data,
      reviewCount,
      interval,
      easeFactor,
      nextReviewDate,
    });

    const saved = await record.save();

    // 同步写入统一的学习记录（student-knowledge），让 /learning/* 与学习进度页看到同一份数据
    if (typeof data.isCorrect === 'boolean') {
      try {
        await this.studentKnowledgeService.recordPractice(
          userId,
          data.conceptId,
          data.isCorrect,
          data.problemText || '',
          data.timeSpent || 0,
        );
      } catch (error) {
        this.logger.warn(
          `同步练习记录到 student-knowledge 失败: ${(error as Error).message}`,
        );
      }
    }

    return saved;
  }

  private calculateNextInterval(
    record: LearningRecordDocument,
    isCorrect: boolean,
  ): number {
    let { interval, easeFactor } = record;

    if (isCorrect) {
      if (interval === 1) {
        interval = 1;
      } else if (interval === 2) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      easeFactor = Math.min(2.5, easeFactor + 0.1);
    } else {
      interval = 1;
      easeFactor = Math.max(1.3, easeFactor - 0.2);
    }

    return interval;
  }

  private calculateNextReviewDate(interval: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + interval);
    return date;
  }

  async getLearningStats(userId: string): Promise<LearningStats> {
    const concepts = await this.getKnowledgeRecords(userId);

    const masteredConcepts = concepts.filter(
      (c) => (c.masteryLevel || 0) >= 0.8,
    ).length;
    const learningConcepts = concepts.filter(
      (c) => (c.masteryLevel || 0) > 0 && (c.masteryLevel || 0) < 0.8,
    ).length;
    const totalPracticeTime = concepts.reduce(
      (sum, c) => sum + (c.totalPracticeTime || 0),
      0,
    );
    const averageMastery =
      concepts.length > 0
        ? concepts.reduce((sum, c) => sum + (c.masteryLevel || 0), 0) /
          concepts.length
        : 0;

    const streakDays = concepts.reduce(
      (max, c) => Math.max(max, c.streakDays || 0),
      0,
    );

    const weeklyProgress = this.buildWeeklyProgress(concepts);

    return {
      totalConcepts: concepts.length,
      masteredConcepts,
      learningConcepts,
      totalPracticeTime,
      averageMastery,
      streakDays,
      weeklyProgress,
    };
  }

  async getConceptProgress(userId: string): Promise<ConceptProgress[]> {
    const records = await this.getKnowledgeRecords(userId);

    return records
      .slice()
      .sort(
        (a, b) =>
          (b.lastPracticed?.getTime() || 0) - (a.lastPracticed?.getTime() || 0),
      )
      .map((record) => {
        const masteryLevel = record.masteryLevel || 0;
        const lastPracticeDate =
          record.lastPracticed || record.firstLearned || new Date();
        // 掌握度越低越早安排复习
        const intervalDays =
          masteryLevel < 0.5 ? 1 : masteryLevel < 0.8 ? 3 : 7;
        // 练习记录按题库知识点归档（如“极限计算”），知识图谱用的是概念 id
        // （如 limit_definition）。这里把两者一并给出，前端才能把掌握度回填到具体节点上。
        const mappedIds = this.knowledgePointMapping.getConceptIds(
          record.conceptId,
        );
        const conceptIds = Array.from(
          new Set([record.conceptId, ...mappedIds]),
        );

        const attemptsCount = record.attemptsCount || 0;
        const correctCount = record.correctCount || 0;
        const { earlyAccuracy, recentAccuracy } = this.buildAccuracyTrend(
          record.practiceHistory || [],
        );

        return {
          conceptId: record.conceptId,
          conceptName: record.conceptId,
          masteryLevel,
          lastPracticeDate,
          nextReviewDate: new Date(
            lastPracticeDate.getTime() + intervalDays * 24 * 60 * 60 * 1000,
          ),
          reviewCount: record.incorrectCount || 0,
          status: this.getStatusFromMastery(masteryLevel),
          conceptIds,
          attemptsCount,
          correctCount,
          incorrectCount: record.incorrectCount || 0,
          correctRate:
            attemptsCount > 0
              ? Math.round((correctCount / attemptsCount) * 100)
              : 0,
          earlyAccuracy,
          recentAccuracy,
        };
      });
  }

  /**
   * 练习历史前半段 / 后半段正确率，用于判断“越练越准”还是“重复犯错”。
   * 练习次数不足 4 次时不足以判断趋势，返回 null。
   */
  private buildAccuracyTrend(history: Array<{ isCorrect?: boolean }>): {
    earlyAccuracy: number | null;
    recentAccuracy: number | null;
  } {
    const attempts = history.filter(
      (entry) => typeof entry?.isCorrect === 'boolean',
    );
    if (attempts.length < 4) {
      return { earlyAccuracy: null, recentAccuracy: null };
    }

    const mid = Math.floor(attempts.length / 2);
    const rate = (entries: Array<{ isCorrect?: boolean }>) =>
      entries.filter((entry) => entry.isCorrect).length / entries.length;

    return {
      earlyAccuracy: rate(attempts.slice(0, mid)),
      recentAccuracy: rate(attempts.slice(mid)),
    };
  }

  async getReviewList(userId: string): Promise<ReviewItem[]> {
    const records = await this.getKnowledgeRecords(userId);

    return records
      .filter((record) => (record.masteryLevel || 0) < 0.8)
      .sort((a, b) => (a.masteryLevel || 0) - (b.masteryLevel || 0))
      .slice(0, 20)
      .map((record) => ({
        conceptId: record.conceptId,
        conceptName: record.conceptId,
        dueDate: new Date(
          (record.lastPracticed || new Date()).getTime() +
            ((record.masteryLevel || 0) < 0.5
              ? 24 * 60 * 60 * 1000
              : 3 * 24 * 60 * 60 * 1000),
        ),
        priority: Math.round((1 - (record.masteryLevel || 0)) * 100),
        masteryLevel: record.masteryLevel || 0,
      }));
  }

  async getPracticeHistory(
    userId: string,
    options: { page?: number; limit?: number; conceptId?: string },
  ): Promise<{ records: any[]; total: number }> {
    const { page = 1, limit = 20, conceptId } = options;
    const knowledge = await this.getKnowledgeRecords(userId);

    const all = knowledge
      .filter((record) => !conceptId || record.conceptId === conceptId)
      .flatMap((record) =>
        (record.practiceHistory || []).map((entry) => ({
          conceptId: record.conceptId,
          conceptName: record.conceptId,
          action: 'practice',
          masteryLevel: record.masteryLevel || 0,
          timeSpent: entry.timeSpent || 0,
          isCorrect: !!entry.isCorrect,
          problemText: entry.problemId || '',
          createdAt: new Date(entry.date),
        })),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const start = (page - 1) * limit;
    return { records: all.slice(start, start + limit), total: all.length };
  }

  async getAllUsersStats(adminId: string): Promise<LearningStats[]> {
    const allRecords = await this.learningRecordModel.find().exec();

    const userMap = new Map<string, LearningRecordDocument[]>();
    allRecords.forEach((record) => {
      const userId = record.userId.toString();
      if (!userMap.has(userId)) {
        userMap.set(userId, []);
      }
      userMap.get(userId)!.push(record);
    });

    const stats: LearningStats[] = [];
    for (const [, records] of userMap) {
      const conceptMap = new Map<string, LearningRecordDocument>();
      records.forEach((record) => {
        const existing = conceptMap.get(record.conceptId);
        if (!existing || record.createdAt > existing.createdAt) {
          conceptMap.set(record.conceptId, record);
        }
      });

      const concepts = Array.from(conceptMap.values());
      stats.push({
        totalConcepts: concepts.length,
        masteredConcepts: concepts.filter((c) => c.masteryLevel >= 0.8).length,
        learningConcepts: concepts.filter(
          (c) => c.masteryLevel > 0 && c.masteryLevel < 0.8,
        ).length,
        totalPracticeTime: records.reduce(
          (sum, r) => sum + (r.timeSpent || 0),
          0,
        ),
        averageMastery:
          concepts.length > 0
            ? concepts.reduce((sum, c) => sum + c.masteryLevel, 0) /
              concepts.length
            : 0,
        streakDays: 0,
        weeklyProgress: [],
      });
    }

    return stats;
  }

  async deleteUserData(
    userId: string,
    requestingUserId: string,
  ): Promise<void> {
    if (userId !== requestingUserId) {
      throw new ForbiddenException('You can only delete your own data');
    }

    await this.learningRecordModel.deleteMany({
      userId: new Types.ObjectId(userId),
    });
    this.logger.log(`Deleted all learning data for user ${userId}`);
  }
}
