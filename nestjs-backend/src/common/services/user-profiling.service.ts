import { Injectable, Logger } from '@nestjs/common';

export enum UserKnowledgeLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
}

export enum UserLearningStyle {
  VISUAL = 'visual',
  ANALYTICAL = 'analytical',
  PROCEDURAL = 'procedural',
  CONCEPTUAL = 'conceptual',
}

export enum AdaptationTier {
  BASIC = 'basic',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
}

export interface UserProfile {
  userId: string;
  nickname: string;
  knowledgeLevel: UserKnowledgeLevel;
  learningStyle: UserLearningStyle;
  adaptationTier: AdaptationTier;
  strengths: string[];
  weaknesses: string[];
  completedTopics: string[];
  masteredTopics: string[];
  totalQuestionsSolved: number;
  questionsCorrect: number;
  averageTimePerQuestion: number;
  preferredComplexity: 'simple' | 'moderate' | 'challenging';
  createdAt: number;
  lastActive: number;
  sessionCount: number;
}

export interface UserPerformanceRecord {
  timestamp: number;
  problemCategory: string;
  problem: string;
  answer: string;
  isCorrect: boolean;
  timeSpent: number;
  confidence: number;
  hintsUsed: number;
}

export interface AdaptationConfig {
  tier: AdaptationTier;
  explanationDepth: 'shallow' | 'moderate' | 'deep';
  formulaDisplay: 'basic' | 'standard' | 'full_derivation';
  stepGranularity: 'coarse' | 'moderate' | 'fine';
  hintFrequency: 'rare' | 'moderate' | 'generous';
  verifyEncouragement: boolean;
  showAlternativeMethods: boolean;
  maxStepsPerSolution: number;
}

export interface PersonalizedSuggestion {
  suggestedTopics: string[];
  suggestedDifficulty: 'easy' | 'medium' | 'hard';
  recommendedPracticeCount: number;
  weakAreas: string[];
  progressMessage: string;
}

export interface LearningPathNode {
  topicId: string;
  topicName: string;
  priority: number;
  mastery: number;
  prerequisiteOf: string[];
  dependsOn: string[];
  recommendedReviewDate?: number;
}

export interface LearningPath {
  userId: string;
  generatedAt: number;
  nodes: LearningPathNode[];
  currentFocus: string;
  nextMilestones: string[];
  estimatedCompletionDays: number;
}

// 主题依赖图谱：每个主题的前置依赖
const TOPIC_DEPENDENCIES: Record<string, string[]> = {
  函数与极限: [],
  导数与微分: ['函数与极限'],
  微分中值定理: ['导数与微分'],
  不定积分: ['导数与微分'],
  定积分: ['不定积分', '函数与极限'],
  定积分应用: ['定积分'],
  微分方程: ['不定积分', '导数与微分'],
  向量与空间几何: ['函数与极限'],
  多元函数微分: ['导数与微分', '向量与空间几何'],
  重积分: ['定积分', '多元函数微分'],
  曲线积分: ['重积分', '向量与空间几何'],
  曲面积分: ['重积分', '向量与空间几何'],
  无穷级数: ['函数与极限', '定积分'],
  线性代数: ['函数与极限'],
  概率论: ['函数与极限'],
};

@Injectable()
export class UserProfilingService {
  private readonly logger = new Logger(UserProfilingService.name);
  private readonly userProfiles: Map<string, UserProfile> = new Map();
  private readonly performanceHistory: Map<string, UserPerformanceRecord[]> =
    new Map();
  private readonly sessionCache: Map<
    string,
    { sessionId: string; startTime: number }
  > = new Map();

  createProfile(
    userId: string,
    options?: {
      nickname?: string;
      initialLevel?: UserKnowledgeLevel;
      initialStyle?: UserLearningStyle;
    },
  ): UserProfile {
    if (this.userProfiles.has(userId)) {
      throw new Error(`用户 ${userId} 已存在`);
    }

    const profile: UserProfile = {
      userId,
      nickname: options?.nickname || `学习者${userId.substring(0, 6)}`,
      knowledgeLevel: options?.initialLevel || UserKnowledgeLevel.INTERMEDIATE,
      learningStyle: options?.initialStyle || UserLearningStyle.ANALYTICAL,
      adaptationTier: AdaptationTier.INTERMEDIATE,
      strengths: [],
      weaknesses: [],
      completedTopics: [],
      masteredTopics: [],
      totalQuestionsSolved: 0,
      questionsCorrect: 0,
      averageTimePerQuestion: 0,
      preferredComplexity: 'moderate',
      createdAt: Date.now(),
      lastActive: Date.now(),
      sessionCount: 0,
    };

    this.userProfiles.set(userId, profile);
    this.performanceHistory.set(userId, []);
    this.updateAdaptationTier(profile);

    this.logger.log(
      `创建用户画像: ${profile.nickname} (${profile.knowledgeLevel})`,
    );
    return profile;
  }

