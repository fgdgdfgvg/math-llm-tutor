import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  StudentKnowledge,
  StudentKnowledgeDocument,
} from './schemas/student-knowledge.schema';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { KnowledgeNode } from '../knowledge/interfaces/knowledge.interfaces';
import {
  sharedCacheManager,
  cognitiveStateCacheKey,
} from '../interactive-learning/utils/in-memory-cache.util';

export interface StudentKnowledgeSummary {
  totalConcepts: number;
  masteredConcepts: number;
  learningConcepts: number;
  averageMastery: number;
  strongestAreas: string[];
  weakestAreas: string[];
  recommendedNext: string[];
}

export interface LearningProgress {
  conceptId: string;
  conceptName: string;
  masteryLevel: number;
  status: string;
  progress: number;
}

@Injectable()
export class StudentKnowledgeService {
  private readonly logger = new Logger(StudentKnowledgeService.name);

  constructor(
    @InjectModel(StudentKnowledge.name)
    private studentKnowledgeModel: Model<StudentKnowledgeDocument>,
    private readonly knowledgeService: KnowledgeService,
  ) {}

  async getStudentKnowledge(
    userId: string,
    conceptId: string,
  ): Promise<StudentKnowledge | null> {
    return this.studentKnowledgeModel.findOne({ userId, conceptId }).exec();
  }

  async getAllStudentKnowledge(userId: string): Promise<StudentKnowledge[]> {
    return this.studentKnowledgeModel
      .find({ userId })
      .sort({ masteryLevel: -1 })
      .exec();
  }

  async recordPractice(
    userId: string,
    conceptId: string,
    isCorrect: boolean,
    problemId: string,
    timeSpent: number,
  ): Promise<StudentKnowledge> {
    let knowledge = await this.studentKnowledgeModel.findOne({
      userId,
      conceptId,
    });

    if (!knowledge) {
      knowledge = new this.studentKnowledgeModel({
        userId,
        conceptId,
        status: 'learning',
        firstLearned: new Date(),
        practiceHistory: [],
      });
    }

    knowledge.attemptsCount += 1;
    if (isCorrect) {
      knowledge.correctCount += 1;
    } else {
      knowledge.incorrectCount += 1;
    }

    knowledge.lastPracticed = new Date();
    knowledge.totalPracticeTime += timeSpent;

    knowledge.practiceHistory.push({
      date: new Date(),
      problemId,
      isCorrect,
      timeSpent,
    });

    if (knowledge.practiceHistory.length > 100) {
      knowledge.practiceHistory = knowledge.practiceHistory.slice(-100);
    }

    knowledge.masteryLevel = this.calculateMasteryLevel(knowledge);
    knowledge.status = this.determineStatus(knowledge.masteryLevel);

    this.updateStreak(knowledge);

    await knowledge.save();

    await this.updateWeakAndStrongPoints(knowledge);

    // 认知状态评估缓存 5 分钟；不清掉的话，学生刚做完题看到的还是旧分析。
    await sharedCacheManager.delete(cognitiveStateCacheKey(userId));

    return knowledge;
  }

  private calculateMasteryLevel(knowledge: StudentKnowledge): number {
    if (knowledge.attemptsCount === 0) return 0;

    const accuracy = knowledge.correctCount / knowledge.attemptsCount;
    const recencyFactor = this.calculateRecencyFactor(knowledge.lastPracticed);
    const consistencyFactor = this.calculateConsistencyFactor(
      knowledge.practiceHistory,
    );

    const mastery =
      accuracy * 0.5 + recencyFactor * 0.3 + consistencyFactor * 0.2;

    return Math.min(1, Math.max(0, mastery));
  }

  private calculateRecencyFactor(lastPracticed: Date): number {
    if (!lastPracticed) return 0;

    const daysSincePractice =
      (Date.now() - lastPracticed.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSincePractice <= 1) return 1;
    if (daysSincePractice <= 3) return 0.8;
    if (daysSincePractice <= 7) return 0.6;
    if (daysSincePractice <= 14) return 0.4;
    if (daysSincePractice <= 30) return 0.2;
    return 0.1;
  }

