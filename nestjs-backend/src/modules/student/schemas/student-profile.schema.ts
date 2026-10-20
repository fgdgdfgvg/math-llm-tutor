import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StudentProfileDocument = StudentProfile & Document;

@Schema({ timestamps: true })
export class StudentProfile {
  @Prop({ required: true, unique: true })
  userId: string;

  @Prop({ type: Object, default: {} })
  errorPatterns: Record<string, number>;

  @Prop({ type: Object, default: {} })
  conceptMastery: Record<string, number>;

  @Prop({ type: [String], default: [] })
  knowledgeGaps: string[];

  @Prop({ type: Object, default: {} })
  strengthAreas: Record<string, number>;

  @Prop({ type: Object, default: {} })
  weaknessAreas: Record<string, number>;

  @Prop({ type: Number, default: 0 })
  totalProblemsAttempted: number;

  @Prop({ type: Number, default: 0 })
  totalProblemsCorrect: number;

  @Prop({ type: Number, default: 0 })
  averageResponseTime: number;

  @Prop({ type: [String], default: [] })
  recentProblemTypes: string[];

  @Prop({ type: Object, default: {} })
  learningPreferences: {
    preferredMode?: 'visual' | 'textual' | 'interactive';
    difficultyLevel?: 'easy' | 'medium' | 'hard';
    hintFrequency?: 'always' | 'on-demand' | 'minimal';
  };

  @Prop({ type: Date })
  lastActiveAt: Date;

  @Prop({ type: Number, default: 0 })
  streakDays: number;

  @Prop({ type: Date })
  lastPracticeDate: Date;
}

export const StudentProfileSchema =
  SchemaFactory.createForClass(StudentProfile);

StudentProfileSchema.index({ userId: 1 });
StudentProfileSchema.index({ lastActiveAt: -1 });
