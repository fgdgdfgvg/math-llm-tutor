import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LearningRecordDocument = LearningRecord & Document;

@Schema({ timestamps: true })
export class LearningRecord {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  conceptId: string;

  @Prop({ required: true })
  conceptName: string;

  @Prop({ type: String, enum: ['view', 'practice', 'master', 'review'], required: true })
  action: string;

  @Prop({ type: Number, min: 0, max: 1, default: 0 })
  masteryLevel: number;

  @Prop({ type: Number, default: 0 })
  timeSpent: number;

  @Prop({ type: Boolean, default: false })
  isCorrect: boolean;

  @Prop({ type: Number, default: 0 })
  difficulty: number;

  @Prop({ type: String })
  problemText: string;

  @Prop({ type: String })
  userAnswer: string;

  @Prop({ type: String })
  correctAnswer: string;

  @Prop({ type: Date, default: Date.now })
  nextReviewDate: Date;

  @Prop({ type: Number, default: 1 })
  reviewCount: number;

  @Prop({ type: Number, default: 1 })
  interval: number;

  @Prop({ type: Number, default: 2.5 })
  easeFactor: number;

  createdAt: Date;

  updatedAt: Date;
}

export const LearningRecordSchema = SchemaFactory.createForClass(LearningRecord);

LearningRecordSchema.index({ userId: 1, conceptId: 1, createdAt: -1 });
LearningRecordSchema.index({ userId: 1, nextReviewDate: 1 });
