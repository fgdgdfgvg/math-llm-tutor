import { Injectable, Logger } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { LearningService } from '../learning/learning.service';
import {
  KnowledgeNode,
  KnowledgeRelationType,
} from './interfaces/knowledge.interfaces';

// 诊断结果类型定义
export interface DiagnosisResult {
  isCorrect: boolean;
  errorType?: string;
  errorSubType?: string;
  errorDetails?: Array<{
    type: string;
    subType?: string;
    severity: 'minor' | 'moderate' | 'major';
    description: string;
    location?: {
      step?: number;
      expression?: string;
      position?: { start: number; end: number };
    };
    confidence: number;
  }>;
  errorStep?: number;
  errorDescription?: string;
  relatedConcepts?: string[];
  suggestions?: string[];
  metrics?: {
    accuracy: number;
    completeness: number;
    efficiency: number;
    conceptualUnderstanding: number;
    proceduralFluency: number;
  };
  knowledgeGaps?: string[];
}

interface KnowledgeMapping {
  conceptId: string;
  conceptName: string;
  relevance: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface MasteryUpdate {
  conceptId: string;
  conceptName: string;
  oldMastery: number;
  newMastery: number;
  change: number;
  reason: string;
}

interface LearningPathNode {
  conceptId: string;
  conceptName: string;
  mastery: number;
  difficulty: 'easy' | 'medium' | 'hard';
  prerequisites: string[];
  dependents: string[];
  estimatedTime: number;
}

@Injectable()
export class KnowledgeGraphService {
  private readonly logger = new Logger(KnowledgeGraphService.name);

  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly learningService: LearningService,
  ) {}

  async mapDiagnosisToKnowledge(
    diagnosisResult: DiagnosisResult,
    problemType: string,
  ): Promise<KnowledgeMapping[]> {
    const mappings: KnowledgeMapping[] = [];

    // 基于错误类型映射到知识点
    if (diagnosisResult.errorType) {
      const errorBasedMappings = this.mapErrorTypeToKnowledge(
        diagnosisResult.errorType,
        diagnosisResult.errorSubType,
      );
      mappings.push(...errorBasedMappings);
    }

    // 基于相关概念映射
    if (
      diagnosisResult.relatedConcepts &&
      diagnosisResult.relatedConcepts.length > 0
    ) {
      for (const concept of diagnosisResult.relatedConcepts) {
        const conceptMappings = await this.searchConceptsByKeyword(concept);
        mappings.push(...conceptMappings);
      }
    }

    // 基于问题类型映射
    const problemTypeMappings =
      await this.mapProblemTypeToKnowledge(problemType);
    mappings.push(...problemTypeMappings);

    // 去重和排序
    const uniqueMappings = this.deduplicateMappings(mappings);
    return uniqueMappings.sort((a, b) => b.relevance - a.relevance).slice(0, 5);
  }

  private mapErrorTypeToKnowledge(
    errorType: string,
    errorSubType?: string,
  ): KnowledgeMapping[] {
    const mappings: KnowledgeMapping[] = [];

    const errorToKnowledgeMap: Record<string, KnowledgeMapping[]> = {
      CONCEPTUAL: [
        {
          conceptId: 'limit-definition',
          conceptName: '极限的定义',
          relevance: 0.9,
          difficulty: 'medium',
        },
        {
          conceptId: 'derivative-definition',
          conceptName: '导数的定义',
          relevance: 0.8,
          difficulty: 'medium',
        },
        {
          conceptId: 'integral-definition',
          conceptName: '积分的定义',
          relevance: 0.8,
          difficulty: 'medium',
        },
      ],
      CALCULATION: [
        {
          conceptId: 'limit-computation',
          conceptName: '极限的计算方法',
          relevance: 0.9,
          difficulty: 'medium',
        },
        {
          conceptId: 'derivative-rules',
          conceptName: '基本求导公式',
          relevance: 0.8,
          difficulty: 'easy',
        },
        {
          conceptId: 'substitution-method',
          conceptName: '换元积分法',
          relevance: 0.7,
          difficulty: 'medium',
        },
      ],
      PROCEDURAL: [
        {
          conceptId: 'chain-rule',
          conceptName: '链式法则',
          relevance: 0.8,
          difficulty: 'medium',
        },
        {
          conceptId: 'product-rule',
          conceptName: '乘积法则',
          relevance: 0.7,
          difficulty: 'easy',
        },
        {
          conceptId: 'integration-by-parts',
          conceptName: '分部积分法',
          relevance: 0.7,
          difficulty: 'medium',
        },
      ],
      NOTATION: [
        {
          conceptId: 'limit-definition',
          conceptName: '极限的定义',
          relevance: 0.7,
          difficulty: 'medium',
        },
        {
          conceptId: 'derivative-definition',
          conceptName: '导数的定义',
          relevance: 0.7,
          difficulty: 'medium',
        },
      ],
      LOGICAL: [
        {
          conceptId: 'mean-value-theorem',
          conceptName: '中值定理',
          relevance: 0.8,
          difficulty: 'hard',
        },
        {
          conceptId: 'fundamental-theorem',
          conceptName: '微积分基本定理',
          relevance: 0.8,
          difficulty: 'hard',
        },
      ],
    };

    if (errorToKnowledgeMap[errorType]) {
      mappings.push(...errorToKnowledgeMap[errorType]);
    }

    return mappings;
  }

