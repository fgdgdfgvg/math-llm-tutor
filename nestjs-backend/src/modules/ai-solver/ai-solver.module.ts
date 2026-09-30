import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AiSolverController } from './ai-solver.controller';
import { AiSolverService } from './ai-solver.service';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [HttpModule, KnowledgeModule],
  controllers: [AiSolverController],
  providers: [AiSolverService],
})
export class AiSolverModule {}
