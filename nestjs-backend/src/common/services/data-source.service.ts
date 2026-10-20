import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DataSourceService {
  private readonly logger = new Logger(DataSourceService.name);
  private readonly isDevelopment: boolean;
  private readonly isTest: boolean;
  private readonly useMockData: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isDevelopment = this.configService.get('NODE_ENV') === 'development';
    this.isTest = this.configService.get('NODE_ENV') === 'test';
    this.useMockData = this.configService.get('USE_MOCK_DATA') === 'true';

    this.logger.log(`DataSourceService initialized:`);
    this.logger.log(`- Environment: ${this.configService.get('NODE_ENV')}`);
    this.logger.log(`- Use mock data: ${this.useMockData}`);
  }

  /**
   * 检查是否应该使用模拟数据
   * 在生产环境中始终返回false
   */
  shouldUseMockData(): boolean {
    if (this.configService.get('NODE_ENV') === 'production') {
      return false;
    }
    return this.useMockData || this.isDevelopment || this.isTest;
  }

  /**
   * 检查是否为生产环境
   */
  isProduction(): boolean {
    return this.configService.get('NODE_ENV') === 'production';
  }

  /**
   * 检查是否为开发环境
   */
  isDevelopmentEnvironment(): boolean {
    return this.isDevelopment;
  }

  /**
   * 检查是否为测试环境
   */
  isTestEnvironment(): boolean {
    return this.isTest;
  }

  /**
   * 获取数据源类型
   */
  getDataSourceType(): 'production' | 'development' | 'test' {
    const env = this.configService.get('NODE_ENV');
    if (env === 'production') return 'production';
    if (env === 'test') return 'test';
    return 'development';
  }

  /**
   * 验证数据源配置
   */
  validateDataSource(): boolean {
    if (this.isProduction()) {
      if (this.useMockData) {
        this.logger.warn(
          'USE_MOCK_DATA is true in production environment - overriding to false',
        );
        return false;
      }
      return true;
    }
    return true;
  }

  /**
   * 获取数据库连接配置
   */
  getDatabaseConfig(): any {
    const env = this.getDataSourceType();

    return {
      production: {
        uri:
          this.configService.get('MONGODB_URI') ||
          'mongodb://localhost:27017/math-tutor-prod',
        options: {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        },
      },
      development: {
        uri:
          this.configService.get('MONGODB_URI_DEV') ||
          'mongodb://localhost:27017/math-tutor-dev',
        options: {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        },
      },
      test: {
        uri:
          this.configService.get('MONGODB_URI_TEST') ||
          'mongodb://localhost:27017/math-tutor-test',
        options: {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        },
      },
    }[env];
  }

  /**
   * 获取Neo4j连接配置
   */
  getNeo4jConfig(): any {
    const env = this.getDataSourceType();

    return {
      production: {
        scheme: 'neo4j',
        host: this.configService.get('NEO4J_HOST') || 'localhost',
        port: parseInt(this.configService.get('NEO4J_PORT') || '7687'),
        username: this.configService.get('NEO4J_USER') || 'neo4j',
        password: this.configService.get('NEO4J_PASSWORD') || 'your-password',
        database: this.configService.get('NEO4J_DATABASE') || 'neo4j',
      },
      development: {
        scheme: 'neo4j',
        host: this.configService.get('NEO4J_HOST') || 'localhost',
        port: parseInt(this.configService.get('NEO4J_PORT') || '7687'),
        username: this.configService.get('NEO4J_USER') || 'neo4j',
        password: this.configService.get('NEO4J_PASSWORD') || '',
        database: this.configService.get('NEO4J_DATABASE') || 'neo4j',
      },
      test: {
        scheme: 'neo4j',
        host: this.configService.get('NEO4J_HOST') || 'localhost',
        port: parseInt(this.configService.get('NEO4J_PORT') || '7687'),
        username: this.configService.get('NEO4J_USER') || 'neo4j',
        password: this.configService.get('NEO4J_PASSWORD') || '',
        database: this.configService.get('NEO4J_DATABASE') || 'neo4j',
      },
    }[env];
  }

  /**
   * 获取API服务配置
   */
  getApiConfig(): any {
    return {
      port: parseInt(this.configService.get('PORT') || '3000'),
      host: this.configService.get('HOST') || '0.0.0.0',
      cors: {
        origin: this.configService.get('CORS_ORIGIN') || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      },
    };
  }
}