  getProfile(userId: string): UserProfile | undefined {
    return this.userProfiles.get(userId);
  }

  getOrCreateProfile(
    userId: string,
    options?: {
      nickname?: string;
      initialLevel?: UserKnowledgeLevel;
      initialStyle?: UserLearningStyle;
    },
  ): UserProfile {
    const existing = this.userProfiles.get(userId);
    if (existing) return existing;
    return this.createProfile(userId, options);
  }

  recordPerformance(userId: string, record: UserPerformanceRecord): void {
    const profile = this.userProfiles.get(userId);
    if (!profile) {
      this.logger.warn(`未找到用户画像: ${userId}`);
      return;
    }

    // 记录性能数据
    const history = this.performanceHistory.get(userId) || [];
    history.push(record);
    this.performanceHistory.set(userId, history);

    // 更新画像统计
    profile.totalQuestionsSolved++;
    if (record.isCorrect) {
      profile.questionsCorrect++;
    }

    // 更新平均用时
    profile.averageTimePerQuestion =
      (profile.averageTimePerQuestion * (profile.totalQuestionsSolved - 1) +
        record.timeSpent) /
      profile.totalQuestionsSolved;

    profile.lastActive = Date.now();

    // 更新强弱项
    this.updateStrengthsWeaknesses(profile, history);

    // 检查并更新知识水平
    this.reassessKnowledgeLevel(profile);

    // 更新适配层级
    this.updateAdaptationTier(profile);

    this.logger.log(
      `记录答题表现: ${profile.nickname} - ${record.isCorrect ? '正确' : '错误'} (${record.problemCategory})`,
    );
  }

  getAdaptationConfig(userId: string): AdaptationConfig {
    const profile = this.userProfiles.get(userId);

    if (!profile) {
      return this.getDefaultAdaptationConfig(AdaptationTier.INTERMEDIATE);
    }

    let explanationDepth: AdaptationConfig['explanationDepth'];
    let formulaDisplay: AdaptationConfig['formulaDisplay'];
    let stepGranularity: AdaptationConfig['stepGranularity'];
    let hintFrequency: AdaptationConfig['hintFrequency'];

    switch (profile.adaptationTier) {
      case AdaptationTier.BASIC:
        explanationDepth = 'deep';
        formulaDisplay = 'full_derivation';
        stepGranularity = 'fine';
        hintFrequency = 'generous';
        break;
      case AdaptationTier.INTERMEDIATE:
        explanationDepth = 'moderate';
        formulaDisplay = 'standard';
        stepGranularity = 'moderate';
        hintFrequency = 'moderate';
        break;
      case AdaptationTier.ADVANCED:
        explanationDepth = 'shallow';
        formulaDisplay = 'basic';
        stepGranularity = 'coarse';
        hintFrequency = 'rare';
        break;
    }

    return {
      tier: profile.adaptationTier,
      explanationDepth,
      formulaDisplay,
      stepGranularity,
      hintFrequency,
      verifyEncouragement: profile.adaptationTier !== AdaptationTier.ADVANCED,
      showAlternativeMethods: profile.adaptationTier !== AdaptationTier.BASIC,
      maxStepsPerSolution:
        profile.adaptationTier === AdaptationTier.BASIC
          ? 8
          : profile.adaptationTier === AdaptationTier.INTERMEDIATE
            ? 6
            : 4,
    };
  }

