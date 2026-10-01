import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../../modules/user/user.service';
import { TokenService, TokenPair } from './token.service';

interface UserPayload {
  _id?: string;
  id?: string;
  username: string;
  roles?: string[];
}

export interface LoginResult extends TokenPair {
  user: { id: string; username: string; roles?: string[] };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly tokenService: TokenService,
  ) {}

  async validateUser(username: string, pass: string): Promise<UserPayload | null> {
    return this.userService.validateUser(username, pass);
  }

  /**
   * 登录：签出短时效 access + 可吊销 refresh。
   * 返回体保持 `access_token` / `user` 字段不变（前端现有解析依赖这两个字段），
   * 只**新增** refresh_token 等字段，避免破坏已有调用方。
   */
  async login(user: UserPayload): Promise<LoginResult> {
    const userId = String(user._id ?? user.id ?? '');
    const pair = await this.tokenService.issuePair({
      _id: userId,
      username: user.username,
      roles: user.roles,
    });
    return {
      ...pair,
      user: {
        id: userId,
        username: user.username,
        roles: user.roles,
      },
    };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    return this.tokenService.rotate(refreshToken);
  }

  /** 登出：吊销该 refresh token 所在的整个令牌族 */
  async logout(refreshToken?: string): Promise<boolean> {
    if (!refreshToken) return false;
    await this.tokenService.revoke(refreshToken);
    return true;
  }

  /** 登出所有设备 */
  async logoutAll(userId: string): Promise<number> {
    return this.tokenService.revokeAllForUser(userId);
  }
}
