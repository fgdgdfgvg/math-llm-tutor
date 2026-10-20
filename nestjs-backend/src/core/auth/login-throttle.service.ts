import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisCacheService } from '../../common/services/redis-cache.service';
import { AppError } from '../../common/errors/app-error';
import { ErrorCode } from '../../common/errors/error-codes';

const KEY_PREFIX = 'auth:login';

export interface LoginThrottleStatus {
  allowed: boolean;
  /** 剩余可尝试次数（被锁定时为 0） */
  remainingAttempts: number;
  /** 还需要等待多少秒才解锁（未锁定时为 0） */
  retryAfterSeconds: number;
}

/**
 * 登录失败计数与锁定。
 *
 * 现状与问题：此前只有一个全局的 IP 维度限流（100 次/分钟），
 * 对"针对某个账号的密码爆破"几乎无效——攻击者可以在限流额度内
 * 稳定地每分钟试 100 个密码。这里补上**账号维度**与**IP 维度**的失败计数，
 * 超过阈值后锁定一段时间，并且登录成功即清零。
 *
 * 与全局限流的关系：全局限流管"总量"，这里管"同一目标连续失败"，
 * 两者互补，不重复。
 */
@Injectable()
export class LoginThrottleService {
  private readonly logger = new Logger(LoginThrottleService.name);
  private readonly maxFailures: number;
  private readonly lockSeconds: number;
  private readonly windowSeconds: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly cache: RedisCacheService,
  ) {
    this.maxFailures = Number(
      this.configService.get('LOGIN_MAX_FAILURES') || 5,
    );
    this.lockSeconds = Number(
      this.configService.get('LOGIN_LOCK_SECONDS') || 900,
    );
    this.windowSeconds = Number(
      this.configService.get('LOGIN_WINDOW_SECONDS') || 900,
    );
  }

  /** 登录前调用：不允许时直接抛 429 */
  async assertAllowed(username: string, ip?: string): Promise<void> {
    const status = await this.status(username, ip);
    if (status.allowed) return;

    const minutes = Math.max(1, Math.ceil(status.retryAfterSeconds / 60));
    throw new AppError(
      ErrorCode.RATE_LIMITED,
      `登录失败次数过多，请 ${minutes} 分钟后再试`,
      { details: { retryAfterSeconds: status.retryAfterSeconds } },
    );
  }

  async status(username: string, ip?: string): Promise<LoginThrottleStatus> {
    const lockKey = this.lockKey(username);
    const lockedRaw = await this.cache.get(lockKey);
    if (lockedRaw) {
      // 锁定值存的是到期时间戳，剩余时间随时间真实递减（此前返回固定锁定时长，
      // 注释声称"用 TTL 反推"但实现并非如此——自检 P2-19）
      const until = Number(lockedRaw);
      const retryAfterSeconds = Number.isFinite(until)
        ? Math.max(1, Math.ceil((until - Date.now()) / 1000))
        : this.lockSeconds;
      return { allowed: false, remainingAttempts: 0, retryAfterSeconds };
    }

    // 阻断判定只看账号维度：注释里"按 IP 锁定会让共享出口 IP 的同网段用户互相误伤"
    // 的设计意图，此前被 `max(byUser, byIp)` 破坏——IP 计数达到阈值同样会把无关用户挡下
    // （login-throttle 单测暴露）。IP 计数仍然记录，作为观察信号，但不参与阻断。
    const failures = await this.userFailures(username);
    return {
      allowed: failures < this.maxFailures,
      remainingAttempts: Math.max(0, this.maxFailures - failures),
      retryAfterSeconds: 0,
    };
  }

  /** 记录一次失败；达到阈值时置锁定键（值为到期时间戳，键 TTL 即锁定时长） */
  async recordFailure(username: string, ip?: string): Promise<void> {
    const failures = await this.bump(this.failKey('u', username));
    if (ip) await this.bump(this.failKey('ip', ip));

    if (failures >= this.maxFailures) {
      const until = Date.now() + this.lockSeconds * 1000;
      await this.cache.set(
        this.lockKey(username),
        String(until),
        this.lockSeconds,
      );
      this.logger.warn(
        `账号 ${username} 登录失败 ${failures} 次，已锁定 ${this.lockSeconds}s`,
      );
    }
  }

  /** 登录成功：清零计数与锁定 */
  async reset(username: string, ip?: string): Promise<void> {
    await this.cache.delete(this.failKey('u', username));
    if (ip) await this.cache.delete(this.failKey('ip', ip));
    await this.cache.delete(this.lockKey(username));
  }

  private async userFailures(username: string): Promise<number> {
    return Number((await this.cache.get(this.failKey('u', username))) || 0);
  }

  private async bump(key: string): Promise<number> {
    const current = Number((await this.cache.get(key)) || 0) + 1;
    await this.cache.set(key, String(current), this.windowSeconds);
    return current;
  }

  private failKey(kind: 'u' | 'ip', value: string): string {
    return `${KEY_PREFIX}:fail:${kind}:${value}`;
  }

  /**
   * 锁定只按**账号**维度，不按 IP。
   * 学校/公司出口 IP 是共享的，按 IP 锁定会让同网段所有人一起被挡，
   * 反而变成一个低成本的拒绝服务入口；账号维度才能精确打击密码爆破。
   */
  private lockKey(username: string): string {
    return `${KEY_PREFIX}:lock:u:${username}`;
  }
}
