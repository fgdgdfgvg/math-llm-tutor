import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function ctxWith(
  user: any,
  roles?: string[],
): { ctx: ExecutionContext; reflector: Reflector } {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles as any);
  const ctx = {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { ctx, reflector };
}

describe('RolesGuard（自检 P0 回归）', () => {
  it('无 @Roles 元数据时放行', () => {
    const { ctx, reflector } = ctxWith(null, undefined);
    expect(new RolesGuard(reflector).canActivate(ctx)).toBe(true);
  });

  it('student 访问 admin 接口被拒绝（对应 /user/list 越权实证）', () => {
    const { ctx, reflector } = ctxWith({ userId: 'u1', roles: ['student'] }, [
      'admin',
    ]);
    expect(new RolesGuard(reflector).canActivate(ctx)).toBe(false);
  });

  it('admin 访问 admin 接口放行', () => {
    const { ctx, reflector } = ctxWith({ userId: 'u1', roles: ['admin'] }, [
      'admin',
    ]);
    expect(new RolesGuard(reflector).canActivate(ctx)).toBe(true);
  });

  it('teacher 访问 admin,teacher 接口放行（problem 模块场景）', () => {
    const { ctx, reflector } = ctxWith({ userId: 'u1', roles: ['teacher'] }, [
      'admin',
      'teacher',
    ]);
    expect(new RolesGuard(reflector).canActivate(ctx)).toBe(true);
  });

  it('req.user 缺失或 roles 缺失时拒绝（宁可 403，不默认放行）', () => {
    const { ctx, reflector } = ctxWith(undefined, ['admin']);
    expect(new RolesGuard(reflector).canActivate(ctx)).toBe(false);
    const { ctx: ctx2, reflector: reflector2 } = ctxWith({ userId: 'u1' }, [
      'admin',
    ]);
    expect(
      new RolesGuard(reflectoror(reflector2, ctx2)).canActivate(ctx2),
    ).toBe(false);
  });
});

// 保持测试可读性的小工具（避免上面被长行干扰）
function reflectoror(r: Reflector, _ctx: ExecutionContext): Reflector {
  return r;
}
