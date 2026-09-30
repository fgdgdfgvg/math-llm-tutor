import { Module } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { RecommendationController } from './recommendation.controller';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { LearningModule } from '../learning/learning.module';
import { ErrorAnalysisModule } from '../error-analysis/error-analysis.module';
import { QuestionsModule } from '../questions/questions.module';

@Module({
  imports: [KnowledgeModule, LearningModule, ErrorAnalysisModule, QuestionsModule],
  controllers: [RecommendationController],
  providers: [RecommendationService],
  exports: [RecommendationService],
})
export class RecommendationModule {}
