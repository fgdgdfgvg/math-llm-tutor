import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DialogueService } from './dialogue.service';
import { DialogueController } from './dialogue.controller';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ErrorAnalysisModule } from '../error-analysis/error-analysis.module';
import { LearningModule } from '../learning/learning.module';
import { DialogueSession, DialogueSessionSchema } from './schemas/dialogue-session.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DialogueSession.name, schema: DialogueSessionSchema }
    ]),
    KnowledgeModule,
    ErrorAnalysisModule,
    LearningModule
  ],
  controllers: [DialogueController],
  providers: [DialogueService],
  exports: [DialogueService],
})
export class DialogueModule {}
