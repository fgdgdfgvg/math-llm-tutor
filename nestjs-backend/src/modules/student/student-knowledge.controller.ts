import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class RecordPracticeDto {
  @IsString()
  @IsNotEmpty()
  conceptId: string;

  @IsBoolean()
  isCorrect: boolean;

  @IsString()
  @IsNotEmpty()
  problemId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(86400)
  timeSpent: number;
}
import { StudentKnowledgeService } from './student-knowledge.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';

@Controller('student/knowledge')
@UseGuards(JwtAuthGuard)
export class StudentKnowledgeController {
  constructor(
    private readonly studentKnowledgeService: StudentKnowledgeService,
  ) {}

  @Get('summary')
  async getSummary(@Request() req: any) {
    return this.studentKnowledgeService.getStudentSummary(req.user.userId);
  }

  @Get('progress')
  async getProgress(@Request() req: any) {
    return this.studentKnowledgeService.getLearningProgress(req.user.userId);
  }

  @Get('review')
  async getReviewList(@Request() req: any) {
    return this.studentKnowledgeService.getConceptsNeedingReview(
      req.user.userId,
    );
  }

  @Get('concept/:conceptId')
  async getConceptKnowledge(
    @Request() req: any,
    @Param('conceptId') conceptId: string,
  ) {
    return this.studentKnowledgeService.getStudentKnowledge(
      req.user.userId,
      conceptId,
    );
  }

  @Post('practice')
  async recordPractice(@Request() req: any, @Body() body: RecordPracticeDto) {
    return this.studentKnowledgeService.recordPractice(
      req.user.userId,
      body.conceptId,
      body.isCorrect,
      body.problemId,
      body.timeSpent,
    );
  }

  @Post('initialize')
  async initializeKnowledge(@Request() req: any) {
    await this.studentKnowledgeService.initializeStudentKnowledge(
      req.user.userId,
    );
    return { success: true, message: 'Knowledge tracking initialized' };
  }

  @Get('all')
  async getAllKnowledge(@Request() req: any) {
    return this.studentKnowledgeService.getAllStudentKnowledge(req.user.userId);
  }
}
