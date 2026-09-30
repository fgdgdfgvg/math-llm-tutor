import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';
import { LearningRecord, LearningRecordSchema } from './schemas/learning-record.schema';
import { StudentModule } from '../student/student.module';
import { KnowledgePointMappingService } from '../knowledge/knowledge-point-mapping.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LearningRecord.name, schema: LearningRecordSchema },
    ]),
    // 学习进度的唯一数据源是 student-knowledge（练习页写入），此处复用避免两套数据不一致。
    // StudentModule 又依赖 KnowledgeModule（概念查询），KnowledgeModule 依赖 LearningModule，
    // 形成模块环，因此这里用 forwardRef 打破循环。
    forwardRef(() => StudentModule),
  ],
  controllers: [LearningController],
  // KnowledgePointMappingService 无外部依赖（只读 datasets JSON），
  // 在本模块直接提供，避免 LearningModule ↔ KnowledgeModule 再添一层循环依赖。
  providers: [LearningService, KnowledgePointMappingService],
  exports: [LearningService],
})
export class LearningModule {}
