import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * 注册/创建用户请求体。
 * 注意：**不含 roles 字段**。全局 ValidationPipe 开启了 forbidNonWhitelisted，
 * 因此客户端传 `roles: ['admin']` 会直接 400，而不是悄悄提升权限。
 */
export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: '用户名长度至少 3 位' })
  @MaxLength(32, { message: '用户名过长' })
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(128, { message: '密码过长' })
  password: string;

  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  email?: string;
}
