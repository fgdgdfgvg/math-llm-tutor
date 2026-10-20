import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ScenarioService } from './scenario.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import {
  CompleteGameLevelDto,
  CreateCollaborativeSessionDto,
  JoinCollaborativeSessionDto,
  SubmitTaskDto,
} from './dto/scenario.dto';

@Controller('scenario')
export class ScenarioController {
  constructor(private readonly scenarioService: ScenarioService) {}

  @UseGuards(JwtAuthGuard)
  @Get('all')
  async getScenarios() {
    return this.scenarioService.getScenarios();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getScenarioById(@Param('id') id: string) {
    return this.scenarioService.getScenarioById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('type/:type')
  async getScenariosByType(@Param('type') type: string) {
    return this.scenarioService.getScenariosByType(type);
  }

  @UseGuards(JwtAuthGuard)
  @Get('difficulty/:difficulty')
  async getScenariosByDifficulty(@Param('difficulty') difficulty: string) {
    return this.scenarioService.getScenariosByDifficulty(difficulty);
  }

  @UseGuards(JwtAuthGuard)
  @Get('game/levels')
  async getGameLevels() {
    return this.scenarioService.getGameLevels();
  }

  @UseGuards(JwtAuthGuard)
  @Get('game/level/:id')
  async getGameLevelById(@Param('id') id: string) {
    return this.scenarioService.getGameLevelById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('game/complete')
  async completeGameLevel(@Body() dto: CompleteGameLevelDto) {
    return this.scenarioService.completeGameLevel(
      dto.userId,
      dto.levelId,
      dto.score,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('collaborative/create')
  async createCollaborativeSession(@Body() dto: CreateCollaborativeSessionDto) {
    return this.scenarioService.createCollaborativeSession(
      dto.userId,
      dto.scenarioId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('collaborative/join')
  async joinCollaborativeSession(@Body() dto: JoinCollaborativeSessionDto) {
    return this.scenarioService.joinCollaborativeSession(
      dto.sessionId,
      dto.userId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('task/submit')
  async submitTask(@Body() dto: SubmitTaskDto) {
    return this.scenarioService.submitTask(
      dto.userId,
      dto.scenarioId,
      dto.taskId,
      dto.answer,
    );
  }
}
