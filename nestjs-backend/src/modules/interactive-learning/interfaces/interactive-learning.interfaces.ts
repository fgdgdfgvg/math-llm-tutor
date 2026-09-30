import { KnowledgeNode, KnowledgeRelation, KnowledgeRelationType } from '../../knowledge/interfaces/knowledge.interfaces';
import {
  DynamicKnowledgeNode,
  DynamicKnowledgeRelation,
  ScenarioContext,
  RelationContext,
  CognitiveState,
} from '../types/interactive-learning.types';

export interface IKnowledgeRepository {
  getAllNodes(): Promise<KnowledgeNode[]>;
  getNodeById(id: string): Promise<KnowledgeNode | null>;
  getNodesByTags(tags: string[]): Promise<KnowledgeNode[]>;
  getAllRelations(): Promise<KnowledgeRelation[]>;
  getRelationsBySource(sourceId: string): Promise<KnowledgeRelation[]>;
}

export interface ILearningStatsProvider {
  getUserLearningHistory(userId: string, limit?: number): Promise<any[]>;
  getUserMasteryLevel(userId: string, conceptId: string): Promise<number>;
  getUserRecentErrors(userId: string, limit?: number): Promise<any[]>;
  getUserAverageAccuracy(userId: string, timeRange?: { start: Date; end: Date }): Promise<number>;
  getUserLearningVelocity(userId: string): Promise<number>;
  isServiceHealthy(): boolean;
}

export interface ICognitiveAssessor {
  assess(userId: string): Promise<CognitiveState>;

  estimateCognitiveLoad(
    userId: string,
    recentInteractions: any[],
    timeWindowMs?: number,
  ): Promise<number>;

  estimateLearningVelocity(
    accuracyHistory: number[],
    timestamps: Date[],
  ): Promise<number>;

  predictMasteryCurve(
    currentMastery: number,
    learningVelocity: number,
    timePoints: number[],
  ): Promise<number[]>;
}

export interface IWeightCalculator {
  calculateDynamicWeight(
    baseWeight: number,
    scenarioContext: ScenarioContext,
    relationContext: RelationContext,
  ): number;

  calculateRelevanceScore(node: KnowledgeNode, knowledgeArea: string): number;

  calculateActivationLevel(
    masteryLevel: number,
    relevanceScore: number,
    accessCount: number,
  ): number;
}

export interface ICacheManager {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  keys(pattern?: string): Promise<string[]>;
}
