import { IsOptional, IsString } from 'class-validator';

/** 刷新令牌请求体 */
export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

/** 登出请求体：refreshToken 可省略（此时只做本地清理） */
export class LogoutDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
