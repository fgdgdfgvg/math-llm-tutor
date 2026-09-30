import { Injectable } from '@nestjs/common';
import { LearningService, ConceptProgress, LearningStats } from '../learning/learning.service';
import { AssessmentResult, KnowledgeStats } from './types';

@Injectable()
export class AssessmentService {
  constructor(private readonly learningService: LearningService) {}

  async generateAssessmentReport(userId: string): Promise<AssessmentResult> {
    const stats = await this.getKnowledgeStats(userId);
    const overallMastery = this.calculateOverallMastery(stats);
    const strategyMaturity = this.calculateStrategyMaturity(stats);
    const antiInterference = this.calculateAntiInterference(stats);
    const predictiveScore = `${Math.round(overallMastery * 0.7 + strategyMaturity * 0.3)}/100`;
    const { strengths, weaknesses } = this.analyzeStrengthsWeaknesses(stats);

    return {
      overallMastery,
      strategyMaturity,
      antiInterference,
      predictiveScore,
      strengths,
      weaknesses,
      recommendations: this.generateRecommendations(weaknesses, stats),
    };
  }

  private async getKnowledgeStats(userId: string): Promise<KnowledgeStats[]> {
    const progress = await this.learningService.getConceptProgress(userId);
    return progress.map((item) => ({
      conceptId: item.conceptId,
      conceptName: item.conceptName,
      mastery: Math.round(item.masteryLevel * 100),
      practiceCount: item.attemptsCount,
      correctRate: item.correctRate,
      errorPatterns: item.incorrectCount > 0
        ? [`${item.incorrectCount} 次答错`]
        : [],
    }));
  }

  private calculateOverallMastery(stats: KnowledgeStats[]): number {
    if (stats.length === 0) return 0;
    return Math.round(stats.reduce((sum, stat) => sum + stat.mastery, 0) / stats.length);
  }

  private calculateStrategyMaturity(stats: KnowledgeStats[]): number {
    if (stats.length === 0) return 0;
    return Math.round(stats.reduce((sum, stat) => {
      const practiceScore = Math.min(stat.practiceCount / 10, 1) * 50;
      return sum + practiceScore + (stat.correctRate / 100) * 50;
    }, 0) / stats.length);
  }

  private calculateAntiInterference(stats: KnowledgeStats[]): number {
    if (stats.length === 0) return 0;
    return Math.round(stats.reduce((sum, stat) => {
      const consistencyScore = (stat.correctRate / 100) * 70;
      const practiceEvidence = Math.min(stat.practiceCount / 10, 1) * 30;
      return sum + consistencyScore + practiceEvidence;
    }, 0) / stats.length);
  }

  private analyzeStrengthsWeaknesses(stats: KnowledgeStats[]) {
    return {
      strengths: stats.filter((stat) => stat.mastery >= 80).map((stat) => stat.conceptName),
      weaknesses: stats.filter((stat) => stat.mastery < 60).map((stat) => stat.conceptName),
    };
  }

  private generateRecommendations(weaknesses: string[], stats: KnowledgeStats[]): string[] {
    const recommendations: string[] = [];
    if (weaknesses.length > 0) {
      recommendations.push(`优先练习：${weaknesses.slice(0, 3).join('、')}`);
    }

    const lowAccuracy = stats
      .filter((stat) => stat.practiceCount > 0 && stat.correctRate < 70)
      .sort((a, b) => a.correctRate - b.correctRate);
    if (lowAccuracy.length > 0) {
      recommendations.push(`重点复盘正确率较低的知识点：${lowAccuracy.slice(0, 3).map((s) => s.conceptName).join('、')}`);
    }

    const underPracticed = stats.filter((stat) => stat.practiceCount < 5);
    if (underPracticed.length > 0) {
      recommendations.push(`增加练习次数：${underPracticed.slice(0, 3).map((s) => s.conceptName).join('、')}`);
    }

    if (recommendations.length === 0 && stats.length > 0) {
      recommendations.push('保持当前练习节奏，尝试更高难度的综合题。');
    }
    return recommendations;
  }

  async getComparisonData(userId: string): Promise<any> {
    const [stats, progress, learningStats] = await Promise.all([
      this.getKnowledgeStats(userId),
      this.learningService.getConceptProgress(userId),
      this.learningService.getLearningStats(userId),
    ]);

    const totalAttempts = stats.reduce((sum, item) => sum + item.practiceCount, 0);
    const personalAccuracy = totalAttempts > 0
      ? Math.round(stats.reduce((sum, item) => sum + item.correctRate * item.practiceCount, 0) / totalAttempts)
      : 0;
    const totalMinutes = learningStats.totalPracticeTime / 60;
    const speed = totalMinutes > 0 ? Math.round(totalAttempts / totalMinutes * 10) / 10 : 0;

    return {
      personal: {
        mastery: this.calculateOverallMastery(stats),
        strategy: this.calculateStrategyMaturity(stats),
        antiInterference: this.calculateAntiInterference(stats),
        accuracy: personalAccuracy,
        speed,
      },
      // 没有班级/群体数据时明确返回 null，避免把固定数字伪装成真实对比。
      classAverage: null,
      sampleSize: progress.length,
      comparisonAvailable: false,
    };
  }
}
