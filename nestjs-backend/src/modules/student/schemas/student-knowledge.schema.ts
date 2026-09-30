import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StudentKnowledgeDocument = StudentKnowledge & Document;

@Schema({ timestamps: true })
export class StudentKnowledge {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  conceptId: string;

  @Prop({
    type: String,
    enum: ['none', 'learning', 'practicing', 'mastered'],
    default: 'none',
  })
  status: 'none' | 'learning' | 'practicing' | 'mastered';

  @Prop({ type: Number, min: 0, max: 1, default: 0 })
  masteryLevel: number;

  @Prop({ type: Number, default: 0 })
  attemptsCount: number;

  @Prop({ type: Number, default: 0 })
  correctCount: number;

  @Prop({ type: Number, default: 0 })
  incorrectCount: number;

  @Prop({ type: Date })
  lastPracticed: Date;

  @Prop({ type: Date })
  firstLearned: Date;

  @Prop({ type: [String], default: [] })
  weakPoints: string[];

  @Prop({ type: [String], default: [] })
  strongPoints: string[];

  // 必须声明为子文档数组（SchemaArray），否则该路径是 Mixed，
  // push 不会被标记为已修改，save() 时除首次写入外全部丢失：
  // 表现就是 attemptsCount 正确递增，但练习历史永远只有第一条。
  @Prop({
    type: [
      {
        date: { type: Date, default: Date.now },
        problemId: { type: String, default: '' },
        isCorrect: { type: Boolean, default: false },
        timeSpent: { type: Number, default: 0 },
        _id: false,
      },
    ],
    default: [],
  })
  practiceHistory: {
    date: Date;
    problemId: string;
    isCorrect: boolean;
    timeSpent: number;
  }[];

  @Prop({ type: Number, default: 0 })
  totalPracticeTime: number;

  @Prop({ type: Number, default: 0 })
  streakDays: number;

  @Prop({ type: Date })
  lastStreakDate: Date;
}

export const StudentKnowledgeSchema =
  SchemaFactory.createForClass(StudentKnowledge);

StudentKnowledgeSchema.index({ userId: 1, conceptId: 1 }, { unique: true });

StudentKnowledgeSchema.index({ userId: 1, masteryLevel: -1 });

StudentKnowledgeSchema.index({ userId: 1, lastPracticed: -1 });
