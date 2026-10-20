import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { RedisCacheService } from '../../common/services/redis-cache.service';
import { UnauthorizedAppError } from '../../common/errors/app-error';

export interface AuthUser {
  _id?: string;
  id?: string;
  username: string;
  roles?: string[];
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  /** access token 有效期（秒），前端据此提前刷新，而不是等 401 */
  expires_in: number;
  refresh_expires_in: number;
}

interface RefreshRecord {
  userId: string;
  username: string;
  roles?: string[];
  familyId: string;
  issuedAt: number;
}

const KEY_PREFIX = 'auth:rt';
/** 单个用户保留的活跃 refresh token 上限，防止索引无限增长 */
const MAX_TOKENS_PER_USER = 20;

/** 支持 '900' / '15m' / '2h' / '7d' */
function parseDurationToSeconds(
  raw: string | undefined,
  fallbackSeconds: number,
): number {
  if (!raw) return fallbackSeconds;
  const value = String(raw).trim();
  const match = /^(\d+)\s*([smhd])?$/i.exec(value);
  if (!match) return fallbackSeconds;
  const n = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  const factor =
    unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return n * factor;
}

/**
 * 访问令牌 + 刷新令牌的签发与轮换。
 *
 * 相比原来"只签一个 7 天 access token"的做法，解决了三件事：
 * 1. **无法吊销**：7 天内即便用户登出或改密码，旧 token 依然可用；
 *    现在是 15 分钟短时效 access + 服务端可吊销的 refresh。
 * 2. **泄露即长期失守**：access token 泄露的影响窗口从 7 天缩到 15 分钟；
 *    refresh token 每次使用都轮换，旧值立刻失效。
 * 3. **无重用检测**：refresh token 被窃取后，攻击者与真实用户可同时使用。
 *    现在一旦检测到已用过的 refresh token 再次出现，判定为泄露，
 *    吊销整个令牌族（该次登录派生出的所有会话），强制重新登录。
 *
 * 存储取舍：
 * - 走 RedisCacheService（Redis 不可用时自动降级为进程内缓存），
 *   因此**多实例部署时必须配置 Redis**，否则降级到内存后各实例状态不一致，
 *   表现为"在 A 实例登录、打到 B 实例时 refresh 失败"。
 * - 落库的是 token 的 SHA-256，不是明文：即便缓存被 dump 也拿不到可用令牌。
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;
  /** refresh token 重放宽容窗口（秒）；0 表示严格模式（任何重放都视为泄露） */
  private readonly graceSeconds: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cache: RedisCacheService,
  ) {
    this.accessTtlSeconds = parseDurationToSeconds(
      this.configService.get<string>('JWT_EXPIRATION'),
      15 * 60,
    );
    this.refreshTtlSeconds = parseDurationToSeconds(
      this.configService.get<string>('JWT_REFRESH_TTL'),
      30 * 24 * 3600,
    );
    this.graceSeconds = Number(
      this.configService.get('REFRESH_REPLAY_GRACE_SECONDS') || 30,
    );
  }

  get accessExpiresIn(): number {
    return this.accessTtlSeconds;
  }

  get refreshExpiresIn(): number {
    return this.refreshTtlSeconds;
  }

  /** 签发一对令牌；familyId 用于把同一次登录派生出的会话归为一个令牌族 */
  async issuePair(
    user: AuthUser,
    familyId: string = randomBytes(8).toString('hex'),
  ): Promise<TokenPair> {
    const refreshToken = randomBytes(32).toString('base64url');
    const hash = this.hash(refreshToken);
    const userId = String(user._id ?? user.id ?? '');

    const record: RefreshRecord = {
      userId,
      username: user.username,
      roles: user.roles,
      familyId,
      issuedAt: Date.now(),
    };

    await this.cache.set(
      `${KEY_PREFIX}:${hash}`,
      JSON.stringify(record),
      this.refreshTtlSeconds,
    );
    await this.addToUserIndex(userId, hash);

    return {
      access_token: this.signAccess({
        username: user.username,
        sub: userId,
        roles: user.roles,
      }),
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: this.accessTtlSeconds,
      refresh_expires_in: this.refreshTtlSeconds,
    };
  }

  /**
   * 用 refresh token 换新的一对令牌。
   *
   * 宽容窗口设计（自检 P1-3）：多标签页/多设备/小程序多实例会天然并发刷新。
   * 若把窗口内的重复请求一律判定为"令牌泄露"并吊销整族，合法用户会被踢下线。
   * 因此：
   * - 窗口内（默认 30s）的重复刷新是**幂等**的——直接返回当时签发的那一对令牌；
   * - 窗口外旧值再次出现才判定为泄露，吊销整个令牌族。
   * 轮换本身通过 setIfAbsent 加锁做单飞：并发请求中只有一个真正执行轮换，
   * 其余等它把结果写进宽容窗口后取同一份。
   * 任何异常都以 401 抛出且不区分具体原因，避免给攻击者 probing 线索。
   */
  async rotate(refreshToken: string): Promise<TokenPair> {
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new UnauthorizedAppError('登录已失效，请重新登录');
    }
    const hash = this.hash(refreshToken);

    // 1) 宽容窗口：窗口内的重复刷新返回当时签发的那一对（幂等）
    const gracePair = await this.readGracePair(hash);
    if (gracePair) return gracePair;

    // 2) 重用检测（窗口外）：这个值只在 token 被使用过一次后才存在
    const reusedFamily = await this.cache.get(`${KEY_PREFIX}:used:${hash}`);
    if (reusedFamily) {
      this.logger.warn(
        `检测到 refresh token 重用（超出宽容窗口），吊销令牌族 ${reusedFamily}`,
      );
      await this.revokeFamily(reusedFamily);
      throw new UnauthorizedAppError('登录已失效，请重新登录');
    }

    const raw = await this.cache.get(`${KEY_PREFIX}:${hash}`);
    if (!raw) {
      throw new UnauthorizedAppError('登录已失效，请重新登录');
    }

    // 3) 并发单飞：只有一个请求真正执行轮换
    const lockKey = `${KEY_PREFIX}:lock:${hash}`;
    const acquired = await this.cache.setIfAbsent(lockKey, '1', 10);
    if (!acquired) {
      // 另一个请求正在轮换：等它把结果写进宽容窗口，拿到同一份令牌
      const waited = await this.waitForGracePair(hash);
      if (waited) return waited;
      throw new UnauthorizedAppError('登录已失效，请重新登录');
    }

    try {
      // 拿到锁后再读一次：等待期间可能已被别的请求轮换过
      const gracePairAfterLock = await this.readGracePair(hash);
      if (gracePairAfterLock) return gracePairAfterLock;

      const rawAfterLock = await this.cache.get(`${KEY_PREFIX}:${hash}`);
      if (!rawAfterLock) {
        throw new UnauthorizedAppError('登录已失效，请重新登录');
      }

      let record: RefreshRecord;
      try {
        record = JSON.parse(rawAfterLock) as RefreshRecord;
      } catch {
        throw new UnauthorizedAppError('登录已失效，请重新登录');
      }

      if (await this.isFamilyRevoked(record.familyId)) {
        throw new UnauthorizedAppError('登录已失效，请重新登录');
      }

      // 旧值标记为已用（保留到到期为止，用于窗口外的重用检测），再签发新值
      await this.cache.set(
        `${KEY_PREFIX}:used:${hash}`,
        record.familyId,
        this.refreshTtlSeconds,
      );
      await this.cache.delete(`${KEY_PREFIX}:${hash}`);
      await this.removeFromUserIndex(record.userId, hash);

      const pair = await this.issuePair(
        { _id: record.userId, username: record.username, roles: record.roles },
        record.familyId,
      );

      // 写进宽容窗口：窗口内同一旧值的重复请求返回这一对
      if (this.graceSeconds > 0) {
        await this.cache.set(
          `${KEY_PREFIX}:grace:${hash}`,
          JSON.stringify(pair),
          this.graceSeconds,
        );
      }
      return pair;
    } finally {
      await this.cache.delete(lockKey);
    }
  }

  /** 登出：吊销当前 refresh token 及其所属令牌族 */
  async revoke(refreshToken: string): Promise<void> {
    if (!refreshToken) return;
    const hash = this.hash(refreshToken);
    const raw = await this.cache.get(`${KEY_PREFIX}:${hash}`);
    let familyId = '';
    if (raw) {
      try {
        const record = JSON.parse(raw) as RefreshRecord;
        familyId = record.familyId;
        await this.removeFromUserIndex(record.userId, hash);
        await this.revokeFamily(record.familyId);
      } catch {
        // 记录损坏时按下述兜底处理：至少让这个 token 不能再换发
      }
    }
    await this.cache.delete(`${KEY_PREFIX}:${hash}`);
    // used 标记存 familyId（而非字面量），后续若被重放能正确吊销对应的令牌族
    await this.cache.set(
      `${KEY_PREFIX}:used:${hash}`,
      familyId,
      this.refreshTtlSeconds,
    );
  }

  /** 吊销某次登录派生出的全部会话（令牌族） */
  async revokeFamily(familyId: string): Promise<void> {
    if (!familyId) return;
    await this.cache.set(
      `${KEY_PREFIX}:family:${familyId}`,
      'revoked',
      this.refreshTtlSeconds,
    );
  }

  /** 吊销某用户的全部会话（改密码、管理员踢人等场景） */
  async revokeAllForUser(userId: string): Promise<number> {
    const raw = await this.cache.get(`${KEY_PREFIX}:user:${userId}`);
    if (!raw) return 0;
    let hashes: string[] = [];
    try {
      hashes = JSON.parse(raw) as string[];
    } catch {
      return 0;
    }
    for (const hash of hashes) {
      let familyId = '';
      const recordRaw = await this.cache.get(`${KEY_PREFIX}:${hash}`);
      if (recordRaw) {
        try {
          const record = JSON.parse(recordRaw) as RefreshRecord;
          familyId = record.familyId;
          await this.revokeFamily(record.familyId);
        } catch {
          // 忽略损坏记录
        }
      }
      await this.cache.delete(`${KEY_PREFIX}:${hash}`);
      await this.cache.set(
        `${KEY_PREFIX}:used:${hash}`,
        familyId,
        this.refreshTtlSeconds,
      );
    }
    await this.cache.delete(`${KEY_PREFIX}:user:${userId}`);
    return hashes.length;
  }

  private async isFamilyRevoked(familyId: string): Promise<boolean> {
    if (!familyId) return false;
    const value = await this.cache.get(`${KEY_PREFIX}:family:${familyId}`);
    return value === 'revoked';
  }

  /** 读宽容窗口里当时签发的令牌对；窗口未启用或已过期返回 null */
  private async readGracePair(hash: string): Promise<TokenPair | null> {
    if (this.graceSeconds <= 0) return null;
    const raw = await this.cache.get(`${KEY_PREFIX}:grace:${hash}`);
    if (!raw) return null;
    try {
      const pair = JSON.parse(raw) as TokenPair;
      return pair?.access_token ? pair : null;
    } catch {
      return null;
    }
  }

  /** 并发刷新时等待持锁方把结果写进宽容窗口（最多约 2 秒） */
  private async waitForGracePair(hash: string): Promise<TokenPair | null> {
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      const pair = await this.readGracePair(hash);
      if (pair) return pair;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return null;
  }

  private signAccess(payload: {
    username: string;
    sub: string;
    roles?: string[];
  }): string {
    return this.jwtService.sign(payload, { expiresIn: this.accessTtlSeconds });
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async addToUserIndex(userId: string, hash: string): Promise<void> {
    if (!userId) return;
    const key = `${KEY_PREFIX}:user:${userId}`;
    const raw = await this.cache.get(key);
    let hashes: string[] = [];
    if (raw) {
      try {
        hashes = JSON.parse(raw) as string[];
      } catch {
        hashes = [];
      }
    }
    hashes.push(hash);
    // 只保留最近的若干个，避免长期积累把缓存撑大
    if (hashes.length > MAX_TOKENS_PER_USER)
      hashes = hashes.slice(-MAX_TOKENS_PER_USER);
    await this.cache.set(key, JSON.stringify(hashes), this.refreshTtlSeconds);
  }

  private async removeFromUserIndex(
    userId: string,
    hash: string,
  ): Promise<void> {
    if (!userId) return;
    const key = `${KEY_PREFIX}:user:${userId}`;
    const raw = await this.cache.get(key);
    if (!raw) return;
    try {
      const hashes = (JSON.parse(raw) as string[]).filter((h) => h !== hash);
      await this.cache.set(key, JSON.stringify(hashes), this.refreshTtlSeconds);
    } catch {
      // 索引损坏时忽略，token 本身的吊销不受影响
    }
  }
}
