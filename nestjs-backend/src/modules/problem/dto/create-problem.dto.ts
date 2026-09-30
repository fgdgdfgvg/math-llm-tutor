import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateProblemDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  difficulty: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsNotEmpty()
  answer: string;

  @IsString()
  @IsOptional()
  solution?: string;
}
