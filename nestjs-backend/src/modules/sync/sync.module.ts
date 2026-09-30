import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { LearningRecord, LearningRecordSchema } from '../learning/schemas/learning-record.schema';
import { LearningBehavior, LearningBehaviorSchema } from './schemas/learning-behavior.schema';
import { LearningInsight, LearningInsightSchema } from './schemas/learning-insight.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LearningRecord.name, schema: LearningRecordSchema },
      { name: LearningBehavior.name, schema: LearningBehaviorSchema },
      { name: LearningInsight.name, schema: LearningInsightSchema }
    ]),
  ],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
