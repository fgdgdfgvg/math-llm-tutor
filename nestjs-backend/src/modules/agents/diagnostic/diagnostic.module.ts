import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DiagnosticAgent } from './diagnostic.agent';
import { StepValidationService } from './step-validation.service';
import { VisualizationService } from './visualization.service';
import { LocalComputationModule } from '../local-computation/local-computation.module';

@Module({
  imports: [HttpModule, LocalComputationModule],
  providers: [DiagnosticAgent, StepValidationService, VisualizationService],
  exports: [DiagnosticAgent, StepValidationService, VisualizationService],
})
export class DiagnosticModule {}