  private async searchConceptsByKeyword(
    keyword: string,
  ): Promise<KnowledgeMapping[]> {
    const searchResults = await this.knowledgeService.searchConcepts(keyword);
    return searchResults.map((result) => ({
      conceptId: result.name.toLowerCase().replace(/\s+/g, '-'),
      conceptName: result.name,
      relevance: result.score / 10,
      difficulty: result.difficulty as 'easy' | 'medium' | 'hard',
    }));
  }

  private async mapProblemTypeToKnowledge(
    problemType: string,
  ): Promise<KnowledgeMapping[]> {
    const mappings: KnowledgeMapping[] = [];

    const problemTypeMap: Record<string, KnowledgeMapping[]> = {
      LIMIT: [
        {
          conceptId: 'limit-definition',
          conceptName: '极限的定义',
          relevance: 0.9,
          difficulty: 'medium',
        },
        {
          conceptId: 'limit-properties',
          conceptName: '极限的性质',
          relevance: 0.8,
          difficulty: 'easy',
        },
        {
          conceptId: 'limit-computation',
          conceptName: '极限的计算方法',
          relevance: 0.9,
          difficulty: 'medium',
        },
      ],
      DERIVATIVE: [
        {
          conceptId: 'derivative-definition',
          conceptName: '导数的定义',
          relevance: 0.9,
          difficulty: 'medium',
        },
        {
          conceptId: 'derivative-rules',
          conceptName: '基本求导公式',
          relevance: 0.9,
          difficulty: 'easy',
        },
        {
          conceptId: 'chain-rule',
          conceptName: '链式法则',
          relevance: 0.8,
          difficulty: 'medium',
        },
      ],
      INTEGRAL: [
        {
          conceptId: 'integral-definition',
          conceptName: '积分的定义',
          relevance: 0.9,
          difficulty: 'medium',
        },
        {
          conceptId: 'substitution-method',
          conceptName: '换元积分法',
          relevance: 0.8,
          difficulty: 'medium',
        },
        {
          conceptId: 'integration-by-parts',
          conceptName: '分部积分法',
          relevance: 0.8,
          difficulty: 'medium',
        },
      ],
      SERIES: [
        {
          conceptId: 'taylor-series',
          conceptName: '泰勒级数',
          relevance: 0.9,
          difficulty: 'hard',
        },
        {
          conceptId: 'power-series',
          conceptName: '幂级数',
          relevance: 0.8,
          difficulty: 'hard',
        },
        {
          conceptId: 'convergence-tests',
          conceptName: '级数审敛法',
          relevance: 0.8,
          difficulty: 'hard',
        },
      ],
      EQUATION: [
        {
          conceptId: 'limit-computation',
          conceptName: '极限的计算方法',
          relevance: 0.7,
          difficulty: 'medium',
        },
        {
          conceptId: 'derivative-rules',
          conceptName: '基本求导公式',
          relevance: 0.7,
          difficulty: 'easy',
        },
      ],
      SIMPLIFICATION: [
        {
          conceptId: 'limit-computation',
          conceptName: '极限的计算方法',
          relevance: 0.7,
          difficulty: 'medium',
        },
        {
          conceptId: 'derivative-rules',
          conceptName: '基本求导公式',
          relevance: 0.7,
          difficulty: 'easy',
        },
      ],
      PROOF: [
        {
          conceptId: 'mean-value-theorem',
          conceptName: '中值定理',
          relevance: 0.8,
          difficulty: 'hard',
        },
        {
          conceptId: 'fundamental-theorem',
          conceptName: '微积分基本定理',
          relevance: 0.8,
          difficulty: 'hard',
        },
      ],
    };

    if (problemTypeMap[problemType]) {
      mappings.push(...problemTypeMap[problemType]);
    }

    return mappings;
  }

