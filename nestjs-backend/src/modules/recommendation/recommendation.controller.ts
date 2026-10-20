import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import {
  RecommendationService,
  RecommendationItem,
  ProblemRecommendation,
  LearningPath,
} from './recommendation.service';

@Controller('recommendation')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @UseGuards(JwtAuthGuard)
  @Get('personalized')
  async getPersonalizedRecommendations(
    @Request() req: Request & { user: { userId: string } },
  ): Promise<RecommendationItem[]> {
    return this.recommendationService.getPersonalizedRecommendations(
      req.user.userId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('problems')
  async getProblemRecommendations(
    @Request() req: Request & { user: { userId: string } },
    @Query('difficulty') difficulty?: 'easy' | 'medium' | 'hard',
    @Query('conceptId') conceptId?: string,
    @Query('limit') limit?: number,
  ): Promise<ProblemRecommendation[]> {
    return this.recommendationService.getProblemRecommendations(
      req.user.userId,
      {
        difficulty,
        conceptId,
        limit: limit ? parseInt(limit.toString()) : undefined,
      },
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('learning-path')
  async generateLearningPath(
    @Request() req: Request & { user: { userId: string } },
    @Body() body: { targetConceptId: string },
  ): Promise<LearningPath> {
    return this.recommendationService.generateLearningPath(
      req.user.userId,
      body.targetConceptId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('adjust-difficulty')
  async adjustDifficulty(
    @Request() req: Request & { user: { userId: string } },
    @Body()
    body: {
      problemId: string;
      isCorrect: boolean;
    },
  ): Promise<{ difficulty: 'easy' | 'medium' | 'hard' }> {
    const difficulty = await this.recommendationService.adjustDifficulty(
      req.user.userId,
      body.problemId,
      body.isCorrect,
    );
    return { difficulty };
  }
}
