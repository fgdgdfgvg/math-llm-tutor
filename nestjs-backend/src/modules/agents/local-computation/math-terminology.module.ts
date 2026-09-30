import { Module } from '@nestjs/common';
import { MathTerminologyService } from './math-terminology.service';

@Module({
  providers: [MathTerminologyService],
  exports: [MathTerminologyService],
})
export class MathTerminologyModule {}