  private deduplicateMappings(
    mappings: KnowledgeMapping[],
  ): KnowledgeMapping[] {
    const uniqueMap = new Map<string, KnowledgeMapping>();
    mappings.forEach((mapping) => {
      const existing = uniqueMap.get(mapping.conceptId);
      if (!existing || mapping.relevance > existing.relevance) {
        uniqueMap.set(mapping.conceptId, mapping);
      }
    });
    return Array.from(uniqueMap.values());
  }

  async updateMasteryFromDiagnosis(
    userId: string,
    diagnosisResult: DiagnosisResult,
    problemType: string,
  ): Promise<MasteryUpdate[]> {
    const knowledgeMappings = await this.mapDiagnosisToKnowledge(
      diagnosisResult,
      problemType,
    );
    const updates: MasteryUpdate[] = [];

    for (const mapping of knowledgeMappings) {
      // 计算掌握度变化
      let masteryChange = 0;
      let reason = '';

      if (diagnosisResult.isCorrect) {
        // 正确答案，提升掌握度
        masteryChange = 0.1 * mapping.relevance;
        reason = `问题解答正确，增强对${mapping.conceptName}的掌握`;
      } else {
        // 错误答案，根据错误严重程度调整掌握度
        const errorSeverity = this.calculateErrorSeverity(diagnosisResult);
        masteryChange = -0.15 * errorSeverity * mapping.relevance;
        reason = `问题解答错误，需要加强${mapping.conceptName}的学习`;
      }

      // 记录学习行为
      const existingRecord =
        await this.learningService.getConceptProgress(userId);
      const existingConcept = existingRecord.find(
        (r) => r.conceptId === mapping.conceptId,
      );
      const oldMastery = existingConcept?.masteryLevel || 0;
      const newMastery = Math.max(0, Math.min(1, oldMastery + masteryChange));

      await this.learningService.recordLearning(userId, {
        conceptId: mapping.conceptId,
        conceptName: mapping.conceptName,
        action: diagnosisResult.isCorrect ? 'practice' : 'review',
        masteryLevel: newMastery,
        isCorrect: diagnosisResult.isCorrect,
      });

      updates.push({
        conceptId: mapping.conceptId,
        conceptName: mapping.conceptName,
        oldMastery,
        newMastery,
        change: masteryChange,
        reason,
      });
    }

    return updates;
  }

  private calculateErrorSeverity(diagnosisResult: DiagnosisResult): number {
    if (
      !diagnosisResult.errorDetails ||
      diagnosisResult.errorDetails.length === 0
    ) {
      return 0.5;
    }

    const severityScores = diagnosisResult.errorDetails.map((error) => {
      switch (error.severity) {
        case 'major':
          return 1.0;
        case 'moderate':
          return 0.7;
        case 'minor':
          return 0.3;
        default:
          return 0.5;
      }
    });

    return (
      severityScores.reduce((sum, score) => sum + score, 0) /
      severityScores.length
    );
  }

  async generatePersonalizedLearningPath(
    userId: string,
    targetConceptId?: string,
  ): Promise<LearningPathNode[]> {
    const conceptProgress =
      await this.learningService.getConceptProgress(userId);
    const progressMap = new Map(conceptProgress.map((p) => [p.conceptId, p]));

    let startConcepts: string[] = [];
    if (targetConceptId) {
      // 从目标概念开始，构建逆向学习路径
      startConcepts = [targetConceptId];
    } else {
      // 找出掌握度最低的概念作为起点
      const weakConcepts = conceptProgress
        .filter((p) => p.masteryLevel < 0.6)
        .sort((a, b) => a.masteryLevel - b.masteryLevel)
        .slice(0, 3)
        .map((p) => p.conceptId);
      startConcepts =
        weakConcepts.length > 0 ? weakConcepts : ['limit-definition'];
    }

    const path: LearningPathNode[] = [];
    const visited = new Set<string>();

    for (const conceptId of startConcepts) {
      await this.buildLearningPathNode(conceptId, path, visited, progressMap);
    }

    // 按掌握度和难度排序
    return path.sort((a, b) => {
      // 先按掌握度排序（低掌握度优先）
      if (a.mastery !== b.mastery) {
        return a.mastery - b.mastery;
      }
      // 再按难度排序（简单优先）
      const difficultyOrder = { easy: 0, medium: 1, hard: 2 };
      return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
    });
  }

