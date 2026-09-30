import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  timestamps: true,
  collection: 'questions',
})
export class Question extends Document {
  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true,
  })
  questionId: string;

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
  })
  chapterSource: string;

  @Prop({
    type: String,
    required: true,
  })
  content: string;

  @Prop({
    type: String,
    enum: ['基础', '中等', '较难', '困难'],
    required: true,
  })
  difficulty: string;

  @Prop({
    type: [String],
    required: true,
  })
  solutionSteps: string[];

  @Prop({
    type: String,
    required: true,
  })
  answer: string;

  @Prop({
    type: String,
  })
  questionType: string;

  @Prop({
    type: Number,
  })
  score: number;

  @Prop({
    type: String,
  })
  estimatedTime: string;

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

export const QuestionSchema = SchemaFactory.createForClass(Question);