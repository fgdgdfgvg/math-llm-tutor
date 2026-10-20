import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
  Optional,
} from '@nestjs/common';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { KnowledgePointMappingService } from '../../knowledge/knowledge-point-mapping.service';
import { LearningService } from '../../learning/learning.service';
import {
  DynamicKnowledgeNode,
  DynamicKnowledgeRelation,
  ScenarioContext,
  RelationContext,
  CognitiveState,
} from '../types/interactive-learning.types';
import {
  KnowledgeNode as BaseKnowledgeNode,
  KnowledgeRelation as BaseKnowledgeRelation,
} from '../../knowledge/interfaces/knowledge.interfaces';
import {
  IKnowledgeRepository,
  ILearningStatsProvider,
  ICognitiveAssessor,
  IWeightCalculator,
  ICacheManager,
} from '../interfaces/interactive-learning.interfaces';
import type {
  WeightConfig,
  TagRelevanceMap,
  KnowledgeArea,
} from '../types/interactive-learning.schemas';
import {
  DefaultWeightConfig,
  DefaultTagRelevance,
} from '../types/interactive-learning.schemas';
import {
  InMemoryCacheManager,
  sharedCacheManager,
  cognitiveStateCacheKey,
} from '../utils/in-memory-cache.util';
import { CircuitBreaker } from '../utils/circuit-breaker.util';

