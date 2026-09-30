import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { AssessmentService } from './assessment.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';

@Controller('assessment')
export class AssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  @UseGuards(JwtAuthGuard)
  @Get('report/:userId')
  async generateReport(
    @Param('userId') _userId: string,
    @Request() req: Request & { user: { userId: string } },
  ) {
    return this.assessmentService.generateAssessmentReport(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('comparison/:userId')
  async getComparison(
    @Param('userId') _userId: string,
    @Request() req: Request & { user: { userId: string } },
  ) {
    return this.assessmentService.getComparisonData(req.user.userId);
  }
}
