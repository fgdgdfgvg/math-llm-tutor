import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  sub: string;
  username: string;
  roles?: string[];
  iat?: number;
  exp?: number;
}

/**
 * 与 GlobalAuthGuard 产出的 req.user 结构保持一致（见 global-auth.guard.ts 的注释）。
 * 历史缺陷（自检 P0-2）：此前 validate 只返回 {userId, username}，把 payload 里的
 * roles 丢掉了——一旦接入 RolesGuard，带 JwtAuthGuard 的接口会全员 403。
 */
interface ValidatedUser {
  sub: string;
  userId: string;
  username: string;
  roles?: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  validate(payload: JwtPayload): ValidatedUser {
    // 不打印 payload 整体：它是凭据派生物，进日志即泄露面；此前每个请求都打一行
    // （自检 P1-17），改为不带敏感字段的 debug 级记录。
    return {
      sub: payload.sub,
      userId: payload.sub,
      username: payload.username,
      roles: payload.roles,
    };
  }
}