  getPersonalizedPromptEnhancer(userId: string): string {
    const profile = this.userProfiles.get(userId);
    if (!profile) return '';

    const adaptationConfig = this.getAdaptationConfig(userId);

    let enhancedPrompt = '\n## 用户适配设置\n';

    switch (adaptationConfig.tier) {
      case AdaptationTier.BASIC:
        enhancedPrompt += '- 请为每一步提供详细的解释和中间推导\n';
        enhancedPrompt += '- 多使用具体数值示例帮助理解\n';
        enhancedPrompt += '- 关键步骤添加"为什么"的解释\n';
        break;
      case AdaptationTier.INTERMEDIATE:
        enhancedPrompt += '- 保持标准推导深度，适当省略纯计算步骤\n';
        enhancedPrompt += '- 关键定理和公式需注明名称\n';
        break;
      case AdaptationTier.ADVANCED:
        enhancedPrompt += '- 简洁高效，核心步骤各自推理\n';
        enhancedPrompt += '- 可适当跳跃基础计算步骤\n';
        enhancedPrompt += '- 鼓励展示多种进阶解法\n';
        break;
    }

    // 弱点提示
    if (profile.weaknesses.length > 0) {
      enhancedPrompt += `- 注意复核弱点领域: ${profile.weaknesses.slice(0, 3).join('、')}\n`;
    }

    return enhancedPrompt;
  }

  getPersonalizedSuggestion(userId: string): PersonalizedSuggestion | null {
    const profile = this.userProfiles.get(userId);
    if (!profile) return null;

    const history = this.performanceHistory.get(userId) || [];
    const recentHistory = history.filter(
      (r) => Date.now() - r.timestamp < 7 * 24 * 60 * 60 * 1000, // 最近一周
    );

    // 分析弱项
    const categoryPerformance = new Map<
      string,
      { correct: number; total: number }
    >();
    for (const record of recentHistory) {
      const stat = categoryPerformance.get(record.problemCategory) || {
        correct: 0,
        total: 0,
      };
      stat.total++;
      if (record.isCorrect) stat.correct++;
      categoryPerformance.set(record.problemCategory, stat);
    }

    const weakAreas: string[] = [];
    for (const [category, stat] of categoryPerformance) {
      if (stat.total >= 3 && stat.correct / stat.total < 0.6) {
        weakAreas.push(category);
      }
    }

    // 推荐难度
    const recentAccuracy =
      recentHistory.length > 0
        ? recentHistory.filter((r) => r.isCorrect).length / recentHistory.length
        : 0.5;

    let suggestedDifficulty: 'easy' | 'medium' | 'hard';
    if (recentAccuracy < 0.5) suggestedDifficulty = 'easy';
    else if (recentAccuracy < 0.75) suggestedDifficulty = 'medium';
    else suggestedDifficulty = 'hard';

    // 建议主题
    const suggestedTopics =
      profile.weaknesses.length > 0
        ? profile.weaknesses.slice(0, 3)
        : this.getNextRecommendedTopics(profile);

    const accuracyPercent =
      profile.totalQuestionsSolved > 0
        ? Math.round(
            (profile.questionsCorrect / profile.totalQuestionsSolved) * 100,
          )
        : 0;

    const progressMessage = `总答题${profile.totalQuestionsSolved}道，正确率${accuracyPercent}%${
      recentHistory.length > 0
        ? `，近期正确率${Math.round(recentAccuracy * 100)}%`
        : ''
    }`;

    return {
      suggestedTopics,
      suggestedDifficulty,
      recommendedPracticeCount: Math.max(5, Math.round(weakAreas.length * 5)),
      weakAreas,
      progressMessage,
    };
  }

  classifyLearningStyle(history: UserPerformanceRecord[]): UserLearningStyle {
    if (history.length < 5) return UserLearningStyle.ANALYTICAL;

    const avgTime =
      history.reduce((sum, r) => sum + r.timeSpent, 0) / history.length;
    const avgConfidence =
      history.reduce((sum, r) => sum + r.confidence, 0) / history.length;
    const correctRatio =
      history.filter((r) => r.isCorrect).length / history.length;

    if (avgTime < 30 && correctRatio > 0.8) return UserLearningStyle.CONCEPTUAL;
    if (avgTime > 60 && avgConfidence < 0.7)
      return UserLearningStyle.PROCEDURAL;
    if (avgConfidence > 0.8) return UserLearningStyle.ANALYTICAL;

    return UserLearningStyle.VISUAL;
  }

