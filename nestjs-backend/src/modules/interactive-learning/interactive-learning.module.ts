import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { LearningModule } from '../learning/learning.module';
import { DynamicKnowledgeGraphService } from './services/dynamic-knowledge-graph.service';
import { ScenarioConfigService } from './services/scenario-config.service';
import { InteractiveLearningController } from './interactive-learning.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    HttpModule,
    KnowledgeModule,
    LearningModule,
  ],
  controllers: [InteractiveLearningController],
  providers: [DynamicKnowledgeGraphService, ScenarioConfigService],
  exports: [DynamicKnowledgeGraphService, ScenarioConfigService],
})
export class InteractiveLearningModule {}
