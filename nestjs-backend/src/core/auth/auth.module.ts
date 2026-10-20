import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserModule } from '../../modules/user/user.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenService } from './token.service';
import { LoginThrottleService } from './login-throttle.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    forwardRef(() => UserModule),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET')!,
        signOptions: {
          // access token 默认缩短到 15 分钟：泄露后的影响窗口从 7 天降到 15 分钟，
          // 续期由 /auth/refresh + 服务端存储的 refresh token 承担。
          // 注意：TokenService 签发时会显式传 expiresIn，这里只是兜底默认值。
          expiresIn: (configService.get<string>('JWT_EXPIRATION') ||
            '15m') as any,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    TokenService,
    LoginThrottleService,
  ],
  // 导出 TokenService / LoginThrottleService：UserModule 的登录接口需要它们
  exports: [AuthService, TokenService, LoginThrottleService],
})
export class AuthModule {}