@Injectable()
export class DynamicKnowledgeGraphService
  implements OnModuleInit, IWeightCalculator
{
  private readonly logger = new Logger(DynamicKnowledgeGraphService.name);

  private relationCache: Map<string, DynamicKnowledgeRelation> = new Map();
  private nodeCache: Map<string, DynamicKnowledgeNode> = new Map();
  private scenarioContextCache: Map<string, ScenarioContext> = new Map();

  private cacheManager: ICacheManager;

  private learningServiceCircuitBreaker: CircuitBreaker<CognitiveState>;

  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly learningService: LearningService,
    private readonly knowledgePointMapping: KnowledgePointMappingService,
    @Optional() private weightConfig: WeightConfig = DefaultWeightConfig,
    @Optional() private tagRelevance: TagRelevanceMap = DefaultTagRelevance,
  ) {
    // 共享实例：练习写入方（student 模块）需要能主动失效此缓存
    this.cacheManager = sharedCacheManager;
    this.learningServiceCircuitBreaker = new CircuitBreaker<CognitiveState>(
      'LearningService',
      {
        failureThreshold: 3,
        resetTimeoutMs: 30000,
        halfOpenMaxAttempts: 1,
        monitoringWindowMs: 60000,
      },
    );
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Dynamic Knowledge Graph Engine v2.0 initialized');
    this.logger.debug(`Weight config: ${JSON.stringify(this.weightConfig)}`);
    try {
      await this.initializeGraph();
    } catch (error: any) {
      this.logger.error(
        `Graph initialization failed, will retry on first request: ${error.message}`,
      );
    }
  }

  async initializeGraph(): Promise<void> {
    try {
      const { nodes, edges } = await this.knowledgeService.getKnowledgeGraph();

      for (const node of nodes) {
        this.nodeCache.set(node.id, this.createDynamicNode(node));
      }

      for (const edge of edges) {
        this.relationCache.set(
          `${edge.fromId}-${edge.toId}`,
          this.createDynamicRelation(edge),
        );
      }

      this.logger.log(
        `Initialized graph with ${nodes.length} nodes and ${edges.length} edges`,
      );
    } catch (error: any) {
      this.logger.error(`Failed to initialize graph: ${error.message}`);
      throw error;
    }
  }

  calculateDynamicWeight(
    baseWeight: number,
    scenarioContext: ScenarioContext,
    relationContext: RelationContext,
  ): number {
    if (
      relationContext.scenarioId &&
      relationContext.scenarioId !== scenarioContext.id
    ) {
      return 0;
    }

    const userLevelAdjustment =
      1 +
      (scenarioContext.userLevel - 0.5) *
        this.weightConfig.userLevelSensitivity;
    const urgencyFactor = scenarioContext.taskUrgency
      ? this.weightConfig.urgencyMultiplier
      : 1.0;

    const frequencyBonus = relationContext.frequency
      ? Math.min(
          1.2,
          1 +
            Math.log10(relationContext.frequency + 1) *
              (0.1 * Math.log10(this.weightConfig.frequencyLogBase)),
        )
      : 1.0;

    const recencyBonus = relationContext.lastUsed
      ? Math.max(
          this.weightConfig.recencyMinFactor,
          1 -
            (Date.now() - relationContext.lastUsed.getTime()) /
              (this.weightConfig.recencyDecayDays * 24 * 60 * 60 * 1000),
        )
      : 1.0;

    return Math.min(
      this.weightConfig.maxWeightCap,
      baseWeight *
        userLevelAdjustment *
        urgencyFactor *
        frequencyBonus *
        recencyBonus,
    );
  }

  calculateRelevanceScore(
    node: BaseKnowledgeNode | DynamicKnowledgeNode,
    knowledgeArea: string,
  ): number {
    const areaTagMapping = this.tagRelevance[knowledgeArea as KnowledgeArea];

    if (!areaTagMapping || !node.tags || node.tags.length === 0) {
      return 0.3;
    }

    let maxScore = 0.3;

    for (const mapping of areaTagMapping) {
      if (
        node.tags.some((tag) =>
          tag.toLowerCase().includes(mapping.tag.toLowerCase()),
        )
      ) {
        maxScore = Math.max(maxScore, mapping.score);
      }
    }

    return maxScore;
  }

  calculateActivationLevel(
    masteryLevel: number,
    relevanceScore: number,
    accessCount: number,
  ): number {
    const recencyFactor = Math.min(1.0, accessCount / 10);
    const zoneOfProximalDevelopment =
      masteryLevel > 0.2 && masteryLevel < 0.8 ? 1.2 : 1.0;

    return Math.min(
      1.0,
      (masteryLevel * 0.4 + relevanceScore * 0.4 + recencyFactor * 0.2) *
        zoneOfProximalDevelopment,
    );
  }

  async getDynamicGraph(
    userId: string,
    scenarioContext?: ScenarioContext,
  ): Promise<{
    nodes: DynamicKnowledgeNode[];
    relations: DynamicKnowledgeRelation[];
    filtered: boolean;
    totalNodes: number;
  }> {
    const cognitiveState =
      await this.getCognitiveStateWithCircuitBreaker(userId);
    const effectiveContext =
      scenarioContext || this.getDefaultScenarioContext(cognitiveState);

    let relevantNodes: DynamicKnowledgeNode[] = [];

    for (const [, node] of this.nodeCache) {
      const relevance = this.calculateRelevanceScore(
        node,
        effectiveContext.knowledgeArea,
      );

      if (relevance > 0.4 || !scenarioContext) {
        const updatedNode = await this.updateNodeDynamics(
          node,
          userId,
          effectiveContext,
          relevance,
        );
        relevantNodes.push(updatedNode);
        this.nodeCache.set(node.id, updatedNode);
      }
    }

    const dynamicRelations: DynamicKnowledgeRelation[] = [];
    const relevantNodeIds = new Set(relevantNodes.map((n) => n.id));

    for (const [, relation] of this.relationCache) {
      if (
        relevantNodeIds.has(relation.fromId) ||
        relevantNodeIds.has(relation.toId)
      ) {
        const relationContext: RelationContext = {
          scenarioId: effectiveContext.id,
          relationType: relation.type,
          frequency: relation.strengthHistory?.length || 0,
          lastUsed: relation.strengthHistory?.[
            relation.strengthHistory.length - 1
          ]
            ? new Date(
                relation.strengthHistory[relation.strengthHistory.length - 1]
                  .date,
              )
            : undefined,
        };

        const newWeight = this.calculateDynamicWeight(
          relation.weight || 0.5,
          effectiveContext,
          relationContext,
        );

        const updatedRelation: DynamicKnowledgeRelation = {
          ...relation,
          dynamicWeight: newWeight,
          contextWeights: relation.contextWeights || new Map(),
        };

        updatedRelation.contextWeights.set(effectiveContext.id, newWeight);
        updatedRelation.strengthHistory = [
          ...(relation.strengthHistory || []),
          { date: Date.now(), weight: newWeight },
        ].slice(-100);

        dynamicRelations.push(updatedRelation);
        this.relationCache.set(
          `${relation.fromId}-${relation.toId}`,
          updatedRelation,
        );
      }
    }

    return {
      nodes: relevantNodes,
      relations: dynamicRelations,
      filtered: !!scenarioContext,
      totalNodes: this.nodeCache.size,
    };
  }

  async updateNodeDynamics(
    node: DynamicKnowledgeNode,
    userId: string,
    scenarioContext: ScenarioContext,
    preCalculatedRelevance?: number,
  ): Promise<DynamicKnowledgeNode> {
    try {
      let masteryLevel = 0;

      try {
        const conceptProgress =
          await this.learningService.getConceptProgress(userId);
        // 学习记录按题库知识点归档（如“极限计算”），图谱节点是概念 id（如 limit_definition），
        // 需要经过映射翻译，否则节点掌握度永远是 0。
        const progress = conceptProgress.find(
          (p) =>
            p.conceptId === node.id ||
            this.knowledgePointMapping.matchesConcept(p.conceptId, node.id),
        );
        masteryLevel = progress?.masteryLevel || 0;
      } catch (error) {
        this.logger.warn(
          `Using cached/default mastery for ${node.id} due to service degradation`,
        );
        masteryLevel = 0;
      }

      const relevanceScore =
        preCalculatedRelevance ??
        this.calculateRelevanceScore(node, scenarioContext.knowledgeArea);
      const activationLevel = this.calculateActivationLevel(
        masteryLevel,
        relevanceScore,
        node.accessCount,
      );

      return {
        ...node,
        dynamicWeight: masteryLevel * relevanceScore,
        relevanceScore,
        activationLevel,
        masteryLevel,
        lastAccessed: node.lastAccessed || new Date(),
        accessCount: node.accessCount,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to update node dynamics for ${node.id}: ${error.message}`,
      );
      return node;
    }
  }

  async getCognitiveStateWithCircuitBreaker(
    userId: string,
  ): Promise<CognitiveState> {
    const cacheKey = cognitiveStateCacheKey(userId);

    const cached = await this.cacheManager.get<CognitiveState>(cacheKey);
    if (cached) {
      return cached;
    }

    return this.learningServiceCircuitBreaker.execute(
      async () => {
        const state = await this.computeFreshCognitiveState(userId);
        await this.cacheManager.set(cacheKey, state, 5 * 60 * 1000);
        return state;
      },
      async () => {
        this.logger.warn(`Using degraded cognitive state for user ${userId}`);
        return this.getDefaultCognitiveState(userId);
      },
    );
  }

  private async computeFreshCognitiveState(
    userId: string,
  ): Promise<CognitiveState> {
    const learningStats = await this.learningService.getLearningStats(userId);
    const conceptProgress =
      await this.learningService.getConceptProgress(userId);

    // 练习记录按题库知识点归档（“积分计算”），而认知模型的分类是按图谱概念 id 写的
    // （includes('definition') / includes('rules') ...）。不展开映射的话这些判定永远
    // 匹配不到，四个维度会静默退化成写死的默认值，看上去就像“事先做好的假分析”。
    const graphProgress = this.expandToGraphConcepts(conceptProgress);

    const avgMastery = learningStats.averageMastery || 0;

    const conceptualUnderstanding = this.calculateDimension(
      graphProgress,
      'conceptual',
    );
    const proceduralFluency = this.calculateDimension(
      graphProgress,
      'procedural',
    );
    const strategicCompetence = this.calculateStrategicCompetence(
      graphProgress,
      conceptProgress.length,
    );
    const adaptiveReasoning = this.calculateAdaptiveReasoning(conceptProgress);

    const cognitiveLoad = this.estimateCognitiveLoad(
      learningStats,
      conceptProgress,
    );
    const learningVelocity = this.calculateLearningVelocity(learningStats);
    const errorPattern = this.identifyErrorPatterns(conceptProgress);

    const state: CognitiveState = {
      userId,
      timestamp: new Date(),
      dimensions: {
        conceptualUnderstanding,
        proceduralFluency,
        strategicCompetence,
        adaptiveReasoning,
      },
      metrics: {
        cognitiveLoad,
        learningVelocity,
        errorPattern,
        attentionLevel: this.estimateAttentionLevel(learningStats),
        frustrationLevel: this.estimateFrustrationLevel(
          learningStats,
          conceptProgress,
        ),
      },
      predictions: {
        masteryPrediction: this.predictMasteryCurve(
          avgMastery,
          learningVelocity,
        ),
        optimalDifficulty: this.calculateOptimalDifficulty(avgMastery),
        recommendedIntervention: this.recommendInterventions(
          conceptualUnderstanding,
          proceduralFluency,
          cognitiveLoad,
          errorPattern,
        ),
      },
    };

    return state;
  }

  /**
   * 把按知识点归档的进度展开成按图谱概念 id 归档的进度：
   * “积分计算”(掌握度 0.57) → integral_definition / substitution_method / ...（同样 0.57），
   * 这样基于概念类型（definition / rules / method / theorem）的维度计算才有真实输入。
   */
  private expandToGraphConcepts(
    conceptProgress: Array<{
      conceptId: string;
      conceptIds?: string[];
      masteryLevel: number;
      status?: string;
    }>,
  ): Array<{ conceptId: string; masteryLevel: number; status: string }> {
    const expanded = new Map<
      string,
      { conceptId: string; masteryLevel: number; status: string }
    >();

    for (const item of conceptProgress) {
      const ids = item.conceptIds?.length ? item.conceptIds : [item.conceptId];
      for (const id of ids) {
        if (!id) continue;
        const existing = expanded.get(id);
        // 同一概念被多个知识点覆盖时，取更熟练的一条，避免低估
        if (!existing || item.masteryLevel > existing.masteryLevel) {
          expanded.set(id, {
            conceptId: id,
            masteryLevel: item.masteryLevel,
            status: item.status || 'learning',
          });
        }
      }
    }

    return Array.from(expanded.values());
  }

  private calculateDimension(
    conceptProgress: Array<{
      conceptId: string;
      masteryLevel: number;
      status: string;
    }>,
    type: 'conceptual' | 'procedural',
  ): number {
    const relevantConcepts = conceptProgress.filter((p) => {
      if (type === 'conceptual') {
        return (
          p.conceptId.includes('definition') ||
          p.conceptId.includes('theorem') ||
          p.conceptId.includes('continuity') ||
          p.conceptId.includes('properties')
        );
      }
      return (
        p.conceptId.includes('computation') ||
        p.conceptId.includes('rules') ||
        p.conceptId.includes('method') ||
        p.conceptId.includes('techniques') ||
        p.conceptId.includes('integral') ||
        p.conceptId.includes('derivative')
      );
    });

    // 没有相关练习就没有掌握证据，返回 0 而不是写死的 0.3
    if (relevantConcepts.length === 0) return 0;

    const avgMastery =
      relevantConcepts.reduce((sum, p) => sum + p.masteryLevel, 0) /
      relevantConcepts.length;
    return Math.min(1.0, Math.max(0, avgMastery));
  }

  /**
   * 策略能力 = 高阶方法（定理 / 洛必达 / 泰勒）掌握度 × 知识面广度。
   * @param knowledgePointCount 实际练习过的知识点个数（而非展开后的概念数），
   *        否则一个知识点会展开出十几个概念，广度会被凭空拉满。
   */
  private calculateStrategicCompetence(
    conceptProgress: Array<{ conceptId: string; masteryLevel: number }>,
    knowledgePointCount: number,
  ): number {
    const advancedConcepts = conceptProgress.filter(
      (p) =>
        p.conceptId.includes('theorem') ||
        p.conceptId.includes('lhopital') ||
        p.conceptId.includes('taylor') ||
        p.conceptId.includes('series'),
    );

    const strategyScore =
      advancedConcepts.length > 0
        ? advancedConcepts.reduce((sum, p) => sum + p.masteryLevel, 0) /
          advancedConcepts.length
        : 0;

    const diversityScore = Math.min(1.0, knowledgePointCount / 6);

    return strategyScore * 0.6 + diversityScore * 0.4;
  }

  /**
   * 适应性推理 = 改错后是否越做越准。
   * 用每个知识点“前半段 vs 后半段”的真实正确率差来衡量，
   * 而不是拿 掌握度/错误次数 这种与学习行为无关的比值凑数。
   */
  private calculateAdaptiveReasoning(
    conceptProgress: Array<{
      masteryLevel: number;
      earlyAccuracy?: number | null;
      recentAccuracy?: number | null;
    }>,
  ): number {
    const withTrend = conceptProgress.filter(
      (p) =>
        typeof p.earlyAccuracy === 'number' &&
        typeof p.recentAccuracy === 'number',
    );

    if (withTrend.length === 0) {
      // 练习次数太少，不足以判断趋势：按平均掌握度给出保守估计
      if (conceptProgress.length === 0) return 0;
      const avgMastery =
        conceptProgress.reduce((sum, p) => sum + p.masteryLevel, 0) /
        conceptProgress.length;
      return Math.min(1, Math.max(0, avgMastery * 0.5));
    }

    const avgRecent =
      withTrend.reduce((sum, p) => sum + (p.recentAccuracy as number), 0) /
      withTrend.length;
    const avgGain =
      withTrend.reduce(
        (sum, p) =>
          sum + ((p.recentAccuracy as number) - (p.earlyAccuracy as number)),
        0,
      ) / withTrend.length;

    // 平均提升 -1..1 归一化到 0..1，提升为负时扣分
    const gainScore = Math.min(1, Math.max(0, 0.5 + avgGain / 2));

    return Math.min(1, Math.max(0, avgRecent * 0.6 + gainScore * 0.4));
  }

  private estimateCognitiveLoad(stats: any, conceptProgress: any[]): number {
    const taskComplexity = Math.min(1.0, (stats.learningConcepts || 0) / 10);
    const timePressure = stats.totalPracticeTime > 3600 ? 0.7 : 0.3;
    const varietyFactor = Math.min(1.0, conceptProgress.length / 15);

    return taskComplexity * 0.4 + timePressure * 0.3 + varietyFactor * 0.3;
  }

  private calculateLearningVelocity(stats: any): number {
    if (!stats.weeklyProgress || stats.weeklyProgress.length === 0) return 0.5;

    const recentWeek = stats.weeklyProgress.slice(-7);
    const earlierWeek = stats.weeklyProgress.slice(0, 7);

    if (earlierWeek.length === 0) return 0.5;

    const recentAvg = recentWeek.reduce((a, b) => a + b, 0) / recentWeek.length;
    const earlierAvg =
      earlierWeek.reduce((a, b) => a + b, 0) / earlierWeek.length;

    if (earlierAvg === 0) return recentAvg > 0 ? 0.8 : 0.5;

    const velocity = (recentAvg - earlierAvg) / earlierAvg;
    return Math.min(1.0, Math.max(0, 0.5 + velocity));
  }

  /**
   * 错误模式：直接给出「哪个知识点、错了几次、正确率多少」，
   * 而不是只回一个概念 id（前端只能显示成莫名其妙的一行文字）。
   */
  private identifyErrorPatterns(
    conceptProgress: Array<{
      conceptId: string;
      masteryLevel: number;
      attemptsCount?: number;
      correctRate?: number;
      incorrectCount?: number;
      earlyAccuracy?: number | null;
      recentAccuracy?: number | null;
    }>,
  ): string[] {
    return conceptProgress
      .filter(
        (p) =>
          (p.attemptsCount || 0) > 0 &&
          ((p.correctRate ?? 100) < 70 || p.masteryLevel < 0.6),
      )
      .sort((a, b) => a.masteryLevel - b.masteryLevel)
      .slice(0, 5)
      .map((p) => {
        const parts = [`${p.conceptId}：正确率 ${p.correctRate ?? 0}%`];
        if ((p.incorrectCount || 0) > 0) {
          parts.push(`错 ${p.incorrectCount} 次`);
        }
        if (
          typeof p.earlyAccuracy === 'number' &&
          typeof p.recentAccuracy === 'number' &&
          p.recentAccuracy <= p.earlyAccuracy
        ) {
          parts.push('重复作答未见提升');
        }
        return parts.join('，');
      });
  }

  private estimateAttentionLevel(stats: any): number {
    const streak = stats.streakDays || 0;
    if (streak >= 7) return 0.9;
    if (streak >= 3) return 0.7;
    if (streak >= 1) return 0.5;
    return 0.3;
  }

  private estimateFrustrationLevel(
    stats: any,
    conceptProgress: Array<{ masteryLevel: number }>,
  ): number {
    if (conceptProgress.length === 0) return 0.3;

    const lowMasteryCount = conceptProgress.filter(
      (p) => p.masteryLevel < 0.3,
    ).length;
    const frustration = Math.min(
      1.0,
      (lowMasteryCount / conceptProgress.length) * 2,
    );

    const noProgress = (stats.weeklyProgress || []).every(
      (count) => count === 0,
    )
      ? 0.3
      : 0;

    return Math.min(1.0, frustration + noProgress);
  }

  private predictMasteryCurve(
    currentMastery: number,
    velocity: number,
  ): number[] {
    const predictions: number[] = [];
    let mastery = currentMastery;

    for (let i = 1; i <= 7; i++) {
      const dailyGain = velocity * 0.05 * (1 - mastery);
      mastery = Math.min(1.0, mastery + dailyGain);
      predictions.push(Math.round(mastery * 100) / 100);
    }

    return predictions;
  }

  private calculateOptimalDifficulty(currentMastery: number): number {
    const baseDifficulty = currentMastery + 0.15;
    return Math.min(0.95, Math.max(0.25, baseDifficulty));
  }

  private recommendInterventions(
    conceptualUnderstanding: number,
    proceduralFluency: number,
    cognitiveLoad: number,
    errorPatterns: string[],
  ): CognitiveState['predictions']['recommendedIntervention'] {
    const interventions: CognitiveState['predictions']['recommendedIntervention'] =
      [];

    if (cognitiveLoad > 0.8) {
      interventions.push('take_break');
    }

    if (conceptualUnderstanding < 0.4 && errorPatterns.length > 3) {
      interventions.push('review_prerequisite');
    }

    if (proceduralFluency < 0.5) {
      interventions.push('hint');
    }

    if (conceptualUnderstanding > 0.7 && proceduralFluency > 0.7) {
      interventions.push('challenge');
    }

    if (interventions.length === 0) {
      interventions.push('switch_method');
    }

    return interventions;
  }

  private getDefaultScenarioContext(
    cognitiveState: CognitiveState,
  ): ScenarioContext {
    return {
      id: 'default',
      knowledgeArea: 'limits',
      userLevel: cognitiveState.dimensions.conceptualUnderstanding,
      taskUrgency: false,
      currentPhase: 'concept',
      difficulty: 'medium',
    };
  }

  private createDynamicNode(baseNode: BaseKnowledgeNode): DynamicKnowledgeNode {
    return {
      ...baseNode,
      dynamicWeight: 0.5,
      relevanceScore: 0.5,
      activationLevel: 0.5,
      masteryLevel: 0,
      accessCount: 0,
    };
  }

  private createDynamicRelation(
    baseRelation: BaseKnowledgeRelation,
  ): DynamicKnowledgeRelation {
    return {
      ...baseRelation,
      dynamicWeight: baseRelation.weight || 0.5,
      contextWeights: new Map(),
      strengthHistory: [
        { date: Date.now(), weight: baseRelation.weight || 0.5 },
      ],
    };
  }

  /**
   * 熔断/数据不可用时的降级状态。
   * 这里必须明确表达“没有数据”，而不是给出一组看着像真实分析的数字
   * （否则前端会把它当成真实评估展示，这正是“假分析”观感的来源）。
   */
  private getDefaultCognitiveState(userId: string): CognitiveState {
    return {
      userId,
      timestamp: new Date(),
      dimensions: {
        conceptualUnderstanding: 0,
        proceduralFluency: 0,
        strategicCompetence: 0,
        adaptiveReasoning: 0,
      },
      metrics: {
        cognitiveLoad: 0,
        learningVelocity: 0,
        errorPattern: [],
        attentionLevel: 0,
        frustrationLevel: 0,
      },
      predictions: {
        masteryPrediction: [],
        optimalDifficulty: 0.5,
        recommendedIntervention: ['data_unavailable'],
      },
    };
  }

  async recordInteraction(
    userId: string,
    nodeId: string,
    interactionType: 'view' | 'practice' | 'master' | 'review',
    scenarioId?: string,
  ): Promise<void> {
    const node = this.nodeCache.get(nodeId);
    if (node) {
      node.accessCount += 1;
      node.lastAccessed = new Date();
      this.nodeCache.set(nodeId, node);
    }

    if (scenarioId) {
      const context = this.scenarioContextCache.get(scenarioId);
      if (context) {
        context.userLevel = Math.min(1.0, context.userLevel + 0.01);
        this.scenarioContextCache.set(scenarioId, context);
      }
    }

    await this.cacheManager.delete(`cognitive:${userId}`);
  }

  async invalidateCache(userId?: string): Promise<void> {
    if (userId) {
      await this.cacheManager.delete(`cognitive:${userId}`);
    } else {
      await this.cacheManager.clear();
    }
  }

  getGraphStatistics(): {
    totalNodes: number;
    totalRelations: number;
    averageActivationLevel: number;
    cacheSize: number;
    circuitBreakerStatus: any;
  } {
    let totalActivation = 0;
    this.nodeCache.forEach((node) => {
      totalActivation += node.activationLevel;
    });

    return {
      totalNodes: this.nodeCache.size,
      totalRelations: this.relationCache.size,
      averageActivationLevel:
        this.nodeCache.size > 0 ? totalActivation / this.nodeCache.size : 0,
      cacheSize: this.nodeCache.size + this.relationCache.size,
      circuitBreakerStatus:
        this.learningServiceCircuitBreaker.getHealthStatus(),
    };
  }
}
