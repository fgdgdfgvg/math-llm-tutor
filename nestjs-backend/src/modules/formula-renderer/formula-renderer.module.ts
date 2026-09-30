import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FormulaRendererController } from './formula-renderer.controller';
import { FormulaRendererService } from './formula-renderer.service';

@Module({
  imports: [HttpModule],
  controllers: [FormulaRendererController],
  providers: [FormulaRendererService],
  exports: [FormulaRendererService],
})
export class FormulaRendererModule {}
