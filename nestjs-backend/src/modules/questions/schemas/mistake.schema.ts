import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  timestamps: true,
  collection: 'mistakes',
})
export class Mistake extends Document {
  @Prop({
    type: String,
    required: true,
    index: true,
  })
  userId: string;

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  questionId: string;

  @Prop({
    type: String,
    required: true,
  })
  questionContent: string;

  @Prop({
    type: String,
    required: true,
  })
  userAnswer: string;

  @Prop({
    type: String,
    required: true,
  })
  correctAnswer: string;

  @Prop({
    type: [String],
    required: true,
  })
  solutionSteps: string[];

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  knowledgePoint: string;

  @Prop({
    type: [String],
    default: [],
  })
  subConcepts: string[];

  @Prop({
    type: String,
    required: true,
  })
  difficulty: string;

  @Prop({
    type: Date,
    required: true,
  })
  attemptedAt: Date;

  @Prop({
    type: Boolean,
    default: false,
  })
  reviewed: boolean;

  @Prop({
    type: Date,
  })
  reviewedAt: Date;

  @Prop({
    type: String,
  })
  notes: string;

  @Prop({
    type: Date,
    default: Date.now,
  })
  createdAt: Date;

  @Prop({
    type: Date,
    default: Date.now,
  })
  updatedAt: Date;
}

export const MistakeSchema = SchemaFactory.createForClass(Mistake);