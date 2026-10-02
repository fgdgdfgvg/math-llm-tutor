import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

// 装饰器：标记接口为公开（不需要认证）
export const Public = () => SetMetadata('isPublic', true);

@Injectable()
export class GlobalAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查是否标记为公开接口
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (isPublic) {
      return true;
    }

    // 获取请求对象
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      throw new UnauthorizedException('未提供认证令牌');
    }

    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new UnauthorizedException('JWT密钥未配置');
      }
      const payload = await this.jwtService.verifyAsync(token, {
        secret,
      });

      // 与 JwtStrategy.validate 的产物保持同一结构（自检 P0-2）：
      // 此前这里直接放原始 payload（无 userId），JwtAuthGuard 放 {userId, username}
      // （无 roles），下游 req.user 的形状取决于用了哪个守卫，行为不可预期。
      request.user = {
        sub: payload.sub,
        userId: payload.sub,
        username: payload.username,
        roles: payload.roles,
      };
    } catch (error) {
      throw new UnauthorizedException('无效的认证令牌');
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}