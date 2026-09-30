import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface LearningBehaviorDetails {
  problemId?: string;
  errorType?: string;
  attempts?: number;
  success?: boolean;
}

@Schema({
  timestamps: true,
  expires: '30d' // 30天过期
})
export class LearningBehavior {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  conceptId: string;

  @Prop({ required: true, enum: ['view', 'practice', 'master', 'review', 'error'] })
  behaviorType: 'view' | 'practice' | 'master' | 'review' | 'error';

  @Prop({ required: true, default: 0 })
  duration: number; // 秒

  @Prop({ type: Date, default: Date.now })
  timestamp: Date;

  @Prop({ type: Object })
  details?: LearningBehaviorDetails;
}

export type LearningBehaviorDocument = LearningBehavior & Document;
export const LearningBehaviorSchema = SchemaFactory.createForClass(LearningBehavior);
