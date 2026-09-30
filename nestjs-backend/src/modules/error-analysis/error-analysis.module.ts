import { Module } from '@nestjs/common';
import { ErrorAnalysisService } from './error-analysis.service';
import { ErrorAnalysisController } from './error-analysis.controller';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [KnowledgeModule],
  controllers: [ErrorAnalysisController],
  providers: [ErrorAnalysisService],
  exports: [ErrorAnalysisService],
})
export class ErrorAnalysisModule {}
