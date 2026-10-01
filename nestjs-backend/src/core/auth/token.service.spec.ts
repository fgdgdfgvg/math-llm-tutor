import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';
import { UnauthorizedAppError } from '../../common/errors/app-error';

/** 内存版缓存替身：单测不依赖真实 Redis（保持快速、可重复） */
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

function createService(overrides: Record<string, string> = {}) {
  const cache = new FakeCache();
  const config = {
    get: (key: string) => overrides[key],
  } as any;
  const jwt = new JwtService({ secret: 'unit-test-secret' });
  const service = new TokenService(jwt, config, cache as any);
  return { service, cache, jwt };
}

const user = { _id: 'user-1', username: 'alice', roles: ['student'] };

describe('TokenService', () => {
  it('签发的 access token 默认 15 分钟、refresh 默认 7 天', async () => {
    const { service, jwt } = createService();
    const pair = await service.issuePair(user);

    expect(pair.token_type).toBe('Bearer');
    expect(pair.expires_in).toBe(900);
    expect(pair.refresh_expires_in).toBe(7 * 24 * 3600);
    expect(pair.refresh_token).not.toContain('alice');

    const decoded: any = jwt.decode(pair.access_token);
    expect(decoded.username).toBe('alice');
    expect(decoded.exp - decoded.iat).toBe(900);
  });

  it('JWT_EXPIRATION 可覆盖默认时长', async () => {
    const { service } = createService({ JWT_EXPIRATION: '1h' });
    const pair = await service.issuePair(user);
    expect(pair.expires_in).toBe(3600);
  });

  it('轮换：旧 refresh token 用后即失效，新 token 可继续换', async () => {
    const { service } = createService();
    const first = await service.issuePair(user);

    const second = await service.rotate(first.refresh_token);
    expect(second.refresh_token).not.toBe(first.refresh_token);

    // 正常轮换可以一直进行下去（每次都换新值）
    const third = await service.rotate(second.refresh_token);
    expect(third.access_token).toBeTruthy();
    expect(third.refresh_token).not.toBe(second.refresh_token);

    // 旧值已被标记为已用，再次使用应被拒绝
    await expect(service.rotate(first.refresh_token)).rejects.toBeInstanceOf(UnauthorizedAppError);
  });

  it('重用检测：检测到重放后吊销整个令牌族，合法的新 token 也失效', async () => {
    const { service } = createService();
    const first = await service.issuePair(user);
    const second = await service.rotate(first.refresh_token);

    // 攻击者重放被盗的旧 token —— 这正是窃取检测要抓的场景
    await expect(service.rotate(first.refresh_token)).rejects.toBeInstanceOf(UnauthorizedAppError);

    // 令牌族被吊销后，真实用户手上的新 token 也不能再用，强制重新登录
    await expect(service.rotate(second.refresh_token)).rejects.toBeInstanceOf(UnauthorizedAppError);
  });

  it('登出后 refresh token 不能再用', async () => {
    const { service } = createService();
    const pair = await service.issuePair(user);
    await service.revoke(pair.refresh_token);
    await expect(service.rotate(pair.refresh_token)).rejects.toBeInstanceOf(UnauthorizedAppError);
  });

  it('登出全部设备：该用户所有 refresh token 失效', async () => {
    const { service } = createService();
    const a = await service.issuePair(user);
    const b = await service.issuePair(user);
    const count = await service.revokeAllForUser('user-1');

    expect(count).toBeGreaterThanOrEqual(2);
    await expect(service.rotate(a.refresh_token)).rejects.toBeInstanceOf(UnauthorizedAppError);
    await expect(service.rotate(b.refresh_token)).rejects.toBeInstanceOf(UnauthorizedAppError);
  });

  it('无效/空 refresh token 一律 401，不泄露具体原因', async () => {
    const { service } = createService();
    await expect(service.rotate('')).rejects.toBeInstanceOf(UnauthorizedAppError);
    await expect(service.rotate('not-a-real-token')).rejects.toBeInstanceOf(UnauthorizedAppError);
    await expect(service.rotate(undefined as any)).rejects.toBeInstanceOf(UnauthorizedAppError);
  });

  it('缓存里存的是 refresh token 的哈希，不是明文', async () => {
    const { service, cache } = createService();
    const pair = await service.issuePair(user);
    const dumped = JSON.stringify([...(cache as any).store.keys()]);
    expect(dumped).not.toContain(pair.refresh_token);
  });

  it('不同用户的令牌相互隔离', async () => {
    const { service } = createService();
    await service.issuePair(user);
    await service.issuePair({ _id: 'user-2', username: 'bob' });
    const revoked = await service.revokeAllForUser('user-1');
    expect(revoked).toBe(1);
  });
});
