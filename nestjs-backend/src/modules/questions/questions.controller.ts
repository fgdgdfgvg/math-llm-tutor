import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { Public } from '../../core/auth/guards/global-auth.guard';
import { QuestionsService } from './questions.service';
import { Question } from './schemas/question.schema';
import { Mistake } from './schemas/mistake.schema';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

class CreateMistakeDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsString()
  @IsNotEmpty()
  questionContent: string;

  @IsString()
  userAnswer: string;

  @IsString()
  @IsNotEmpty()
  correctAnswer: string;

  @IsArray()
  @IsString({ each: true })
  solutionSteps: string[];

  @IsString()
  @IsNotEmpty()
  knowledgePoint: string;

  @IsArray()
  @IsString({ each: true })
  subConcepts: string[];

  @IsString()
  @IsNotEmpty()
  difficulty: string;

  /**
   * 兼容旧版前端：历史上会把 userId 放在 body 里传来。
   * 这里显式声明并忽略，避免因全局 forbidNonWhitelisted 校验直接把请求 400 掉，
   * 造成「答错了但错题本没记录」这种静默失败。身份始终以 JWT 为准。
   */
  @IsOptional()
  @IsString()
  userId?: string;
}

@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  /**
   * 随机题目。知识点参数支持多种写法（前端不同页面历史上分别使用过
   * knowledgePointId / knowledgePoint / conceptId），全部接受并依次解析，
   * 否则参数被忽略就会退化成“全库随机”，表现为任何知识点都出同一批题。
   */
  @Public()
  @Get('random')
  async getRandomQuestion(
    @Query('knowledgePointId') knowledgePointId?: string,
    @Query('knowledgePoint') knowledgePoint?: string,
    @Query('conceptId') conceptId?: string,
    @Query('conceptName') conceptName?: string,
  ): Promise<Question> {
    return this.questionsService.getRandomQuestionByKnowledgePoint([
      knowledgePointId,
      conceptId,
      knowledgePoint,
      conceptName,
    ]);
  }

  @Public()
  @Get('by-concept/:conceptId')
  async getQuestionsByConcept(
    @Param('conceptId') conceptId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ): Promise<{ questions: Question[]; total: number }> {
    return this.questionsService.getQuestionsByConcept(conceptId, page, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mistakes/by-concept')
  async getMistakesByConcept(
    @Request() req,
    @Query('conceptId') conceptId: string,
  ): Promise<Mistake[]> {
    const userId = req.user.username;
    return this.questionsService.getMistakesByConcept(userId, conceptId);
  }

  @Public()
  @Get('knowledge-points')
  async getAllKnowledgePoints(): Promise<string[]> {
    return this.questionsService.getAllKnowledgePoints();
  }

  @Public()
  @Get('stats')
  async getQuestionStats(): Promise<{
    total: number;
    byKnowledgePoint: Record<string, number>;
    byDifficulty: Record<string, number>;
  }> {
    return this.questionsService.getQuestionStats();
  }

  @Public()
  @Get()
  async getQuestions(
    @Query('knowledgePoint') knowledgePoint?: string,
    @Query('difficulty') difficulty?: string,
    @Query('type') type?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ): Promise<{ questions: Question[]; total: number }> {
    return this.questionsService.getQuestions({
      knowledgePoint,
      difficulty,
      type,
      page,
      limit,
    });
  }

  @Public()
  @Get('similar')
  async getSimilarQuestions(
    @Query('category') category: string,
    @Query('limit') limit: number = 3,
  ): Promise<Question[]> {
    return this.questionsService.getSimilarQuestions(category, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mistakes/by-category')
  async getMistakesByCategory(
    @Request() req,
    @Query('category') category?: string,
  ): Promise<Mistake[]> {
    // 错题是用户私有数据，始终使用 JWT 身份，忽略客户端传入的 userId。
    return this.questionsService.getMistakesByCategory(
      req.user.username,
      category,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('mistakes')
  @HttpCode(HttpStatus.CREATED)
  async createMistake(
    @Request() req,
    @Body() mistakeData: CreateMistakeDto,
  ): Promise<Mistake> {
    const userId = req.user.username;
    return this.questionsService.createMistake({
      ...mistakeData,
      userId,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('mistakes/:id/review')
  async markMistakeAsReviewed(
    @Request() req,
    @Param('id') id: string,
  ): Promise<Mistake> {
    const userId = req.user.username;
    return this.questionsService.markMistakeAsReviewed(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mistakes/:id/notes')
  async updateMistakeNotes(
    @Request() req,
    @Param('id') id: string,
    @Body('notes') notes: string,
  ): Promise<Mistake> {
    const userId = req.user.username;
    return this.questionsService.updateMistakeNotes(id, notes, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('practice/special')
  async getSpecialPracticeQuestions(
    @Query('knowledgePointId') knowledgePointId: string,
    @Query('difficulty') difficulty?: string,
    @Query('limit') limit: number = 10,
  ): Promise<Question[]> {
    return this.questionsService.getSpecialPracticeQuestions(
      knowledgePointId,
      difficulty,
      limit,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('mistakes')
  async getUserMistakes(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ): Promise<{ mistakes: Mistake[]; total: number }> {
    const userId = req.user.username;
    return this.questionsService.getUserMistakes(userId, page, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mistakes/by-knowledge-point')
  async getMistakesByKnowledgePoint(
    @Request() req,
  ): Promise<Record<string, Mistake[]>> {
    const userId = req.user.username;
    return this.questionsService.getMistakesByKnowledgePoint(userId);
  }

  /**
   * 通配路由必须放在所有字面量路由之后，否则 /questions/mistakes
   * 会被当成 id 为 "mistakes" 的题目查询（导致 500）。
   */
  @Public()
  @Get(':id')
  async getQuestionById(@Param('id') id: string): Promise<Question> {
    return this.questionsService.getQuestionById(id);
  }
}
