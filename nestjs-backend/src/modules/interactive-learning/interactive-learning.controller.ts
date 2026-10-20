import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UseFilters,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { DynamicKnowledgeGraphService } from './services/dynamic-knowledge-graph.service';
import {
  ScenarioConfigService,
  BrokenConfigInfo,
} from './services/scenario-config.service';
import {
  DynamicGraphQueryDto,
  InteractionRecordDto,
  ScenarioValidationDto,
  CognitiveStateResponseDto,
  DynamicGraphNodeDto,
  ScenarioSummaryDto,
  ApiErrorResponse,
} from './dto/interactive-learning.dto';
import { GlobalInteractiveLearningExceptionFilter } from './filters/global-exception.filter';

@Controller('interactive-learning')
@UseGuards(JwtAuthGuard)
@UseFilters(GlobalInteractiveLearningExceptionFilter)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }),
)
export class InteractiveLearningController {
  constructor(
    private readonly dynamicGraphService: DynamicKnowledgeGraphService,
    private readonly scenarioConfigService: ScenarioConfigService,
  ) {}

  @Get('graph/dynamic')
  async getDynamicKnowledgeGraph(
    @Request() req: Request & { user: { userId: string } },
    @Query() query?: DynamicGraphQueryDto,
  ): Promise<{
    nodes: DynamicGraphNodeDto[];
    relations: any[];
    filtered: boolean;
    totalNodes: number;
    statistics: any;
  }> {
    const scenarioContext = query
      ? {
          id: query.id || 'default',
          knowledgeArea: (query.knowledgeArea as any) || 'limits',
          userLevel: query.userLevel || 0.5,
          taskUrgency: false,
          currentPhase: query.currentPhase || 'concept',
          difficulty: (query.difficulty as any) || 'medium',
        }
      : undefined;

    const graphResult = await this.dynamicGraphService.getDynamicGraph(
      req.user.userId,
      scenarioContext as any,
    );

    return {
      nodes: graphResult.nodes.map(DynamicGraphNodeDto.fromDomain),
      relations: graphResult.relations,
      filtered: graphResult.filtered,
      totalNodes: graphResult.totalNodes,
      statistics: this.dynamicGraphService.getGraphStatistics(),
    };
  }

  @Get('cognitive-state')
  async getCognitiveState(
    @Request() req: Request & { user: { userId: string } },
  ): Promise<CognitiveStateResponseDto> {
    const cognitiveState =
      await this.dynamicGraphService.getCognitiveStateWithCircuitBreaker(
        req.user.userId,
      );

    return CognitiveStateResponseDto.fromDomain({
      userId: cognitiveState.userId,
      timestamp: cognitiveState.timestamp,
      dimensions: cognitiveState.dimensions,
      metrics: cognitiveState.metrics,
      predictions: cognitiveState.predictions,
    });
  }

  @Post('interaction')
  @HttpCode(HttpStatus.OK)
  async recordInteraction(
    @Request() req: Request & { user: { userId: string } },
    @Body() interactionDto: InteractionRecordDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.dynamicGraphService.recordInteraction(
      req.user.userId,
      interactionDto.nodeId,
      interactionDto.interactionType as any,
      interactionDto.scenarioId,
    );

    return {
      success: true,
      message: 'Interaction recorded successfully',
    };
  }

  @Get('scenarios')
  async getAllScenarios(): Promise<ScenarioSummaryDto[]> {
    const scenarios = await this.scenarioConfigService.getAllScenarios();
    return scenarios.map(ScenarioSummaryDto.fromConfig);
  }

  @Get('scenarios/by-area/:area')
  async getScenariosByArea(
    @Param('area') area: string,
  ): Promise<ScenarioSummaryDto[]> {
    const scenarios =
      await this.scenarioConfigService.getScenariosByKnowledgeArea(area);
    return scenarios.map(ScenarioSummaryDto.fromConfig);
  }

  @Get('scenarios/:id')
  async getScenario(@Param('id') id: string): Promise<any> {
    const scenario = await this.scenarioConfigService.getScenario(id);

    if (!scenario) {
      throw new NotFoundException(`Scenario not found: ${id}`);
    }

    return ScenarioSummaryDto.fromConfig(scenario);
  }

  @Post('scenarios/validate')
  async validateScenario(
    @Body() validationDto: ScenarioValidationDto,
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    let config: unknown;

    try {
      if (validationDto.format === 'json') {
        config = JSON.parse(validationDto.yamlContent);
      } else {
        const yaml = require('js-yaml');
        config = yaml.load(validationDto.yamlContent);
      }
    } catch (error: any) {
      return {
        isValid: false,
        errors: [`Parse error: ${error.message}`],
        warnings: [],
      };
    }

    return this.scenarioConfigService.validateScenarioConfig(config);
  }

  @Post('scenarios/create-from-yaml')
  @HttpCode(HttpStatus.CREATED)
  async createScenarioFromYaml(@Body() body: { yamlContent: string }): Promise<{
    success: boolean;
    scenarioId: string;
    message: string;
  }> {
    try {
      const scenario = await this.scenarioConfigService.createScenarioFromYaml(
        body.yamlContent,
      );

      return {
        success: true,
        scenarioId: scenario.id,
        message: 'Scenario created successfully',
      };
    } catch (error: any) {
      throw new BadRequestException(
        `Failed to create scenario: ${error.message}`,
      );
    }
  }

  @Post('cache/invalidate')
  @HttpCode(HttpStatus.OK)
  async invalidateCache(
    @Request() req: Request & { user: { userId: string } },
    @Body('userId') userId?: string,
  ): Promise<{ message: string; timestamp: Date }> {
    await this.dynamicGraphService.invalidateCache(userId || req.user.userId);

    return {
      message: 'Cache invalidated successfully',
      timestamp: new Date(),
    };
  }

  @Get('statistics/graph')
  getGraphStatistics(): any {
    return this.dynamicGraphService.getGraphStatistics();
  }

  @Get('statistics/scenarios')
  getScenarioStatistics(): any {
    return this.scenarioConfigService.getCacheStatistics();
  }

  @Get('broken-configs')
  getBrokenConfigs(): BrokenConfigInfo[] {
    return this.scenarioConfigService.getBrokenConfigs();
  }

  @Get('broken-configs/:id')
  getBrokenConfig(
    @Param('id') id: string,
  ): BrokenConfigInfo | { message: string } {
    const brokenConfig = this.scenarioConfigService.getBrokenConfig(id);

    if (!brokenConfig) {
      return { message: 'No broken config found for this scenario ID' };
    }

    return brokenConfig;
  }

  @Post('broken-configs/retry/:id')
  @HttpCode(HttpStatus.OK)
  async retryLoadBrokenConfig(@Param('id') id: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      await this.scenarioConfigService.reloadScenario(id);

      const isStillBroken = !!this.scenarioConfigService.getBrokenConfig(id);

      if (isStillBroken) {
        const brokenInfo = this.scenarioConfigService.getBrokenConfig(id)!;
        return {
          success: false,
          message: `Failed to reload: ${brokenInfo.error}`,
        };
      }

      return {
        success: true,
        message: 'Scenario reloaded successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error during reload: ${error.message}`,
      };
    }
  }
}
