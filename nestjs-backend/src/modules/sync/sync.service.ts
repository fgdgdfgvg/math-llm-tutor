import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LearningRecord, LearningRecordDocument } from '../learning/schemas/learning-record.schema';
import { LearningBehavior, LearningBehaviorDocument } from './schemas/learning-behavior.schema';
import { LearningInsight, LearningInsightDocument } from './schemas/learning-insight.schema';

export type { LearningBehavior, LearningInsight };

export interface SyncData {
  userId: string;
  deviceId: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  lastSyncTime: Date;
  data: {
    currentProblemId?: string;
    currentStep?: number;
    notes?: Array<{
      id: string;
      content: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
    progress?: Array<{
      conceptId: string;
      masteryLevel: number;
      lastPracticeDate: Date;
    }>;
  };
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private syncDataMap: Map<string, SyncData> = new Map();

  constructor(
    @InjectModel(LearningRecord.name)
    private readonly learningRecordModel: Model<LearningRecordDocument>,
    @InjectModel(LearningBehavior.name)
    private readonly learningBehaviorModel: Model<LearningBehaviorDocument>,
    @InjectModel(LearningInsight.name)
    private readonly learningInsightModel: Model<LearningInsightDocument>
  ) {}

  async syncData(userId: string, deviceId: string, data: SyncData['data']): Promise<SyncData> {
    const syncKey = `${userId}-${deviceId}`;
    const syncData: SyncData = {
      userId,
      deviceId,
      deviceType: 'desktop',
      lastSyncTime: new Date(),
      data
    };

    this.syncDataMap.set(syncKey, syncData);
    await this.persistSyncData(syncData);

    // 生成学习行为数据
    await this.recordLearningBehavior(userId, 'view', data);

    return syncData;
  }

  async getSyncData(userId: string, deviceId: string): Promise<SyncData | null> {
    const syncKey = `${userId}-${deviceId}`;
    const syncData = this.syncDataMap.get(syncKey);

    if (syncData) {
      return syncData;
    }

    // 从数据库获取
    return await this.retrieveSyncData(userId, deviceId);
  }

  async listDevices(userId: string): Promise<Array<{
    deviceId: string;
    deviceType: 'desktop' | 'mobile' | 'tablet';
    lastSyncTime: Date;
  }>> {
    const devices: Array<{
      deviceId: string;
      deviceType: 'desktop' | 'mobile' | 'tablet';
      lastSyncTime: Date;
    }> = [];

    for (const [key, syncData] of this.syncDataMap.entries()) {
      if (syncData.userId === userId) {
        devices.push({
          deviceId: syncData.deviceId,
          deviceType: syncData.deviceType,
          lastSyncTime: syncData.lastSyncTime
        });
      }
    }

    return devices;
  }

  async recordLearningBehavior(
    userId: string,
    behaviorType: LearningBehavior['behaviorType'],
    details?: Record<string, unknown>
  ): Promise<LearningBehavior> {
    const behavior = new this.learningBehaviorModel({
      userId,
      conceptId: details?.conceptId || 'general',
      behaviorType,
      duration: details?.duration || 0,
      details
    });

    const savedBehavior = await behavior.save();
    
    // 分析行为数据，生成洞察
    await this.analyzeBehavior(savedBehavior.toObject() as LearningBehavior);

    return savedBehavior.toObject() as LearningBehavior;
  }

  async getLearningBehaviorStats(
    userId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      conceptId?: string;
    }
  ): Promise<{
    totalSessions: number;
    totalDuration: number;
    averageDuration: number;
    behaviorDistribution: Record<string, number>;
    errorDistribution: Record<string, number>;
    conceptProgress: Record<string, number>;
  }> {
    const { startDate, endDate, conceptId } = options;
    
    const query: Record<string, any> = { userId };
    
    if (startDate) {
      query.timestamp = { ...query.timestamp, $gte: startDate };
    }
    
    if (endDate) {
      query.timestamp = { ...query.timestamp, $lte: endDate };
    }
    
    if (conceptId) {
      query.conceptId = conceptId;
    }

    const behaviors = await this.learningBehaviorModel.find(query).exec();

    const totalSessions = behaviors.length;
    const totalDuration = behaviors.reduce((sum, b) => sum + b.duration, 0);
    const averageDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;

    // 行为分布
    const behaviorDistribution: Record<string, number> = {};
    behaviors.forEach(b => {
      behaviorDistribution[b.behaviorType] = (behaviorDistribution[b.behaviorType] || 0) + 1;
    });

    // 错误分布
    const errorDistribution: Record<string, number> = {};
    behaviors
      .filter(b => b.behaviorType === 'error' && b.details?.errorType)
      .forEach(b => {
        errorDistribution[b.details!.errorType!] = (errorDistribution[b.details!.errorType!] || 0) + 1;
      });

    // 概念进度
    const conceptProgress: Record<string, number> = {};
    behaviors.forEach(b => {
      if (b.conceptId !== 'general') {
        conceptProgress[b.conceptId] = (conceptProgress[b.conceptId] || 0) + 1;
      }
    });

    return {
      totalSessions,
      totalDuration,
      averageDuration,
      behaviorDistribution,
      errorDistribution,
      conceptProgress
    };
  }

