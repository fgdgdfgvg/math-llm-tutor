import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LocalComputationService } from './local-computation.service';
import { MathTerminologyModule } from './math-terminology.module';
import { MathTerminologyService } from './math-terminology.service';

@Module({
  imports: [HttpModule, MathTerminologyModule],
  providers: [LocalComputationService, MathTerminologyService],
  exports: [LocalComputationService, MathTerminologyService],
})
export class LocalComputationModule {}