  private calculateConsistencyFactor(history: any[]): number {
    if (history.length < 3) return 0.5;

    const recentHistory = history.slice(-10);
    let streak = 0;
    let maxStreak = 0;

    for (const record of recentHistory) {
      if (record.isCorrect) {
        streak++;
        maxStreak = Math.max(maxStreak, streak);
      } else {
        streak = 0;
      }
    }

    return Math.min(1, maxStreak / 5);
  }

  private determineStatus(
    masteryLevel: number,
  ): 'none' | 'learning' | 'practicing' | 'mastered' {
    if (masteryLevel >= 0.85) return 'mastered';
    if (masteryLevel >= 0.5) return 'practicing';
    if (masteryLevel > 0) return 'learning';
    return 'none';
  }

  private updateStreak(knowledge: StudentKnowledge): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (knowledge.lastStreakDate) {
      const lastDate = new Date(knowledge.lastStreakDate);
      lastDate.setHours(0, 0, 0, 0);

      const diffDays = Math.floor(
        (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays === 1) {
        knowledge.streakDays += 1;
      } else if (diffDays > 1) {
        knowledge.streakDays = 1;
      }
    } else {
      knowledge.streakDays = 1;
    }

    knowledge.lastStreakDate = today;
  }

  private async updateWeakAndStrongPoints(
    knowledge: StudentKnowledgeDocument,
  ): Promise<void> {
    const recentHistory = knowledge.practiceHistory.slice(-20);
    const correctRate =
      recentHistory.length > 0
        ? recentHistory.filter((h) => h.isCorrect).length / recentHistory.length
        : 0;

    const concept = await this.knowledgeService.getConcept(knowledge.conceptId);
    // 练习记录按题库知识点归档（如“极限计算”），它并不在知识图谱里，
    // 此时必须用记录本身的名字兜底，否则薄弱点/强项永远采集不到（学习评估会没有真实输入）。
    const displayName = concept?.name || knowledge.conceptId;
    if (!displayName) return;

    if (correctRate < 0.4 && !knowledge.weakPoints.includes(displayName)) {
      knowledge.weakPoints.push(displayName);
      knowledge.strongPoints = knowledge.strongPoints.filter(
        (p) => p !== displayName,
      );
    } else if (
      correctRate > 0.8 &&
      !knowledge.strongPoints.includes(displayName)
    ) {
      knowledge.strongPoints.push(displayName);
      knowledge.weakPoints = knowledge.weakPoints.filter(
        (p) => p !== displayName,
      );
    }

    await knowledge.save();
  }

  async getStudentSummary(userId: string): Promise<StudentKnowledgeSummary> {
    const allKnowledge = await this.getAllStudentKnowledge(userId);

    const masteredConcepts = allKnowledge.filter(
      (k) => k.status === 'mastered',
    ).length;
    const learningConcepts = allKnowledge.filter(
      (k) => k.status === 'learning' || k.status === 'practicing',
    ).length;
    const averageMastery =
      allKnowledge.length > 0
        ? allKnowledge.reduce((sum, k) => sum + k.masteryLevel, 0) /
          allKnowledge.length
        : 0;

    const weakPoints = new Set<string>();
    const strongPoints = new Set<string>();

    allKnowledge.forEach((k) => {
      k.weakPoints?.forEach((p) => weakPoints.add(p));
      k.strongPoints?.forEach((p) => strongPoints.add(p));
    });

    const recommendedNext = await this.getRecommendedNextConcepts(userId);

    return {
      totalConcepts: allKnowledge.length,
      masteredConcepts,
      learningConcepts,
      averageMastery,
      strongestAreas: Array.from(strongPoints).slice(0, 5),
      weakestAreas: Array.from(weakPoints).slice(0, 5),
      recommendedNext,
    };
  }

