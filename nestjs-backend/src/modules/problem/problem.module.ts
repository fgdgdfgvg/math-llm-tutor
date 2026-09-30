import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Problem, ProblemSchema } from './schemas/problem.schema';
import { ProblemController } from './problem.controller';
import { ProblemService } from './problem.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Problem.name, schema: ProblemSchema }]),
  ],
  controllers: [ProblemController],
  providers: [ProblemService],
  exports: [ProblemService],
})
export class ProblemModule {}
