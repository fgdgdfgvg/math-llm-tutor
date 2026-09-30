import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  Delete,
} from '@nestjs/common';
import { LearningService } from './learning.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RecordLearningDto, GetPracticeHistoryDto } from './dto/learning.dto';

@Controller('learning')
@UseGuards(JwtAuthGuard)
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @Post('record')
  async recordLearning(
    @Request() req: Request & { user: { userId: string } },
    @Body() body: RecordLearningDto,
  ) {
    return this.learningService.recordLearning(req.user.userId, body);
  }

  @Get('stats')
  async getLearningStats(@Request() req: Request & { user: { userId: string } }) {
    return this.learningService.getLearningStats(req.user.userId);
  }

  @Get('progress')
  async getConceptProgress(@Request() req: Request & { user: { userId: string } }) {
    return this.learningService.getConceptProgress(req.user.userId);
  }

  @Get('review-list')
  async getReviewList(@Request() req: Request & { user: { userId: string } }) {
    return this.learningService.getReviewList(req.user.userId);
  }

  @Get('history')
  async getPracticeHistory(
    @Request() req: Request & { user: { userId: string } },
    @Query() query: GetPracticeHistoryDto,
  ) {
    return this.learningService.getPracticeHistory(req.user.userId, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      conceptId: query.conceptId,
    });
  }

  @Delete('data')
  async deleteUserData(
    @Request() req: Request & { user: { userId: string } },
    @Body('userId') _userId: string,
  ) {
    await this.learningService.deleteUserData(req.user.userId, req.user.userId);
    return { message: 'Learning data deleted successfully' };
  }
}
