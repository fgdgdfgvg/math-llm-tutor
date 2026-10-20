import { LoginThrottleService } from './login-throttle.service';
import { AppError } from '../../common/errors/app-error';

class FakeCache {
  private store = new Map<string, { value: string; expiresAt: number }>();
  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }
  async set(key: string, value: string, ttl = 60): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

function createService(configOverrides: Record<string, string> = {}) {
  const config = { get: (key: string) => configOverrides[key] } as any;
  const cache = new FakeCache();
  const service = new LoginThrottleService(config, cache as any);
  return { service, cache };
}

describe('LoginThrottleService（自检 P1 防爆破 + P2-19 倒计时）', () => {
  it('默认允许登录', async () => {
    const { service } = createService();
    await expect(
      service.assertAllowed('alice', '1.2.3.4'),
    ).resolves.toBeUndefined();
  });

  it('失败 5 次后锁定，第 6 次直接 429', async () => {
    const { service } = createService({
      LOGIN_MAX_FAILURES: '5',
      LOGIN_LOCK_SECONDS: '900',
    });
    for (let i = 0; i < 5; i++) {
      await service.recordFailure('alice', '1.2.3.4');
    }
    await expect(
      service.assertAllowed('alice', '1.2.3.4'),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('锁定期间正确密码也不放行（防爆破语义）', async () => {
    const { service } = createService({ LOGIN_MAX_FAILURES: '2' });
    await service.recordFailure('alice');
    await service.recordFailure('alice');
    const status = await service.status('alice');
    expect(status.allowed).toBe(false);
    expect(status.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('剩余锁定时间随时间递减（自检 P2-19：不再返回固定时长）', async () => {
    const { service, cache } = createService({
      LOGIN_MAX_FAILURES: '1',
      LOGIN_LOCK_SECONDS: '900',
    });
    await service.recordFailure('alice');
    const first = await service.status('alice');
    // 人为把到期时间戳拨近 60 秒，模拟时间流逝
    await cache.set(
      'auth:login:lock:u:alice',
      String(Date.now() + 840 * 1000),
      840,
    );
    const later = await service.status('alice');
    expect(later.retryAfterSeconds).toBeLessThan(first.retryAfterSeconds);
  });

  it('登录成功后清零计数与锁定', async () => {
    const { service } = createService({ LOGIN_MAX_FAILURES: '2' });
    await service.recordFailure('alice');
    await service.recordFailure('alice');
    await service.reset('alice', '1.2.3.4');
    const status = await service.status('alice', '1.2.3.4');
    expect(status.allowed).toBe(true);
    expect(status.remainingAttempts).toBe(2);
  });

  it('锁定只按账号维度，不按 IP（共享出口 IP 不互相误伤）', async () => {
    const { service } = createService({ LOGIN_MAX_FAILURES: '2' });
    await service.recordFailure('alice', '1.2.3.4');
    await service.recordFailure('alice', '1.2.3.4');
    // 另一账号走同一 IP 不应被锁
    const other = await service.status('bob', '1.2.3.4');
    expect(other.allowed).toBe(true);
  });
});
