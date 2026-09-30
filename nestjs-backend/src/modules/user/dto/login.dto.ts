import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * 登录请求体。
 *
 * 必须是一个 class（而不是内联类型字面量）：内联类型在编译后没有元数据，
 * 全局 ValidationPipe 会**跳过校验**，于是 `{}` 或 `{"username": null}` 能直达
 * 数据层，在 Mongoose 里 `{ username: undefined }` 会被忽略条件、返回第一个用户。
 */
export class LoginDto {
  @IsString({ message: '用户名必须是字符串' })
  @IsNotEmpty({ message: '用户名不能为空' })
  @MaxLength(64, { message: '用户名过长' })
  username: string;

  @IsString({ message: '密码必须是字符串' })
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(6, { message: '密码长度至少 6 位' })
  @MaxLength(128, { message: '密码过长' })
  password: string;
}
