import { Module } from '@nestjs/common';
import { AssessmentService } from './assessment.service';
import { AssessmentController } from './assessment.controller';
import { LearningModule } from '../learning/learning.module';

@Module({
  imports: [LearningModule],
  providers: [AssessmentService],
  controllers: [AssessmentController],
  exports: [AssessmentService],
})
export class AssessmentModule {}
