import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StudentKnowledgeController } from './student-knowledge.controller';
import { StudentKnowledgeService } from './student-knowledge.service';
import {
  StudentKnowledge,
  StudentKnowledgeSchema,
} from './schemas/student-knowledge.schema';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StudentKnowledge.name, schema: StudentKnowledgeSchema },
    ]),
    // KnowledgeModule → LearningModule → StudentModule 构成模块环
    forwardRef(() => KnowledgeModule),
  ],
  controllers: [StudentKnowledgeController],
  providers: [StudentKnowledgeService],
  exports: [StudentKnowledgeService],
})
export class StudentModule {}
