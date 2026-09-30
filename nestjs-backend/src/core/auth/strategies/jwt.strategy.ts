import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  sub: string;
  username: string;
  iat?: number;
  exp?: number;
}

interface ValidatedUser {
  userId: string;
  username: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  validate(payload: JwtPayload): ValidatedUser {
    this.logger.log(`JWT payload validated: ${JSON.stringify(payload)}`);
    return { userId: payload.sub, username: payload.username };
  }
}
