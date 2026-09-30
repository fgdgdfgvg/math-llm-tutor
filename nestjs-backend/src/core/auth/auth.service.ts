import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../../modules/user/user.service';
import { JwtService } from '@nestjs/jwt';

interface UserPayload {
  _id: string;
  username: string;
  roles?: string[];
}

interface JwtPayload {
  username: string;
  sub: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(username: string, pass: string): Promise<UserPayload | null> {
    return this.userService.validateUser(username, pass);
  }

  async login(user: UserPayload): Promise<{ access_token: string; user: { id: string; username: string; roles?: string[] } }> {
    const userId = user._id?.toString() || '';
    const payload: JwtPayload = { username: user.username, sub: userId };
    const token = this.jwtService.sign(payload);
    return {
      access_token: token,
      user: {
        id: userId,
        username: user.username,
        roles: user.roles,
      },
    };
  }
}