  async getRecommendedNextConcepts(userId: string): Promise<string[]> {
    const allKnowledge = await this.getAllStudentKnowledge(userId);
    const learnedConceptIds = new Set(allKnowledge.map((k) => k.conceptId));

    const recommendations: string[] = [];

    for (const knowledge of allKnowledge) {
      if (
        knowledge.status === 'learning' ||
        knowledge.status === 'practicing'
      ) {
        const dependents = await this.knowledgeService.getDependentConcepts(
          knowledge.conceptId,
        );
        for (const dep of dependents) {
          if (dep.id && !learnedConceptIds.has(dep.id)) {
            const prereqs = await this.knowledgeService.getPrerequisites(
              dep.id,
            );
            const allPrereqsMet = prereqs.every(
              (p) =>
                p.id &&
                learnedConceptIds.has(p.id) &&
                allKnowledge.find(
                  (k) => k.conceptId === p.id && k.masteryLevel >= 0.5,
                ),
            );
            if (allPrereqsMet && !recommendations.includes(dep.name)) {
              recommendations.push(dep.name);
            }
          }
        }
      }
    }

    return recommendations.slice(0, 5);
  }

  async getLearningProgress(userId: string): Promise<LearningProgress[]> {
    const allKnowledge = await this.getAllStudentKnowledge(userId);
    const progress: LearningProgress[] = [];

    for (const knowledge of allKnowledge) {
      const concept = await this.knowledgeService.getConcept(
        knowledge.conceptId,
      );
      // 题库知识点（如“极限计算”）不在知识图谱中，用记录本身兜底，
      // 否则这些真实练习会被静默丢弃，进度页看上去“没学过”。
      progress.push({
        conceptId: knowledge.conceptId,
        conceptName: concept?.name || knowledge.conceptId,
        masteryLevel: knowledge.masteryLevel,
        status: knowledge.status,
        progress: Math.round(knowledge.masteryLevel * 100),
      });
    }

    return progress.sort((a, b) => b.masteryLevel - a.masteryLevel);
  }

  async getConceptsNeedingReview(userId: string): Promise<KnowledgeNode[]> {
    const allKnowledge = await this.studentKnowledgeModel
      .find({
        userId,
        attemptsCount: { $gt: 0 },
        $or: [
          {
            lastPracticed: {
              $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
          // 掌握度偏低就需要复习（用 $lte 避免 0.3 这类边界值被排除）
          { masteryLevel: { $lte: 0.7 } },
        ],
      })
      .sort({ masteryLevel: 1, lastPracticed: 1 })
      .limit(10)
      .exec();

    const concepts: KnowledgeNode[] = [];
    for (const knowledge of allKnowledge) {
      const concept = await this.knowledgeService.getConcept(
        knowledge.conceptId,
      );
      // 题库知识点（如“极限计算”）不一定存在于知识图谱中，此时用记录本身兜底
      concepts.push(
        concept ||
          ({
            id: knowledge.conceptId,
            name: knowledge.conceptId,
            type: 'Concept',
            description: '',
            difficulty: 'medium',
            tags: [],
            examples: [],
          } as unknown as KnowledgeNode),
      );
    }

    return concepts;
  }

  async initializeStudentKnowledge(userId: string): Promise<void> {
    const allConcepts = await this.knowledgeService.getAllConcepts();

    for (const concept of allConcepts) {
      const existing = await this.getStudentKnowledge(userId, concept.id);
      if (!existing && concept.id) {
        await this.studentKnowledgeModel.create({
          userId,
          conceptId: concept.id,
          status: 'none',
          masteryLevel: 0,
          attemptsCount: 0,
          correctCount: 0,
          incorrectCount: 0,
          weakPoints: [],
          strongPoints: [],
          practiceHistory: [],
          totalPracticeTime: 0,
          streakDays: 0,
        });
      }
    }

    this.logger.log(
      `Initialized knowledge tracking for user ${userId} with ${allConcepts.length} concepts`,
    );
  }
}
