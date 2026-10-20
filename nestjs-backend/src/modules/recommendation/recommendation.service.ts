import { Injectable, Logger } from '@nestjs/common';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { LearningService } from '../learning/learning.service';
import { QuestionsService } from '../questions/questions.service';
import { KnowledgePointMappingService } from '../knowledge/knowledge-point-mapping.service';
import { describeErrorForLog } from '../../common/utils/redact';

export interface RecommendationItem {
  conceptId: string;
  conceptName: string;
  priority: number;
  estimatedTime: number;
  reason: string;
  difficulty: 'easy' | 'medium' | 'hard';
  prerequisites: string[];
  dependents: string[];
}

export interface ProblemRecommendation {
  problemId: string;
  problemText: string;
  difficulty: 'easy' | 'medium' | 'hard';
  relatedConcepts: string[];
  estimatedTime: number;
  priority: number;
  reason: string;
}

export interface LearningPath {
  id: string;
  name: string;
  description: string;
  concepts: Array<{
    conceptId: string;
    conceptName: string;
    order: number;
    estimatedTime: number;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
  totalTime: number;
  targetMastery: number;
}

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly learningService: LearningService,
    private readonly questionsService: QuestionsService,
    private readonly knowledgePointMapping: KnowledgePointMappingService,
  ) {}

  async getPersonalizedRecommendations(
    userId: string,
  ): Promise<RecommendationItem[]> {
    try {
      // 获取用户的学习统计数据
      const stats = await this.learningService.getLearningStats(userId);
      const conceptProgress =
        await this.learningService.getConceptProgress(userId);
      const reviewList = await this.learningService.getReviewList(userId);

      // 没有真实练习证据时不生成“个性化”结论。
      if (conceptProgress.length === 0) return [];

      // 获取所有概念
      const allConcepts = await this.knowledgeService.getAllConcepts();
      const recommendations: RecommendationItem[] = [];

      // 分析每个概念的优先级
      for (const concept of allConcepts) {
        const progress = conceptProgress.find(
          (p) =>
            p.conceptId === concept.id || p.conceptIds?.includes(concept.id),
        );
        const reviewItem = reviewList.find(
          (r) =>
            r.conceptId === concept.id ||
            this.knowledgePointMapping.matchesConcept(r.conceptId, concept.id),
        );

        // 计算优先级分数
        const priority = this.calculatePriority(
          concept,
          progress?.masteryLevel || 0,
          reviewItem?.priority || 0,
          stats.averageMastery,
        );

        // 获取相关概念
        const prerequisites = await this.knowledgeService.getPrerequisites(
          concept.id,
        );
        const dependents = await this.knowledgeService.getDependentConcepts(
          concept.id,
        );

        // 只推荐有真实学习证据或明确复习需求的概念，避免把整张图谱都当成薄弱点。
        if (priority > 0 && (progress || reviewItem)) {
          recommendations.push({
            conceptId: concept.id,
            conceptName: concept.name,
            priority,
            estimatedTime: this.estimateLearningTime(
              concept.difficulty || 'medium',
            ),
            reason: this.generateRecommendationReason(concept, progress),
            difficulty: (concept.difficulty || 'medium') as
              | 'easy'
              | 'medium'
              | 'hard',
            prerequisites: prerequisites.map((p) => p.name),
            dependents: dependents.map((d) => d.name),
          });
        }
      }

      // 按优先级排序
      return recommendations
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 10); // 只返回前10个推荐
    } catch (error) {
      this.logger.error(
        'Error generating personalized recommendations:',
        describeErrorForLog(error),
      );
      return [];
    }
  }

  async getProblemRecommendations(
    userId: string,
    options: {
      difficulty?: 'easy' | 'medium' | 'hard';
      conceptId?: string;
      limit?: number;
    },
  ): Promise<ProblemRecommendation[]> {
    try {
      const { difficulty, conceptId, limit = 5 } = options;

      // 获取用户的学习数据
      const conceptProgress =
        await this.learningService.getConceptProgress(userId);
      const practiceHistory = await this.learningService.getPracticeHistory(
        userId,
        { limit: 50 },
      );

      // 推荐必须来自真实题库；没有题目时返回空数组，不再返回演示题。
      const targetConcepts = conceptId
        ? [
            {
              conceptId,
              masteryLevel:
                conceptProgress.find((p) => p.conceptId === conceptId)
                  ?.masteryLevel || 0,
            },
          ]
        : conceptProgress
            .slice()
            .sort((a, b) => a.masteryLevel - b.masteryLevel)
            .slice(0, 5)
            .map((p) => ({
              conceptId: p.conceptId,
              masteryLevel: p.masteryLevel,
            }));

      const recommendations: ProblemRecommendation[] = [];
      const seen = new Set<string>();
      for (const target of targetConcepts) {
        const questions =
          await this.questionsService.getSpecialPracticeQuestions(
            target.conceptId,
            this.toQuestionDifficulty(difficulty),
            Math.max(limit * 2, 5),
          );

        for (const question of questions) {
          const id = question.questionId || String(question._id);
          if (!id || seen.has(id)) continue;
          seen.add(id);

          const normalizedDifficulty = this.fromQuestionDifficulty(
            question.difficulty,
          );
          const errorCount = practiceHistory.records.filter(
            (record) => record.problemText === id && !record.isCorrect,
          ).length;
          const priority = Math.round(
            (1 - target.masteryLevel) * 100 +
              errorCount * 15 +
              (normalizedDifficulty === 'hard' ? 5 : 0),
          );

          recommendations.push({
            problemId: id,
            problemText: question.content,
            difficulty: normalizedDifficulty,
            relatedConcepts: [
              question.knowledgePoint,
              ...(question.subConcepts || []),
            ],
            estimatedTime: this.parseEstimatedTime(question.estimatedTime),
            priority,
            reason:
              errorCount > 0
                ? `你在这道题上曾答错 ${errorCount} 次，建议重新巩固`
                : this.generateProblemRecommendationReason(
                    question,
                    conceptProgress,
                  ),
          });
        }
      }

      return recommendations
        .sort((a, b) => b.priority - a.priority)
        .slice(0, Math.max(1, Math.min(limit, 50)));
    } catch (error) {
      this.logger.error(
        'Error generating problem recommendations:',
        describeErrorForLog(error),
      );
      return [];
    }
  }

  async generateLearningPath(
    userId: string,
    targetConceptId: string,
  ): Promise<LearningPath> {
    try {
      // 获取目标概念的学习路径
      const learningPath =
        await this.knowledgeService.getLearningPath(targetConceptId);
      const conceptProgress =
        await this.learningService.getConceptProgress(userId);

      // 构建个性化学习路径
      const pathConcepts = learningPath.path.map((concept, index) => {
        const progress = conceptProgress.find(
          (p) => p.conceptId === concept.id,
        );
        return {
          conceptId: concept.id,
          conceptName: concept.name,
          order: index + 1,
          estimatedTime: this.estimateLearningTime(
            concept.difficulty || 'medium',
          ),
          difficulty: (concept.difficulty || 'medium') as
            | 'easy'
            | 'medium'
            | 'hard',
        };
      });

      const totalTime = pathConcepts.reduce(
        (sum, concept) => sum + concept.estimatedTime,
        0,
      );

      return {
        id: `path-${Date.now()}`,
        name: `学习路径：${learningPath.path[learningPath.path.length - 1].name}`,
        description: `从基础概念到${learningPath.path[learningPath.path.length - 1].name}的完整学习路径`,
        concepts: pathConcepts,
        totalTime,
        targetMastery: 0.8,
      };
    } catch (error) {
      this.logger.error(
        'Error generating learning path:',
        describeErrorForLog(error),
      );
      throw error;
    }
  }

  async adjustDifficulty(
    userId: string,
    problemId: string,
    isCorrect: boolean,
  ): Promise<'easy' | 'medium' | 'hard'> {
    try {
      // 获取用户最近的解题历史
      const history = await this.learningService.getPracticeHistory(userId, {
        limit: 10,
      });

      // 计算最近的正确率
      const recentCorrectCount = history.records.filter(
        (r) => r.isCorrect,
      ).length;
      const recentTotalCount = history.records.length;
      const recentCorrectRate =
        recentTotalCount > 0 ? recentCorrectCount / recentTotalCount : 0;

      // 根据正确率调整难度
      if (recentCorrectRate >= 0.8) {
        return 'hard';
      } else if (recentCorrectRate >= 0.5) {
        return 'medium';
      } else {
        return 'easy';
      }
    } catch (error) {
      this.logger.error(
        'Error adjusting difficulty:',
        describeErrorForLog(error),
      );
      return 'medium'; // 默认难度
    }
  }

  private calculatePriority(
    concept: any,
    masteryLevel: number,
    reviewPriority: number,
    averageMastery: number,
  ): number {
    let priority = 0;

    // 基于掌握程度的优先级
    if (masteryLevel < 0.3) {
      priority += 100; // 非常薄弱的知识点
    } else if (masteryLevel < 0.6) {
      priority += 60; // 中等薄弱的知识点
    } else if (masteryLevel < 0.8) {
      priority += 30; // 接近掌握的知识点
    }

    // 基于复习优先级的加分
    priority += reviewPriority * 0.5;

    // 基于难度的调整
    if (concept.difficulty === 'hard') {
      priority += 20;
    } else if (concept.difficulty === 'medium') {
      priority += 10;
    }

    // 基于知识图谱重要性的调整
    if (concept.tags && concept.tags.includes('核心概念')) {
      priority += 30;
    }

    return priority;
  }

  private toQuestionDifficulty(
    difficulty?: 'easy' | 'medium' | 'hard',
  ): string | undefined {
    if (!difficulty) return undefined;
    return difficulty === 'easy'
      ? '基础'
      : difficulty === 'hard'
        ? '困难'
        : '中等';
  }

  private fromQuestionDifficulty(
    difficulty?: string,
  ): 'easy' | 'medium' | 'hard' {
    if (difficulty === '基础' || difficulty === '简单') return 'easy';
    if (difficulty === '困难' || difficulty === '较难' || difficulty === 'hard')
      return 'hard';
    return 'medium';
  }

  private parseEstimatedTime(value?: string): number {
    if (!value) return 15;
    const match = String(value).match(/[0-9]+(?:\\.[0-9]+)?/);
    return match ? Math.max(1, Math.round(Number(match[0]))) : 15;
  }

  private calculateProblemPriority(
    problem: any,
    conceptProgress: any[],
    practiceHistory: any[],
  ): number {
    let priority = 0;

    // 基于相关概念的掌握程度
    for (const conceptId of problem.relatedConcepts) {
      const progress = conceptProgress.find((p) => p.conceptId === conceptId);
      if (progress && progress.masteryLevel < 0.7) {
        priority += (0.7 - progress.masteryLevel) * 50;
      }
    }

    // 基于历史错误频率
    const errorCount = practiceHistory.filter(
      (h) =>
        h.problemText && h.problemText.includes(problem.text) && !h.isCorrect,
    ).length;
    priority += errorCount * 20;

    // 基于难度的调整
    if (problem.difficulty === 'hard') {
      priority += 10;
    }

    return priority;
  }

  private estimateLearningTime(difficulty: 'easy' | 'medium' | 'hard'): number {
    switch (difficulty) {
      case 'easy':
        return 15;
      case 'medium':
        return 30;
      case 'hard':
        return 45;
      default:
        return 30;
    }
  }

  private generateRecommendationReason(concept: any, progress: any): string {
    if (!progress || progress.masteryLevel < 0.3) {
      return `您对「${concept.name}」的掌握程度较低，需要重点学习`;
    } else if (progress.masteryLevel < 0.6) {
      return `「${concept.name}」是重要的知识点，建议进一步巩固`;
    } else if (progress.masteryLevel < 0.8) {
      return `「${concept.name}」接近掌握，建议加强练习以达到精通`;
    } else {
      return `「${concept.name}」已基本掌握，可以学习相关的进阶知识点`;
    }
  }

  private generateProblemRecommendationReason(
    problem: any,
    conceptProgress: any[],
  ): string {
    const weakConcepts = problem.relatedConcepts.filter((conceptId: string) => {
      const progress = conceptProgress.find((p) => p.conceptId === conceptId);
      return progress && progress.masteryLevel < 0.7;
    });

    if (weakConcepts.length > 0) {
      return `该题目涉及您的薄弱知识点，有助于巩固相关概念`;
    } else {
      return `该题目难度适中，适合当前学习水平`;
    }
  }
}
