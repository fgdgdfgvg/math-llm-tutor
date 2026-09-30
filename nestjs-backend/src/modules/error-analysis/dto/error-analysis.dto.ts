import { IsString, IsNotEmpty, IsArray, IsObject, IsOptional, IsEnum } from 'class-validator';

export class AnalyzeErrorDto {
  @IsString()
  @IsNotEmpty()
  userAnswer: string;

  @IsString()
  @IsNotEmpty()
  correctAnswer: string;
}

export class AnalyzeMultiStepSolutionDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  steps: string[];
}

export class AddErrorPatternDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description: string;

  @IsString()
  @IsNotEmpty()
  pattern: string;

  @IsEnum(['conceptual', 'computational', 'logical', 'format'])
  @IsNotEmpty()
  category: 'conceptual' | 'computational' | 'logical' | 'format';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  relatedConcepts: string[];

  @IsEnum(['low', 'medium', 'high'])
  @IsNotEmpty()
  severity: 'low' | 'medium' | 'high';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tips: string[];
}

export class UpdateErrorPatternDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  pattern?: string;

  @IsEnum(['conceptual', 'computational', 'logical', 'format'])
  @IsOptional()
  category?: 'conceptual' | 'computational' | 'logical' | 'format';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  relatedConcepts?: string[];

  @IsEnum(['low', 'medium', 'high'])
  @IsOptional()
  severity?: 'low' | 'medium' | 'high';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tips?: string[];
}