  private async buildLearningPathNode(
    conceptId: string,
    path: LearningPathNode[],
    visited: Set<string>,
    progressMap: Map<string, any>,
  ): Promise<void> {
    if (visited.has(conceptId)) {
      return;
    }
    visited.add(conceptId);

    // 获取概念信息
    const concept = await this.knowledgeService.getConcept(conceptId);
    if (!concept) {
      return;
    }

    // 获取前置概念
    const prerequisites =
      await this.knowledgeService.getPrerequisites(conceptId);
    for (const prereq of prerequisites) {
      if (prereq.id && !visited.has(prereq.id)) {
        await this.buildLearningPathNode(prereq.id, path, visited, progressMap);
      }
    }

    // 获取依赖概念
    const dependents =
      await this.knowledgeService.getDependentConcepts(conceptId);

    // 获取掌握度
    const progress = progressMap.get(conceptId);
    const mastery = progress?.masteryLevel || 0;

    path.push({
      conceptId: concept.id,
      conceptName: concept.name,
      mastery,
      difficulty: concept.difficulty as 'easy' | 'medium' | 'hard',
      prerequisites: prerequisites.map((p) => p.id),
      dependents: dependents.map((d) => d.id),
      estimatedTime: this.calculateEstimatedTime(concept.difficulty, mastery),
    });
  }

  private calculateEstimatedTime(difficulty: string, mastery: number): number {
    const baseTime =
      {
        easy: 15,
        medium: 30,
        hard: 45,
      }[difficulty] || 30;

    // 掌握度越高，所需时间越少
    return Math.round(baseTime * (1 - mastery * 0.5));
  }

  async getKnowledgeGraphStatus(userId: string): Promise<{
    nodes: LearningPathNode[];
    edges: { source: string; target: string; type: string }[];
  }> {
    const conceptProgress =
      await this.learningService.getConceptProgress(userId);
    const progressMap = new Map(conceptProgress.map((p) => [p.conceptId, p]));

    // 获取所有概念
    const allConcepts = await this.knowledgeService.getAllConcepts();
    const nodes: LearningPathNode[] = [];
    const edges: { source: string; target: string; type: string }[] = [];

    for (const concept of allConcepts) {
      if (!concept.id) continue;

      const progress = progressMap.get(concept.id);
      const mastery = progress?.masteryLevel || 0;

      nodes.push({
        conceptId: concept.id,
        conceptName: concept.name,
        mastery,
        difficulty: concept.difficulty as 'easy' | 'medium' | 'hard',
        prerequisites: [],
        dependents: [],
        estimatedTime: this.calculateEstimatedTime(concept.difficulty, mastery),
      });

      // 获取前置关系
      const prerequisites = await this.knowledgeService.getPrerequisites(
        concept.id,
      );
      for (const prereq of prerequisites) {
        if (prereq.id) {
          edges.push({
            source: prereq.id,
            target: concept.id,
            type: 'prerequisite',
          });
        }
      }
    }

    return { nodes, edges };
  }

  async getRecommendedConcepts(
    userId: string,
    limit: number = 5,
  ): Promise<
    {
      conceptId: string;
      conceptName: string;
      mastery: number;
      priority: number;
      reason: string;
    }[]
  > {
    const conceptProgress =
      await this.learningService.getConceptProgress(userId);
    const recommendations: {
      conceptId: string;
      conceptName: string;
      mastery: number;
      priority: number;
      reason: string;
    }[] = [];

    // 推荐掌握度低的概念
    const weakConcepts = conceptProgress
      .filter((p) => p.masteryLevel < 0.6)
      .sort((a, b) => a.masteryLevel - b.masteryLevel)
      .slice(0, limit / 2);

    for (const concept of weakConcepts) {
      recommendations.push({
        conceptId: concept.conceptId,
        conceptName: concept.conceptName,
        mastery: concept.masteryLevel,
        priority: Math.round((1 - concept.masteryLevel) * 100),
        reason: `掌握度较低，需要加强学习`,
      });
    }

    // 推荐新的相关概念
    const masteredConcepts = conceptProgress
      .filter((p) => p.masteryLevel >= 0.8)
      .sort((a, b) => b.masteryLevel - a.masteryLevel)
      .slice(0, 3);

    for (const concept of masteredConcepts) {
      const dependentConcepts =
        await this.knowledgeService.getDependentConcepts(concept.conceptId);
      for (const dependent of dependentConcepts) {
        if (!dependent.id) continue;

        const existingProgress = conceptProgress.find(
          (p) => p.conceptId === dependent.id,
        );
        if (!existingProgress || existingProgress.masteryLevel < 0.5) {
          recommendations.push({
            conceptId: dependent.id,
            conceptName: dependent.name,
            mastery: existingProgress?.masteryLevel || 0,
            priority:
              80 - Math.round((existingProgress?.masteryLevel || 0) * 50),
            reason: `基于已掌握的${concept.conceptName}，推荐学习进阶内容`,
          });
        }
      }
    }

    return recommendations
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit);
  }
}
