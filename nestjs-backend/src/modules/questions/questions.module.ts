import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import { QuestionSeedService } from './question-seed.service';
import { Question, QuestionSchema } from './schemas/question.schema';
import { Mistake, MistakeSchema } from './schemas/mistake.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Question.name, schema: QuestionSchema },
      { name: Mistake.name, schema: MistakeSchema },
    ]),
  ],
  controllers: [QuestionsController],
  providers: [QuestionsService, QuestionSeedService],
  exports: [QuestionsService],
})
export class QuestionsModule {}
