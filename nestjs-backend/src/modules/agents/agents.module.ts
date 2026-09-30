import { Module, Provider } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { AgentOrchestrator } from './agent.orchestrator';
import { PlannerAgent } from './planner/planner.agent';
import { SolverAgent } from './solver/solver.agent';
import { DiagnosticAgent } from './diagnostic/diagnostic.agent';
import { FeedbackAgent } from './feedback/feedback.agent';
import { AgentsService } from './agents.service';
import { AIModelsService } from './ai-models.service';
import { AgentsController } from './agents.controller';
import { LocalComputationModule } from './local-computation/local-computation.module';
import { LocalComputationService } from './local-computation/local-computation.service';
import { AnswerEquivalenceService } from './answer-equivalence.service';
import { SolutionVerificationService } from './solution-verification.service';
import { StepValidationService } from './diagnostic/step-validation.service';
import { VisualizationService } from './diagnostic/visualization.service';
import { RedisCacheService } from '../../common/services/redis-cache.service';
import { ErrorDiagnosisService } from '../../common/services/error-diagnosis.service';
import { ModelRouterService } from '../../common/services/model-router.service';
import { HallucinationGuardService } from '../../common/services/hallucination-guard.service';
import { UserProfilingService } from '../../common/services/user-profiling.service';
import { AcademicIntegrityService } from '../../common/services/academic-integrity.service';

@Module({
  imports: [HttpModule, ConfigModule, KnowledgeModule, LocalComputationModule],
  controllers: [AgentsController],
  providers: [
    // AI 模型服务
    AIModelsService,
    
    // 步骤验证和可视化服务
    StepValidationService,
    VisualizationService,

    // 答案等价判定（精确多项式差 → 解集 → 数值抽样）
    AnswerEquivalenceService,

    // 解题结果自校验（求导/积分/方程/极限 代回原题，数值 + 符号证据）
    SolutionVerificationService,
    
    // 智能体配置
    {
      provide: 'PLANNER_AGENT_CONFIG',
      useValue: {
        name: 'planner',
        model: 'GPT5.2',
        timeout: 30000,
        maxRetries: 2,
      },
    },
    {
      provide: 'SOLVER_AGENT_CONFIG',
      useValue: {
        name: 'solver',
        model: 'DeepSeek',
        timeout: 60000,
        maxRetries: 2,
      },
    },
    {
      provide: 'DIAGNOSTIC_AGENT_CONFIG',
      useValue: {
        name: 'diagnostic',
        model: 'GPT5.2',
        timeout: 30000,
        maxRetries: 2,
      },
    },
    {
      provide: 'FEEDBACK_AGENT_CONFIG',
      useValue: {
        name: 'feedback',
        model: 'KatCoder',
        timeout: 30000,
        maxRetries: 2,
      },
    },
    
    // 智能体实例
    {
      provide: PlannerAgent,
      useFactory: (config: any, configService: ConfigService, httpService: any, knowledgeService: any, aiModelsService: AIModelsService) => {
        return new PlannerAgent(config, configService, httpService, knowledgeService, aiModelsService);
      },
      inject: ['PLANNER_AGENT_CONFIG', ConfigService, HttpService, KnowledgeService, AIModelsService],
    },
    {
      provide: SolverAgent,
      useFactory: (config: any, configService: ConfigService, httpService: any, aiModelsService: AIModelsService, localComputationService: LocalComputationService, redisCacheService: RedisCacheService, modelRouterService: ModelRouterService, hallucinationGuardService: HallucinationGuardService) => {
        return new SolverAgent(config, configService, httpService, aiModelsService, localComputationService, redisCacheService, modelRouterService, hallucinationGuardService);
      },
      inject: ['SOLVER_AGENT_CONFIG', ConfigService, HttpService, AIModelsService, LocalComputationService, RedisCacheService, ModelRouterService, HallucinationGuardService],
    },
    {
      provide: DiagnosticAgent,
      useFactory: (config: any, configService: ConfigService, httpService: any, aiModelsService: AIModelsService, localComputationService: LocalComputationService, stepValidationService: StepValidationService, visualizationService: VisualizationService, errorDiagnosisService: ErrorDiagnosisService) => {
        return new DiagnosticAgent(config, configService, httpService, aiModelsService, localComputationService, stepValidationService, visualizationService, errorDiagnosisService);
      },
      inject: ['DIAGNOSTIC_AGENT_CONFIG', ConfigService, HttpService, AIModelsService, LocalComputationService, StepValidationService, VisualizationService, ErrorDiagnosisService],
    },
    {
      provide: FeedbackAgent,
      useFactory: (config: any, configService: ConfigService, httpService: any, aiModelsService: AIModelsService, localComputationService: LocalComputationService) => {
        return new FeedbackAgent(config, configService, httpService, aiModelsService, localComputationService);
      },
      inject: ['FEEDBACK_AGENT_CONFIG', ConfigService, HttpService, AIModelsService, LocalComputationService],
    },
    
    // 智能体编排器
    {
      provide: AgentOrchestrator,
      useFactory: (plannerAgent: PlannerAgent, solverAgent: SolverAgent, diagnosticAgent: DiagnosticAgent, feedbackAgent: FeedbackAgent) => {
        const config = {
          agents: [
            {
              name: 'planner',
              model: 'GPT5.2' as const,
            },
            {
              name: 'solver',
              model: 'DeepSeek' as const,
            },
            {
              name: 'diagnostic',
              model: 'GPT5.2' as const,
            },
            {
              name: 'feedback',
              model: 'KatCoder' as const,
            },
          ],
          workflow: ['planner', 'solver', 'diagnostic', 'feedback'],
          maxExecutionTime: 300000,
          fallbackStrategy: 'retry' as const,
        };

        return new AgentOrchestrator(config, [plannerAgent, solverAgent, diagnosticAgent, feedbackAgent]);
      },
      inject: [PlannerAgent, SolverAgent, DiagnosticAgent, FeedbackAgent],
    },
    
    // 智能体服务
    AgentsService,
  ],
  exports: [AgentsService, AgentOrchestrator, SolutionVerificationService],
})
export class AgentsModule {}