  getPerformanceReport(userId: string): {
    totalSolved: number;
    accuracy: number;
    averageTime: number;
    topStrengths: string[];
    topWeaknesses: string[];
    learningTrend: 'improving' | 'stable' | 'declining';
    weeklyActivity: number[];
  } | null {
    const profile = this.userProfiles.get(userId);
    if (!profile) return null;

    const history = this.performanceHistory.get(userId) || [];

    // 学习趋势分析
    const recentCorrect = history.slice(-10).filter((r) => r.isCorrect).length;
    const olderCorrect = history
      .slice(-20, -10)
      .filter((r) => r.isCorrect).length;
    let learningTrend: 'improving' | 'stable' | 'declining';
    if (recentCorrect > olderCorrect + 1) learningTrend = 'improving';
    else if (recentCorrect < olderCorrect - 1) learningTrend = 'declining';
    else learningTrend = 'stable';

    return {
      totalSolved: profile.totalQuestionsSolved,
      accuracy:
        profile.totalQuestionsSolved > 0
          ? Math.round(
              (profile.questionsCorrect / profile.totalQuestionsSolved) * 100,
            )
          : 0,
      averageTime: Math.round(profile.averageTimePerQuestion),
      topStrengths: profile.strengths.slice(0, 3),
      topWeaknesses: profile.weaknesses.slice(0, 3),
      learningTrend,
      weeklyActivity: this.getWeeklyActivity(history),
    };
  }

  private getDefaultAdaptationConfig(tier: AdaptationTier): AdaptationConfig {
    return {
      tier,
      explanationDepth: 'moderate',
      formulaDisplay: 'standard',
      stepGranularity: 'moderate',
      hintFrequency: 'moderate',
      verifyEncouragement: true,
      showAlternativeMethods: true,
      maxStepsPerSolution: 6,
    };
  }

  private updateAdaptationTier(profile: UserProfile): void {
    if (profile.totalQuestionsSolved < 10) {
      profile.adaptationTier = AdaptationTier.BASIC;
      return;
    }

    const accuracy =
      profile.totalQuestionsSolved > 0
        ? profile.questionsCorrect / profile.totalQuestionsSolved
        : 0;

    if (accuracy > 0.85 && profile.totalQuestionsSolved > 30) {
      profile.adaptationTier = AdaptationTier.ADVANCED;
      profile.preferredComplexity = 'challenging';
    } else if (accuracy > 0.6 && profile.totalQuestionsSolved > 15) {
      profile.adaptationTier = AdaptationTier.INTERMEDIATE;
      profile.preferredComplexity = 'moderate';
    } else {
      profile.adaptationTier = AdaptationTier.BASIC;
      profile.preferredComplexity = 'simple';
    }
  }

  private updateStrengthsWeaknesses(
    profile: UserProfile,
    history: UserPerformanceRecord[],
  ): void {
    const categoryStats = new Map<string, { correct: number; total: number }>();

    for (const record of history) {
      const stat = categoryStats.get(record.problemCategory) || {
        correct: 0,
        total: 0,
      };
      stat.total++;
      if (record.isCorrect) stat.correct++;
      categoryStats.set(record.problemCategory, stat);
    }

    const strengths: string[] = [];
    const weaknesses: string[] = [];

    for (const [category, stat] of categoryStats) {
      if (stat.total < 3) continue;
      const accuracy = stat.correct / stat.total;
      if (accuracy >= 0.85) strengths.push(category);
      else if (accuracy < 0.5) weaknesses.push(category);
    }

    profile.strengths = strengths;
    profile.weaknesses = weaknesses;
  }

  private reassessKnowledgeLevel(profile: UserProfile): void {
    if (profile.totalQuestionsSolved < 20) {
      profile.knowledgeLevel = UserKnowledgeLevel.BEGINNER;
      return;
    }

    const accuracy =
      profile.totalQuestionsSolved > 0
        ? profile.questionsCorrect / profile.totalQuestionsSolved
        : 0;

    if (
      profile.totalQuestionsSolved > 50 &&
      accuracy > 0.8 &&
      profile.masteredTopics.length > 5
    ) {
      profile.knowledgeLevel = UserKnowledgeLevel.ADVANCED;
    } else if (profile.totalQuestionsSolved > 20 && accuracy > 0.5) {
      profile.knowledgeLevel = UserKnowledgeLevel.INTERMEDIATE;
    } else {
      profile.knowledgeLevel = UserKnowledgeLevel.BEGINNER;
    }
  }

  private getNextRecommendedTopics(profile: UserProfile): string[] {
    const allTopics = [
      '函数极限',
      '导数运算',
      '不定积分',
      '定积分应用',
      '微分方程',
      '多元函数微分',
      '级数收敛',
      '向量空间',
      '矩阵运算',
      '概率论基础',
    ];

    return allTopics
      .filter((t) => !profile.completedTopics.includes(t))
      .slice(0, 3);
  }

