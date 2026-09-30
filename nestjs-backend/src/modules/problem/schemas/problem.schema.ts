import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProblemDocument = Problem & Document;

@Schema({ timestamps: true })
export class Problem {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  difficulty: string;

  @Prop({ required: true })
  content: string;

  @Prop({ required: true })
  answer: string;

  @Prop()
  solution: string;
}

export const ProblemSchema = SchemaFactory.createForClass(Problem);
