import { Controller, Get, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './modules/user/schemas/user.schema';
import { Question } from './modules/questions/schemas/question.schema';
import { Mistake } from './modules/questions/schemas/mistake.schema';
import { Neo4jService } from './modules/knowledge/neo4j/neo4j.service';
import { Public } from './core/auth/guards/global-auth.guard';
import { describeErrorForLog } from './common/utils/redact';

interface HealthStatus {
  status: string;
  message?: string;
  details?: any;
}

interface SymPyHealthResponse {
  status?: string;
  version?: string;
}

interface SystemMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
  cpuUsage: number;
  activeConnections?: number;
  memoryWarning?: string;
  cpuWarning?: string;
}

const MEMORY_WARNING_THRESHOLD_MB = parseInt(process.env.MEMORY_WARNING_THRESHOLD_MB || '1024', 10);
const CPU_WARNING_THRESHOLD_PERCENT = parseInt(process.env.CPU_WARNING_THRESHOLD_PERCENT || '80', 10);

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Question.name) private questionModel: Model<Question>,
    @InjectModel(Mistake.name) private mistakeModel: Model<Mistake>,
    @Inject(Neo4jService) private readonly neo4jService: Neo4jService,
  ) {}

  @Get()
  @Public()
  async check() {
    const services: Record<string, HealthStatus> = {};
    const metrics: SystemMetrics = this.getSystemMetrics();

    services['nestjs'] = { status: 'healthy', details: { version: '1.0.0' } };
    services['mongodb'] = await this.checkMongoDB();
    services['sympy'] = await this.checkSymPy();
    services['neo4j'] = await this.checkNeo4jConnection();
    services['system'] = { status: 'healthy', details: metrics };

    const allHealthy = Object.values(services).every(
      (s) => s.status === 'healthy',
    );

    const healthStatus = {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services,
      metrics,
    };

    // 记录健康状态
    if (!allHealthy) {
      this.logger.warn('System health check failed:', healthStatus);
    } else {
      this.logger.debug('System health check passed');
    }

    return healthStatus;
  }

  @Get('detailed')
  @Public()
  async detailedCheck() {
    const services: Record<string, HealthStatus> = {};
    const metrics: SystemMetrics = this.getSystemMetrics();
    const databaseStats = await this.getDatabaseStats();

    services['nestjs'] = { status: 'healthy', details: { version: '1.0.0' } };
    services['mongodb'] = await this.checkMongoDB();
    services['sympy'] = await this.checkSymPy();
    services['neo4j'] = await this.checkNeo4jConnection();
    services['system'] = { status: 'healthy', details: metrics };
    services['database'] = { status: 'healthy', details: databaseStats };

    const allHealthy = Object.values(services).every(
      (s) => s.status === 'healthy',
    );

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services,
      metrics,
      databaseStats,
    };
  }

  private getSystemMetrics(): SystemMetrics {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    const cpuUsage = process.cpuUsage().system / 1000000;

    const metrics: SystemMetrics = {
      memoryUsage: {
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
        arrayBuffers: memoryUsage.arrayBuffers || 0,
      },
      uptime,
      cpuUsage,
    };

    const heapUsedMB = memoryUsage.heapUsed / (1024 * 1024);
    const rssMB = memoryUsage.rss / (1024 * 1024);

    if (heapUsedMB > MEMORY_WARNING_THRESHOLD_MB || rssMB > MEMORY_WARNING_THRESHOLD_MB * 1.5) {
      metrics.memoryWarning = `内存使用过高: heap=${heapUsedMB.toFixed(1)}MB, rss=${rssMB.toFixed(1)}MB`;
      this.logger.warn(metrics.memoryWarning);
    }

    const cpuPercent = (process.cpuUsage().user + process.cpuUsage().system) / (uptime * 1000000) * 100;
    if (cpuPercent > CPU_WARNING_THRESHOLD_PERCENT) {
      metrics.cpuWarning = `CPU使用率过高: ${cpuPercent.toFixed(1)}%`;
      this.logger.warn(metrics.cpuWarning);
    }

    return metrics;
  }

  private async getDatabaseStats() {
    try {
      const userCount = await this.userModel.countDocuments().exec();
      const questionCount = await this.questionModel.countDocuments().exec();
      const mistakeCount = await this.mistakeModel.countDocuments().exec();

      return {
        userCount,
        questionCount,
        mistakeCount,
      };
    } catch (error) {
      this.logger.error('Error getting database stats:', describeErrorForLog(error));
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkMongoDB(): Promise<HealthStatus> {
    try {
      await this.userModel.countDocuments().exec();
      return { status: 'healthy' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('MongoDB health check failed:', describeErrorForLog(error));
      return { status: 'unhealthy', message };
    }
  }

  private async checkSymPy(): Promise<HealthStatus> {
    const sympyUrl =
      this.configService.get<string>('SYMPY_SERVICE_URL') ||
      'http://localhost:8000';

    const maxRetries = 3;
    const retryDelay = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(`${sympyUrl}/health`, {
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          const data = (await response.json()) as SymPyHealthResponse;
          return {
            status: data?.status === 'healthy' ? 'healthy' : 'unhealthy',
            details: { version: data?.version },
          };
        }
      } catch (error) {
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          continue;
        }
        this.logger.error('SymPy health check failed:', describeErrorForLog(error));
        return { status: 'unhealthy', message: '服务未启动或无法连接' };
      }
    }

    return { status: 'unhealthy', message: '服务未响应' };
  }

  private async checkNeo4jConnection(): Promise<HealthStatus> {
    try {
      if (!(this.neo4jService as any).isConfigured || !(this.neo4jService as any).isConfigured()) {
        return { status: 'healthy', message: '未配置（使用内存降级模式）' };
      }
      if ((this.neo4jService as any).isAuthFailed && (this.neo4jService as any).isAuthFailed()) {
        return { status: 'unhealthy', message: '认证失败，请检查凭据配置' };
      }
      if (!this.neo4jService.isInitialized()) {
        await (this.neo4jService as any).onModuleInit();
        if (!this.neo4jService.isInitialized()) {
          return { status: 'unhealthy', message: 'Neo4j驱动未初始化' };
        }
      }

      await this.neo4jService.runQuery('RETURN 1 as test');
      return { status: 'healthy' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Neo4j health check failed:', describeErrorForLog(error));
      return { status: 'unhealthy', message };
    }
  }
}
