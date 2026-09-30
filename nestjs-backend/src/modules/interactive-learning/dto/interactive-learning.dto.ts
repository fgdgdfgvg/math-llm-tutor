import { IsOptional, IsString, IsIn, IsNumber, Min, Max, IsEnum, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { KnowledgeAreaEnum, DifficultyEnum } from '../types/interactive-learning.schemas';

export class DynamicGraphQueryDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsEnum(KnowledgeAreaEnum.enum)
  knowledgeArea?: string;

  @IsOptional()
  @IsIn(['easy', 'medium', 'hard'])
  difficulty?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  userLevel?: number;

  @IsOptional()
  @IsString()
  currentPhase?: string;
}

export class InteractionRecordDto {
  @IsString()
  nodeId: string;

  @IsEnum(['view', 'practice', 'master', 'review'])
  interactionType: string;

  @IsOptional()
  @IsString()
  scenarioId?: string;

  @IsOptional()
  @IsNumber()
  timeSpent?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class ScenarioValidationDto {
  @IsString()
  yamlContent: string;

  @IsOptional()
  @IsString()
  format?: 'yaml' | 'json';
}

export class CognitiveStateResponseDto {
  userId: string;

  timestamp: Date;

  dimensions: {
    conceptualUnderstanding: number;
    proceduralFluency: number;
    strategicCompetence: number;
    adaptiveReasoning: number;
  };

  metrics: {
    cognitiveLoad: number;
    learningVelocity: number;
    errorPattern: string[];
    attentionLevel: number;
    frustrationLevel: number;
  };

  predictions: {
    masteryPrediction: number[];
    optimalDifficulty: number;
    recommendedIntervention: string[];
  };

  confidence: number;

  lastUpdated: Date;

  static fromDomain(state: {
    userId: string;
    timestamp: Date;
    dimensions: any;
    metrics: any;
    predictions: any;
    confidence?: number;
  }): CognitiveStateResponseDto {
    return {
      userId: state.userId,
      timestamp: state.timestamp,
      dimensions: state.dimensions,
      metrics: state.metrics,
      predictions: {
        ...state.predictions,
        recommendedIntervention: state.predictions.recommendedIntervention.map((i: any) =>
          typeof i === 'string' ? i : String(i),
        ),
      },
      confidence: state.confidence ?? 0.7,
      lastUpdated: state.timestamp ?? new Date(),
    };
  }
}

export class DynamicGraphNodeDto {
  id: string;

  name: string;

  type: string;

  dynamicWeight: number;

  relevanceScore: number;

  activationLevel: number;

  masteryLevel: number;

  tags: string[];

  static fromDomain(node: any): DynamicGraphNodeDto {
    return {
      id: node.id,
      name: node.name,
      type: node.type ?? 'concept',
      dynamicWeight: node.dynamicWeight ?? 0,
      relevanceScore: node.relevanceScore ?? 0,
      activationLevel: node.activationLevel ?? 0,
      masteryLevel: node.masteryLevel ?? 0,
      tags: node.tags ?? [],
    };
  }
}

export class ScenarioSummaryDto {
  id: string;

  name: string;

  description: string;

  knowledgeArea: string;

  difficulty: string;

  estimatedDuration: number;

  version: string;

  phaseCount: number;

  taskCount: number;

  isValid: boolean;

  validationErrors: string[];

  static fromConfig(config: any): ScenarioSummaryDto {
    const phases = config.learningPath ?? config.learning_path ?? [];
    const taskCount = phases.reduce((sum: number, phase: any) => sum + (phase.tasks?.length ?? 0), 0);

    return {
      id: config.id ?? config.scenario?.id,
      name: config.name ?? config.scenario?.name,
      description: config.description ?? config.scenario?.description ?? '',
      knowledgeArea: config.knowledgeArea ?? config.scenario?.knowledge_area,
      difficulty: config.difficulty ?? config.scenario?.difficulty,
      estimatedDuration: config.estimatedDuration ?? config.scenario?.estimated_duration,
      version: config.version ?? config.scenario?.version,
      phaseCount: phases.length,
      taskCount,
      isValid: true,
      validationErrors: [],
    };
  }
}

export class ApiErrorResponse {
  statusCode: number;

  error: string;

  message: string;

  timestamp: Date;

  path: string;

  details?: any;

  constructor(statusCode: number, error: string, message: string, path: string, details?: any) {
    this.statusCode = statusCode;
    this.error = error;
    this.message = message;
    this.timestamp = new Date();
    this.path = path;
    this.details = details;
  }
}
