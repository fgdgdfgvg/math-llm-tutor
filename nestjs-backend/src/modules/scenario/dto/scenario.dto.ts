import {
  IsString,
  IsNumber,
  IsNotEmpty,
  IsObject,
  IsOptional,
} from 'class-validator';

export class CompleteGameLevelDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  levelId: string;

  @IsNumber()
  @IsNotEmpty()
  score: number;
}

export class CreateCollaborativeSessionDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  scenarioId: string;
}

export class JoinCollaborativeSessionDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class SubmitTaskDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  scenarioId: string;

  @IsString()
  @IsNotEmpty()
  taskId: string;

  @IsObject()
  @IsNotEmpty()
  answer: any; // 可根据实际需求细化
}
