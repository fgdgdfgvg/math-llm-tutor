import { Controller, Get, HttpStatus, Inject, Logger, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './modules/user/schemas/user.schema';
import { Question } from './modules/questions/schemas/question.schema';
import { Mistake } from './modules/questions/schemas/mistake.schema';
import { Neo4jService } from './modules/knowledge/neo4j/neo4j.service';
import { RedisCacheService } from './common/services/redis-cache.service';
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
    private readonly cacheService: RedisCacheService,
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
    services['cache'] = this.checkCache();
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

  /**
   * 存活探针（liveness）：只回答"进程还活着吗"，**不触碰任何外部依赖**。
   *
   * 为什么不能直接拿 /health 当 liveness：
   *  - /health 会同步探测 Mongo + SymPy（内部 3 次重试 × 5s 超时）+ Neo4j，
   *    单次最坏可到 15s 以上；
   *  - 而 k8s / Docker 的 liveness 探针超时通常只有 1~3s。一旦 SymPy 变慢
   *    （它是可降级的非关键依赖），/health 就会超时 → 探针判定"进程已死" →
   *    容器被反复重启，把一个本可降级的抖动放大成真正的故障。
   *  因此 liveness 必须恒定快速返回；依赖健康交给 /health 与 /health/ready。
   */
  @Get('live')
  @Public()
  live() {
    return {
      status: 'alive',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 就绪探针（readiness）：回答"现在能不能接业务流量"，不就绪时返回 503，
   * 让编排器把本实例**摘出负载均衡**（而不是重启它）。
   *
   * 判定口径与业务侧的真实降级能力保持一致：
   *  - **关键依赖**：Mongo（无它任何读写都失败）、已配置但不可达的 Redis
   *    （会话/限流状态退化为单实例内存，多实例下刷新令牌会跨实例失效）→ 判不就绪；
   *  - **可降级依赖**：SymPy / Neo4j。它们不可用时后端仍有规则引擎与内存图兜底，
   *    只是结果质量下降，**不应摘流量**；因此这里刻意不去调用它们
   *    —— 既避免探针被 3 次重试拖慢，也避免"非关键依赖抖动 = 全站不可用"的误判。
   *
   * 需要完整依赖视图时用 /health 或 /health/detailed（人工排查用，不适合当探针）。
   */
  @Get('ready')
  @Public()
  async ready(@Res({ passthrough: true }) res: Response) {
    const mongodb = await this.checkMongoDB();
    const cache = this.checkCache();

    const mongoOk = mongodb.status === 'healthy';
    // 未配置 Redis 时 checkCache() 返回 healthy（进程内内存模式，单实例可用）；
    // 配置了却连不上时返回 degraded —— 这时不能接流量，否则会出现跨实例刷新失败。
    const cacheOk = cache.status === 'healthy';
    const ready = mongoOk && cacheOk;

    if (!ready) res.status(HttpStatus.SERVICE_UNAVAILABLE);

    return {
      status: ready ? 'ready' : 'not-ready',
      timestamp: new Date().toISOString(),
      checks: { mongodb, cache },
      critical: { mongodb: mongoOk, cache: cacheOk },
    };
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
    services['cache'] = this.checkCache();
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

  /**
   * 缓存/会话存储状态。
   * refresh token 与登录限流计数都存在这里：未配置 Redis 时降级为进程内内存
   * （本机/单实例可用），但**多实例部署必须配置 Redis**，否则会出现
   * "A 实例登录、请求打到 B 实例时刷新失败"，因此这两种情况要能区分出来。
   */
  private checkCache(): HealthStatus {
    const stats = this.cacheService.getStats();
    if (this.cacheService.isRedisConnected()) {
      return { status: 'healthy', details: { mode: 'redis', stats } };
    }
    const configured = Boolean(this.configService.get<string>('REDIS_URL'));
    return {
      status: configured ? 'degraded' : 'healthy',
      message: configured
        ? 'Redis 已配置但不可达：会话与限流状态降级为本实例内存，多实例部署下会不一致'
        : '未配置 Redis：使用进程内内存缓存（单实例部署可用）',
      details: { mode: 'memory', stats },
    };
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
