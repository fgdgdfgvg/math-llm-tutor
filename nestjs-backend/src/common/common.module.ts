import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DataSourceService } from './services/data-source.service';
import { RedisCacheService } from './services/redis-cache.service';
import { ErrorDiagnosisService } from './services/error-diagnosis.service';
import { ModelRouterService } from './services/model-router.service';
import { HallucinationGuardService } from './services/hallucination-guard.service';
import { UserProfilingService } from './services/user-profiling.service';
import { AcademicIntegrityService } from './services/academic-integrity.service';
import { ContentAuditService } from './services/content-audit.service';
import { LeanVerificationService } from './services/lean-verification.service';
import { MessageQueueService } from './services/message-queue.service';
import { ConnectionPoolService } from './services/connection-pool.service';
import { AsyncProcessingService } from './services/async-processing.service';
import { ModelExpansionService } from './services/model-expansion.service';
import { CollaborationSessionService } from './services/collaboration-session.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    DataSourceService,
    RedisCacheService,
    ErrorDiagnosisService,
    ModelRouterService,
    HallucinationGuardService,
    UserProfilingService,
    AcademicIntegrityService,
    ContentAuditService,
    LeanVerificationService,
    MessageQueueService,
    ConnectionPoolService,
    AsyncProcessingService,
    ModelExpansionService,
    CollaborationSessionService,
  ],
  exports: [
    DataSourceService,
    RedisCacheService,
    ErrorDiagnosisService,
    ModelRouterService,
    HallucinationGuardService,
    UserProfilingService,
    AcademicIntegrityService,
    ContentAuditService,
    LeanVerificationService,
    MessageQueueService,
    ConnectionPoolService,
    AsyncProcessingService,
    ModelExpansionService,
    CollaborationSessionService,
  ],
})
export class CommonModule {}
