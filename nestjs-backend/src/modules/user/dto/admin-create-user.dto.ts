import { ArrayUnique, IsArray, IsIn, IsOptional } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

/** 管理员可分配的角色白名单（与 UserService 内的过滤保持一致） */
export const ASSIGNABLE_ROLES = ['student', 'teacher', 'admin'] as const;

/**
 * 管理员创建用户请求体。
 *
 * 只有这一个 DTO 允许 `roles` 字段：全局 ValidationPipe 的 whitelist /
 * forbidNonWhitelisted 会拒绝其它入口传入的角色，公开注册因此无法提权。
 */
export class AdminCreateUserDto extends CreateUserDto {
  @IsOptional()
  @IsArray({ message: 'roles 必须是数组' })
  @ArrayUnique({ message: 'roles 不能重复' })
  @IsIn(ASSIGNABLE_ROLES as unknown as string[], {
    each: true,
    message: `roles 只能取 ${ASSIGNABLE_ROLES.join(' / ')}`,
  })
  roles?: string[];
}
