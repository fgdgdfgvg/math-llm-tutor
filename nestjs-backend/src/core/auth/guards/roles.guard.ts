import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

interface UserWithRoles {
  roles?: string[];
}

/**
 * 基于 @Roles() 元数据的授权守卫（RBAC）。
 *
 * 历史缺陷（自检 P0）：本类此前从未注册（不在任何 module providers、
 * 没有 @UseGuards、也不是 APP_GUARD），导致 `@Roles('admin')` 纯装饰——
 * 实测任意 student 都能调用 `GET /user/list`、`POST /user/create`。
 * 现在作为全局守卫注册在 GlobalAuthGuard 之后（见 app.module.ts）。
 *
 * 注意：
 * - 无 @Roles 的接口一律放行，鉴权与否仍由 GlobalAuthGuard / JwtAuthGuard 决定；
 * - 有 @Roles 时取不到 roles 一律拒绝（宁可 403，不可默认放行）。
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user as UserWithRoles | undefined;
    const roles = user?.roles;
    if (!Array.isArray(roles)) {
      return false;
    }
    return requiredRoles.some((role) => roles.includes(role));
  }
}
