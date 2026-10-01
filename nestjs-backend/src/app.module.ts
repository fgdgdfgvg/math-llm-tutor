import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './core/auth/auth.module';
import { RecoveryModule } from './core/recovery/recovery.module';
import { ProblemModule } from './modules/problem/problem.module';
import { AiSolverModule } from './modules/ai-solver/ai-solver.module';
import { SympyModule } from './modules/sympy/sympy.module';
import { AgentsModule } from './modules/agents/agents.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { StudentModule } from './modules/student/student.module';
import { LearningModule } from './modules/learning/learning.module';
import { AdminModule } from './modules/admin/admin.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { ErrorAnalysisModule } from './modules/error-analysis/error-analysis.module';
import { RecommendationModule } from './modules/recommendation/recommendation.module';
import { DialogueModule } from './modules/dialogue/dialogue.module';
import { SyncModule } from './modules/sync/sync.module';
import { AssessmentModule } from './modules/assessment/assessment.module';
import { ScenarioModule } from './modules/scenario/scenario.module';
import { MultimodalModule } from './modules/multimodal/multimodal.module';
import { FormulaRendererModule } from './modules/formula-renderer/formula-renderer.module';
import { InteractiveLearningModule } from './modules/interactive-learning/interactive-learning.module';
import { CollaborationModule } from './modules/collaboration/collaboration.module';
import { CommonModule } from './common/common.module';
import { GlobalAuthGuard } from './core/auth/guards/global-auth.guard';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TraceIdInterceptor } from './common/interceptors/trace-id.interceptor';
import { HealthController } from './health.controller';
import { resolveMongoUri } from './core/database/resolve-mongo-uri';
import { ApiDocsController } from './api-docs.controller';
import { User, UserSchema } from './modules/user/schemas/user.schema';
import { Question, QuestionSchema } from './modules/questions/schemas/question.schema';
import { Mistake, MistakeSchema } from './modules/questions/schemas/mistake.schema';

@Module({
  imports: [
    CommonModule,
    UserModule,
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        // 校验配置的 URI；凭据鉴权失败时自动回退到无凭据连接（本机 MongoDB 常未开鉴权）
        uri: await resolveMongoUri(configService.get<string>('MONGODB_URI')),
        retryAttempts: 5,
        retryDelay: 3000,
        connectionFactory: (connection) => {
          const logger = new (require('@nestjs/common').Logger)('MongoDB');
          connection.on('connected', () => logger.log('MongoDB连接成功'));
          connection.on('error', (err) => logger.error('MongoDB连接错误:', err.message));
          connection.on('disconnected', () => logger.warn('MongoDB连接断开'));
          return connection;
        },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: Mistake.name, schema: MistakeSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET')!,
        signOptions: {
          // access token 默认 15 分钟（原为 7 天），配合 /auth/refresh 续期；
          // 提升 JWT_EXPIRATION 可覆盖，但生产环境不建议超过 1 小时。
          expiresIn: (configService.get<string>('JWT_EXPIRATION') || '15m') as any,
        },
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    RecoveryModule,
    ProblemModule,
    AiSolverModule,
    SympyModule,
    AgentsModule,
    KnowledgeModule,
    StudentModule,
    LearningModule,
    AdminModule,
    QuestionsModule,
    ErrorAnalysisModule,
    RecommendationModule,
    DialogueModule,
    SyncModule,
    AssessmentModule,
    ScenarioModule,
    MultimodalModule,
    FormulaRendererModule,
    InteractiveLearningModule,
    CollaborationModule,
  ],
  controllers: [AppController, HealthController, ApiDocsController],
  providers: [
    AppService,
    {
      // 全局异常过滤器：统一 {code,statusCode,message,traceId} 信封，
      // 生产环境不回传堆栈与内部细节。放在最外层兜住所有模块。
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      // traceId 需要包住后续所有逻辑（守卫、管道、业务），因此用 APP_INTERCEPTOR 注册，
      // 先于 main.ts 里 useGlobalInterceptors 注册的转换器生效。
      provide: APP_INTERCEPTOR,
      useClass: TraceIdInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      provide: APP_GUARD,
      useClass: GlobalAuthGuard,
    },
  ],
})
export class AppModule {}
