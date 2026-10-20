import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Delete,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import {
  SyncService,
  SyncData,
  LearningBehavior,
  LearningInsight,
} from './sync.service';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('data')
  async syncData(
    @Request() req: Request & { user: { userId: string } },
    @Body()
    body: {
      deviceId: string;
      data: SyncData['data'];
    },
  ): Promise<SyncData> {
    return this.syncService.syncData(req.user.userId, body.deviceId, body.data);
  }

  @Get('data')
  async getSyncData(
    @Request() req: Request & { user: { userId: string } },
    @Query('deviceId') deviceId: string,
  ): Promise<SyncData | null> {
    return this.syncService.getSyncData(req.user.userId, deviceId);
  }

  @Get('devices')
  async listDevices(
    @Request() req: Request & { user: { userId: string } },
  ): Promise<
    Array<{
      deviceId: string;
      deviceType: 'desktop' | 'mobile' | 'tablet';
      lastSyncTime: Date;
    }>
  > {
    return this.syncService.listDevices(req.user.userId);
  }

  @Post('behavior')
  async recordLearningBehavior(
    @Request() req: Request & { user: { userId: string } },
    @Body()
    body: {
      behaviorType: LearningBehavior['behaviorType'];
      details?: any;
    },
  ): Promise<LearningBehavior> {
    return this.syncService.recordLearningBehavior(
      req.user.userId,
      body.behaviorType,
      body.details,
    );
  }

  @Get('behavior/stats')
  async getLearningBehaviorStats(
    @Request() req: Request & { user: { userId: string } },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('conceptId') conceptId?: string,
  ): Promise<{
    totalSessions: number;
    totalDuration: number;
    averageDuration: number;
    behaviorDistribution: Record<string, number>;
    errorDistribution: Record<string, number>;
    conceptProgress: Record<string, number>;
  }> {
    return this.syncService.getLearningBehaviorStats(req.user.userId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      conceptId,
    });
  }

  @Get('insights')
  async getLearningInsights(
    @Request() req: Request & { user: { userId: string } },
    @Query('limit') limit?: number,
    @Query('severity') severity?: 'low' | 'medium' | 'high',
    @Query('actionRequired') actionRequired?: boolean,
  ): Promise<LearningInsight[]> {
    return this.syncService.getLearningInsights(req.user.userId, {
      limit: limit ? parseInt(limit.toString()) : undefined,
      severity,
      actionRequired: actionRequired,
    });
  }

  @Post('reminders')
  async generatePredictiveReminders(
    @Request() req: Request & { user: { userId: string } },
    @Body() _body: Record<string, never>,
  ): Promise<LearningInsight[]> {
    return this.syncService.generatePredictiveReminders(req.user.userId);
  }

  @Post('cleanup')
  async cleanupData(): Promise<{ message: string }> {
    await this.syncService.cleanupData();
    return { message: 'Data cleaned up' };
  }
}