  async getLearningInsights(
    userId: string,
    options: {
      limit?: number;
      severity?: 'low' | 'medium' | 'high';
      actionRequired?: boolean;
    }
  ): Promise<LearningInsight[]> {
    const { limit = 10, severity, actionRequired } = options;
    
    const query: any = { userId };
    
    if (severity) {
      query.severity = severity;
    }
    
    if (actionRequired !== undefined) {
      query.actionRequired = actionRequired;
    }

    const insights = await this.learningInsightModel
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();

    return insights.map(insight => insight.toObject() as LearningInsight);
  }

  async generatePredictiveReminders(userId: string): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];

    // 分析学习行为数据
    const recentBehaviors = await this.learningBehaviorModel
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(50)
      .exec();

    // 检查学习频率
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const lastWeekBehaviors = recentBehaviors.filter(b => b.timestamp >= oneWeekAgo);

    if (lastWeekBehaviors.length < 5) {
      const insight = new this.learningInsightModel({
        userId,
        insightType: 'warning',
        title: '学习频率过低',
        description: '您最近一周的学习频率较低，建议增加学习时间以保持知识熟练度。',
        severity: 'medium',
        actionRequired: true
      });
      await insight.save();
      insights.push(insight.toObject() as LearningInsight);
    }

    // 检查错误模式
    const errorBehaviors = recentBehaviors.filter(b => b.behaviorType === 'error');
    if (errorBehaviors.length > 10) {
      const errorTypes: Record<string, number> = {};
      errorBehaviors.forEach(b => {
        if (b.details?.errorType) {
          errorTypes[b.details.errorType] = (errorTypes[b.details.errorType] || 0) + 1;
        }
      });

      const mostFrequentError = Object.entries(errorTypes)
        .sort((a, b) => b[1] - a[1])[0];

      if (mostFrequentError && mostFrequentError[1] > 3) {
        const insight = new this.learningInsightModel({
          userId,
          insightType: 'warning',
          title: '频繁出现的错误',
          description: `您在${mostFrequentError[0]}类型的问题上频繁出错，建议重点复习相关知识点。`,
          severity: 'high',
          actionRequired: true
        });
        await insight.save();
        insights.push(insight.toObject() as LearningInsight);
      }
    }

    // 检查长时间未复习的概念
    const conceptLastPractice: Record<string, Date> = {};
    recentBehaviors.forEach(b => {
      if (b.conceptId !== 'general') {
        if (!conceptLastPractice[b.conceptId] || 
            b.timestamp > conceptLastPractice[b.conceptId]) {
          conceptLastPractice[b.conceptId] = b.timestamp;
        }
      }
    });

    const now = new Date();
    for (const [conceptId, lastPractice] of Object.entries(conceptLastPractice)) {
      const daysSinceLastPractice = (now.getTime() - lastPractice.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastPractice > 7) {
        const insight = new this.learningInsightModel({
          userId,
          insightType: 'recommendation',
          title: '需要复习的概念',
          description: `您已经超过7天没有复习${conceptId}相关的内容，建议进行复习以巩固记忆。`,
          severity: 'low',
          relatedConcepts: [conceptId],
          actionRequired: false
        });
        await insight.save();
        insights.push(insight.toObject() as LearningInsight);
      }
    }

    return insights;
  }

  private async persistSyncData(syncData: SyncData): Promise<void> {
    // 实际项目中，这里应该将同步数据保存到数据库
    this.logger.log(`Synced data for user ${syncData.userId} on device ${syncData.deviceId}`);
  }

  private async retrieveSyncData(userId: string, deviceId: string): Promise<SyncData | null> {
    // 实际项目中，这里应该从数据库获取同步数据
    return null;
  }

  private async persistLearningBehavior(behavior: LearningBehavior): Promise<void> {
    // 实际项目中，这里应该将学习行为数据保存到数据库
    this.logger.log(`Recorded learning behavior for user ${behavior.userId}: ${behavior.behaviorType}`);
  }

  private async persistLearningInsight(insight: LearningInsight): Promise<void> {
    // 实际项目中，这里应该将学习洞察保存到数据库
    this.logger.log(`Generated learning insight for user ${insight.userId}: ${insight.title}`);
  }

  private async analyzeBehavior(behavior: LearningBehavior): Promise<void> {
    // 分析学习行为，生成洞察
    if (behavior.behaviorType === 'error' && behavior.details?.errorType) {
      // 分析错误模式
      const similarErrors = await this.learningBehaviorModel.find({
        userId: behavior.userId,
        behaviorType: 'error',
        'details.errorType': behavior.details?.errorType
      }).exec();

      if (similarErrors.length >= 3) {
        const insight = new this.learningInsightModel({
          userId: behavior.userId,
          insightType: 'warning',
          title: '重复出现的错误',
          description: `您在${behavior.details?.errorType}类型的问题上已经出错${similarErrors.length}次，建议重点复习相关知识点。`,
          severity: 'medium',
          relatedConcepts: [behavior.conceptId],
          actionRequired: true
        });

        await insight.save();
      }
    }
  }

  // 清理过期数据（MongoDB会自动处理过期数据，此方法用于手动清理）
  async cleanupData(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 清理30天前的学习行为数据
    const behaviorResult = await this.learningBehaviorModel.deleteMany({ timestamp: { $lt: thirtyDaysAgo } }).exec();
    
    // 清理30天前的学习洞察
    const insightResult = await this.learningInsightModel.deleteMany({ timestamp: { $lt: thirtyDaysAgo } }).exec();

    this.logger.log(`Cleaned up ${behaviorResult.deletedCount} expired behaviors and ${insightResult.deletedCount} expired insights`);
  }
}