  private getWeeklyActivity(history: UserPerformanceRecord[]): number[] {
    const weekly = [0, 0, 0, 0, 0, 0, 0]; // 最近7天
    const now = Date.now();
    for (const record of history) {
      const dayDiff = Math.floor(
        (now - record.timestamp) / (24 * 60 * 60 * 1000),
      );
      if (dayDiff >= 0 && dayDiff < 7) {
        weekly[6 - dayDiff]++;
      }
    }
    return weekly;
  }

  startSession(userId: string): string {
    const sessionId = `session_${userId}_${Date.now()}`;
    this.sessionCache.set(userId, { sessionId, startTime: Date.now() });

    const profile = this.userProfiles.get(userId);
    if (profile) {
      profile.sessionCount++;
    }

    this.logger.log(`用户 ${userId} 开始会话: ${sessionId}`);
    return sessionId;
  }

  updateProfile(
    userId: string,
    updates: Partial<
      Pick<
        UserProfile,
        | 'nickname'
        | 'knowledgeLevel'
        | 'learningStyle'
        | 'completedTopics'
        | 'masteredTopics'
      >
    >,
  ): UserProfile | undefined {
    const profile = this.userProfiles.get(userId);
    if (!profile) return undefined;

    if (updates.nickname) profile.nickname = updates.nickname;
    if (updates.knowledgeLevel) profile.knowledgeLevel = updates.knowledgeLevel;
    if (updates.learningStyle) profile.learningStyle = updates.learningStyle;
    if (updates.completedTopics)
      profile.completedTopics = [...new Set(updates.completedTopics)];
    if (updates.masteredTopics)
      profile.masteredTopics = [...new Set(updates.masteredTopics)];

    this.updateAdaptationTier(profile);
    this.logger.log(`更新用户画像: ${profile.nickname}`);

    return profile;
  }

  // ========== 增强功能：个性化学习路径 ==========

  generateLearningPath(userId: string): LearningPath | null {
    const profile = this.userProfiles.get(userId);
    if (!profile) return null;

    const history = this.performanceHistory.get(userId) || [];

    const topicMastery = this.calculateTopicMastery(history);
    const nodes: LearningPathNode[] = [];

    for (const [topicName, deps] of Object.entries(TOPIC_DEPENDENCIES)) {
      const mastery = topicMastery.get(topicName) ?? 0;
      const prereqsSatisfied = deps.every(
        (d) => (topicMastery.get(d) ?? 0) >= 0.6,
      );
      const priority = this.calculateTopicPriority(
        topicName,
        mastery,
        prereqsSatisfied,
        deps,
        topicMastery,
      );

      // 间隔重复：若掌握度 > 0.8 但上次练习超过14天则建议复习
      let reviewDate: number | undefined;
      if (mastery > 0.8 && mastery < 0.95) {
        const lastAttempt = history
          .filter(
            (r) => this.mapCategoryToTopic(r.problemCategory) === topicName,
          )
          .sort((a, b) => b.timestamp - a.timestamp)[0];
        if (lastAttempt && Date.now() - lastAttempt.timestamp > 14 * 86400000) {
          reviewDate = Date.now() + 3 * 86400000;
        }
      }

      const prerequisiteOf = Object.entries(TOPIC_DEPENDENCIES)
        .filter(([, d]) => d.includes(topicName))
        .map(([t]) => t);

      nodes.push({
        topicId: `topic-${topicName}`,
        topicName,
        priority,
        mastery,
        prerequisiteOf,
        dependsOn: deps,
        recommendedReviewDate: reviewDate,
      });
    }

    nodes.sort((a, b) => b.priority - a.priority);

    const nextMilestones = nodes
      .filter((n) => n.mastery >= 0.6 && n.mastery < 0.9)
      .slice(0, 3)
      .map((n) => n.topicName);

    const currentFocus =
      nodes.length > 0
        ? nodes.filter((n) =>
            TOPIC_DEPENDENCIES[n.topicName].every(
              (d) => (topicMastery.get(d) ?? 0) >= 0.6,
            ),
          )[0]?.topicName || nodes[0].topicName
        : '';

    const totalUnmastered = nodes.filter((n) => n.mastery < 0.9).length;
    const dailyQuestions = Math.max(
      3,
      Math.min(
        10,
        profile.totalQuestionsSolved > 0
          ? Math.ceil(
              profile.totalQuestionsSolved /
                Math.max(1, (Date.now() - profile.createdAt) / 86400000),
            )
          : 5,
      ),
    );

    return {
      userId,
      generatedAt: Date.now(),
      nodes,
      currentFocus,
      nextMilestones,
      estimatedCompletionDays:
        dailyQuestions > 0
          ? Math.ceil((totalUnmastered * 20) / dailyQuestions)
          : totalUnmastered * 20,
    };
  }

