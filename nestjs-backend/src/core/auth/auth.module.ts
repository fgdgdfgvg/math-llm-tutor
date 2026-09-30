import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserModule } from '../../modules/user/user.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    forwardRef(() => UserModule),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET')!,
        signOptions: {
          // 与 .env 的 JWT_EXPIRATION 保持一致（默认 7d），
          // 否则前端会在 1 小时后无声掉线（token 过期 → 所有接口 401/403）
          expiresIn: (configService.get<string>('JWT_EXPIRATION') || '7d') as any,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
