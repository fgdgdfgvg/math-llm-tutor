import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  timestamps: true,
  expires: '30d' // 30天过期
})
export class LearningInsight {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true, enum: ['trend', 'warning', 'recommendation'] })
  insightType: 'trend' | 'warning' | 'recommendation';

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, enum: ['low', 'medium', 'high'] })
  severity: 'low' | 'medium' | 'high';

  @Prop({ type: Date, default: Date.now })
  timestamp: Date;

  @Prop({ type: Array, default: [] })
  relatedConcepts?: string[];

  @Prop({ default: false })
  actionRequired?: boolean;
}

export type LearningInsightDocument = LearningInsight & Document;
export const LearningInsightSchema = SchemaFactory.createForClass(LearningInsight);
