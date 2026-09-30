import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export interface DialogueMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type: 'question' | 'answer' | 'hint' | 'feedback';
}

export interface DialogueContext {
  problemId?: string;
  currentStep?: number;
  relatedConcepts?: string[];
}

@Schema({
  timestamps: true,
  expires: '24h' // 24小时过期
})
export class DialogueSession {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ type: Array, default: [] })
  messages: DialogueMessage[];

  @Prop({ type: Object, default: {} })
  context: DialogueContext;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  lastUpdated: Date;
}

export type DialogueSessionDocument = DialogueSession & Document;
export const DialogueSessionSchema = SchemaFactory.createForClass(DialogueSession);