  // 增强的自适应难度：考虑特定主题的掌握程度
  getAdaptiveDifficulty(
    userId: string,
    problemCategory: string,
  ): 'easy' | 'medium' | 'hard' {
    const profile = this.userProfiles.get(userId);
    if (!profile) return 'medium';

    const history = this.performanceHistory.get(userId) || [];
    const categoryHistory = history.filter(
      (r) =>
        r.problemCategory === problemCategory ||
        this.mapCategoryToTopic(r.problemCategory) === problemCategory,
    );

    if (categoryHistory.length < 3) {
      return profile.preferredComplexity === 'challenging' ? 'medium' : 'easy';
    }

    const recentAccuracy =
      categoryHistory.slice(-10).filter((r) => r.isCorrect).length /
      Math.min(10, categoryHistory.length);

    if (recentAccuracy > 0.85) return 'hard';
    if (recentAccuracy > 0.5) return 'medium';
    return 'easy';
  }

  private calculateTopicMastery(
    history: UserPerformanceRecord[],
  ): Map<string, number> {
    const topicStats = new Map<
      string,
      {
        correct: number;
        total: number;
        recentCorrect: number;
        recentTotal: number;
      }
    >();

    for (const record of history) {
      const topic = this.mapCategoryToTopic(record.problemCategory);
      const stat = topicStats.get(topic) || {
        correct: 0,
        total: 0,
        recentCorrect: 0,
        recentTotal: 0,
      };
      stat.total++;
      if (record.isCorrect) stat.correct++;
      if (Date.now() - record.timestamp < 7 * 86400000) {
        stat.recentTotal++;
        if (record.isCorrect) stat.recentCorrect++;
      }
      topicStats.set(topic, stat);
    }

    const mastery = new Map<string, number>();
    for (const [topic, stat] of topicStats) {
      if (stat.total < 2) {
        mastery.set(topic, 0);
        continue;
      }
      const overallAcc = stat.correct / stat.total;
      const recentAcc =
        stat.recentTotal > 0
          ? stat.recentCorrect / stat.recentTotal
          : overallAcc;
      // 近期表现权重更高
      const score =
        stat.recentTotal >= 3 ? recentAcc * 0.7 + overallAcc * 0.3 : overallAcc;
      mastery.set(topic, Math.round(score * 100) / 100);
    }

    return mastery;
  }

  private calculateTopicPriority(
    topicName: string,
    mastery: number,
    prereqsSatisfied: boolean,
    dependsOn: string[],
    topicMastery: Map<string, number>,
  ): number {
    if (!prereqsSatisfied && mastery < 0.6) return 0.1;
    let priority = (1 - mastery) * 8; // 基础分
    // 是其他主题的前置依赖
    const dependents = Object.entries(TOPIC_DEPENDENCIES).filter(([, d]) =>
      d.includes(topicName),
    ).length;
    priority += dependents * 1.5;
    // 弱项加成
    if (mastery < 0.5 && prereqsSatisfied) priority += 4;
    return Math.min(priority, 10);
  }

  private mapCategoryToTopic(category: string): string {
    const mapping: Record<string, string> = {
      limit: '函数与极限',
      function_limit: '函数与极限',
      derivative: '导数与微分',
      differential_mean_value: '微分中值定理',
      integral: '定积分',
      indefinite_integral: '不定积分',
      integral_application: '定积分应用',
      differential_equations: '微分方程',
      vector_geometry: '向量与空间几何',
      multivariable: '多元函数微分',
      multivariable_integral: '重积分',
      line_integral: '曲线积分',
      surface_integral: '曲面积分',
      series: '无穷级数',
      linear_algebra: '线性代数',
      probability: '概率论',
    };
    return mapping[category] || category;
  }
}
