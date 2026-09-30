import { Controller, Post, Body, Get, Param, Put, Delete } from '@nestjs/common';
import { ErrorAnalysisService, ErrorDiagnosis, MultiStepDiagnosis, ErrorPattern } from './error-analysis.service';
import { AnalyzeErrorDto, AnalyzeMultiStepSolutionDto, AddErrorPatternDto, UpdateErrorPatternDto } from './dto/error-analysis.dto';

@Controller('error-analysis')
export class ErrorAnalysisController {
  constructor(private readonly errorAnalysisService: ErrorAnalysisService) {}

  @Post('analyze')
  async analyzeError(
    @Body() dto: AnalyzeErrorDto,
  ): Promise<ErrorDiagnosis[]> {
    return this.errorAnalysisService.analyzeError(dto.userAnswer, dto.correctAnswer);
  }

  @Post('analyze-multi-step')
  async analyzeMultiStepSolution(
    @Body() dto: AnalyzeMultiStepSolutionDto,
  ): Promise<MultiStepDiagnosis> {
    return this.errorAnalysisService.analyzeMultiStepSolution(dto.steps);
  }

  @Get('patterns')
  async getErrorPatterns(): Promise<ErrorPattern[]> {
    return this.errorAnalysisService.getErrorPatterns();
  }

  @Post('patterns')
  async addErrorPattern(
    @Body() dto: AddErrorPatternDto,
  ): Promise<ErrorPattern> {
    return this.errorAnalysisService.addErrorPattern({
      ...dto,
      pattern: new RegExp(dto.pattern)
    });
  }

  @Put('patterns/:id')
  async updateErrorPattern(
    @Param('id') id: string,
    @Body() dto: UpdateErrorPatternDto,
  ): Promise<ErrorPattern | null> {
    const updates: any = { ...dto };
    if (dto.pattern) {
      updates.pattern = new RegExp(dto.pattern);
    }
    return this.errorAnalysisService.updateErrorPattern(id, updates);
  }

  @Delete('patterns/:id')
  async deleteErrorPattern(@Param('id') id: string): Promise<boolean> {
    return this.errorAnalysisService.deleteErrorPattern(id);
  }
}
