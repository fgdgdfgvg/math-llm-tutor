import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Neo4jService } from '../../modules/knowledge/neo4j/neo4j.service';
import { HealthController } from '../../health.controller';

export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastChecked: Date;
  recoveryAttempts: number;
  lastRecovery: Date | null;
}

@Injectable()
export class RecoveryService implements OnModuleInit {
  private readonly logger = new Logger(RecoveryService.name);
  private serviceStatuses: Map<string, ServiceStatus> = new Map();
  private recoveryInterval: NodeJS.Timeout | null = null;
  private readonly checkInterval = 30000; // 30秒检查一次
  private readonly maxRecoveryAttempts = 3;

  constructor(
    private readonly configService: ConfigService,
    private readonly neo4jService: Neo4jService,
    private readonly healthController: HealthController,
  ) {
    this.initializeServiceStatuses();
  }

  async onModuleInit() {
    this.startRecoveryMonitoring();
    this.logger.log('Recovery service initialized and monitoring started');
  }

  private initializeServiceStatuses() {
    const services = ['mongodb', 'sympy', 'neo4j', 'nestjs'];
    services.forEach(service => {
      this.serviceStatuses.set(service, {
        name: service,
        status: 'unknown',
        lastChecked: new Date(),
        recoveryAttempts: 0,
        lastRecovery: null,
      });
    });
  }

  private startRecoveryMonitoring() {
    this.recoveryInterval = setInterval(async () => {
      await this.checkAndRecoverServices();
    }, this.checkInterval);
  }

  private async checkAndRecoverServices() {
    try {
      const healthStatus = await this.healthController.check();
      
      // 检查各服务状态
      Object.entries(healthStatus.services).forEach(([serviceName, status]) => {
        const currentStatus = this.serviceStatuses.get(serviceName);
        if (currentStatus) {
          currentStatus.status = status.status as 'healthy' | 'unhealthy';
          currentStatus.lastChecked = new Date();
          
          if (status.status === 'unhealthy') {
            this.handleUnhealthyService(serviceName, currentStatus);
          } else if (status.status === 'healthy') {
            // 重置恢复尝试次数
            currentStatus.recoveryAttempts = 0;
          }
        }
      });
    } catch (error) {
      this.logger.error('Error checking service status:', error);
    }
  }

  private async handleUnhealthyService(serviceName: string, status: ServiceStatus) {
    if (serviceName === 'neo4j') {
      if (!(this.neo4jService as any).isConfigured || !(this.neo4jService as any).isConfigured()) {
        this.logger.debug('Neo4j 未配置，跳过恢复');
        return;
      }
      if ((this.neo4jService as any).isAuthFailed && (this.neo4jService as any).isAuthFailed()) {
        this.logger.debug('Neo4j 认证失败，跳过恢复（请检查 .env 中凭据配置）');
        return;
      }
    }

    this.logger.warn(`Service ${serviceName} is unhealthy, attempting recovery`);
    
    if (status.recoveryAttempts >= this.maxRecoveryAttempts) {
      this.logger.error(`Service ${serviceName} has reached maximum recovery attempts, manual intervention required`);
      return;
    }

    status.recoveryAttempts++;
    
    try {
      switch (serviceName) {
        case 'neo4j':
          await this.recoverNeo4j();
          break;
        case 'mongodb':
          this.logger.warn('MongoDB recovery requires manual intervention or Docker restart');
          break;
        case 'sympy':
          this.logger.warn('SymPy service recovery requires Docker restart');
          break;
        default:
          this.logger.warn(`No recovery strategy defined for service ${serviceName}`);
      }
      
      status.lastRecovery = new Date();
      this.logger.log(`Recovery attempt ${status.recoveryAttempts} for ${serviceName} completed`);
    } catch (error) {
      this.logger.error(`Recovery failed for service ${serviceName}:`, error);
    }
  }

  private async recoverNeo4j() {
    try {
      this.logger.log('Attempting to recover Neo4j connection');
      
      // 尝试重新初始化Neo4j连接
      if (!this.neo4jService.isInitialized()) {
        await (this.neo4jService as any).onModuleInit();
        this.logger.log('Neo4j connection reinitialized');
      }
      
      // 测试连接
      await this.neo4jService.runQuery('RETURN 1 as test');
      this.logger.log('Neo4j recovery successful');
    } catch (error) {
      this.logger.error('Neo4j recovery failed:', error);
      throw error;
    }
  }

  async getRecoveryStatus() {
    return Object.fromEntries(this.serviceStatuses);
  }

  async forceRecovery(serviceName: string) {
    const status = this.serviceStatuses.get(serviceName);
    if (status) {
      status.recoveryAttempts = 0;
      await this.handleUnhealthyService(serviceName, status);
      return { success: true, message: `Recovery initiated for ${serviceName}` };
    }
    return { success: false, message: `Service ${serviceName} not found` };
  }

  stopMonitoring() {
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
      this.recoveryInterval = null;
      this.logger.log('Recovery monitoring stopped');
    }
  }
}
