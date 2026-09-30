import { IsString, IsOptional, IsNumber, IsBoolean, Min, Max, IsEnum } from 'class-validator';

export class RecordLearningDto {
  @IsString()
  conceptId: string;

  @IsString()
  conceptName: string;

  @IsEnum(['view', 'practice', 'master', 'review'])
  action: 'view' | 'practice' | 'master' | 'review';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  masteryLevel?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  timeSpent?: number;

  @IsOptional()
  @IsBoolean()
  isCorrect?: boolean;

  @IsOptional()
  @IsString()
  problemText?: string;

  @IsOptional()
  @IsString()
  userAnswer?: string;

  @IsOptional()
  @IsString()
  correctAnswer?: string;
}

export class GetPracticeHistoryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  // 历史轨迹需要一次性拉取全部练习记录（用于按天聚合与里程碑推导），
  // 上限过低会被 400 拒绝，只能拿到不完整的趋势图。
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  conceptId?: string;
}
