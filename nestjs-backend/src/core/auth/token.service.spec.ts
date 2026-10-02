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
  async setIfAbsent(key: string, value: string, ttl = 60): Promise<boolean> {
    const entry = this.store.get(key);
    if (entry && Date.now() <= entry.expiresAt) return false;
    this.store.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
    return true;
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
/** 严格模式：宽容窗口为 0，任何重放都视为泄露（用于安全语义用例） */
const strict = { REFRESH_REPLAY_GRACE_SECONDS: '0' };

describe('TokenService', () => {
  it('签发的 access token 默认 15 分钟、refresh 默认 30 天', async () => {
    const { service, jwt } = createService();
    const pair = await service.issuePair(user);

    expect(pair.token_type).toBe('Bearer');
    expect(pair.expires_in).toBe(900);
    expect(pair.refresh_expires_in).toBe(30 * 24 * 3600);
    expect(pair.refresh_token).not.toContain('alice');

    const decoded: any = jwt.decode(pair.access_token);
    expect(decoded.username).toBe('alice');
    expect(decoded.roles).toEqual(['student']);
    expect(decoded.exp - decoded.iat).toBe(900);
  });

  it('JWT_EXPIRATION / JWT_REFRESH_TTL 可覆盖默认时长', async () => {
    const { service } = createService({ JWT_EXPIRATION: '1h', JWT_REFRESH_TTL: '7d' });
    const pair = await service.issuePair(user);
    expect(pair.expires_in).toBe(3600);
    expect(pair.refresh_expires_in).toBe(7 * 24 * 3600);
  });

  it('轮换：旧 refresh token 用后即失效，新 token 可继续换', async () => {
    const { service } = createService(strict);
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
    const { service } = createService(strict);
    const first = await service.issuePair(user);
    const second = await service.rotate(first.refresh_token);

    // 攻击者重放被盗的旧 token —— 这正是窃取检测要抓的场景
    await expect(service.rotate(first.refresh_token)).rejects.toBeInstanceOf(UnauthorizedAppError);

    // 令牌族被吊销后，真实用户手上的新 token 也不能再用，强制重新登录
    await expect(service.rotate(second.refresh_token)).rejects.toBeInstanceOf(UnauthorizedAppError);
  });

  it('宽容窗口：窗口内的重复刷新是幂等的，返回同一份新令牌（自检 P1-3）', async () => {
    const { service } = createService(); // 默认 30s 宽容窗口
    const first = await service.issuePair(user);

    const rotated = await service.rotate(first.refresh_token);
    // 多标签页场景：同一旧值在窗口内再次提交，返回同一对而不是吊销会话
    const replay = await service.rotate(first.refresh_token);
    expect(replay.access_token).toBe(rotated.access_token);
    expect(replay.refresh_token).toBe(rotated.refresh_token);

    // 新值仍可正常继续轮换
    const next = await service.rotate(rotated.refresh_token);
    expect(next.refresh_token).not.toBe(rotated.refresh_token);
  });

  it('并发刷新单飞：10 个并发请求只有一个执行轮换，全部拿到同一份令牌（自检 P1-3）', async () => {
    const { service } = createService();
    const first = await service.issuePair(user);

    const results = await Promise.all(
      Array.from({ length: 10 }, () => service.rotate(first.refresh_token)),
    );
    const tokens = new Set(results.map((r) => r.access_token));
    // 所有并发请求共享同一次轮换的结果，没有任何一个被误判为泄露
    expect(tokens.size).toBe(1);
    // 会话没有被吊销：新值还能继续轮换
    const next = await service.rotate(results[0].refresh_token);
    expect(next.access_token).toBeTruthy();
  });

  it('登出后 refresh token 不能再用', async () => {
    const { service } = createService(strict);
    const pair = await service.issuePair(user);
    await service.revoke(pair.refresh_token);
    await expect(service.rotate(pair.refresh_token)).rejects.toBeInstanceOf(UnauthorizedAppError);
  });

  it('登出全部设备：该用户所有 refresh token 失效', async () => {
    const { service } = createService(strict);
    const a = await service.issuePair(user);
    const b = await service.issuePair(user);
    const count = await service.revokeAllForUser('user-1');

    expect(count).toBeGreaterThanOrEqual(2);
    await expect(service.rotate(a.refresh_token)).rejects.toBeInstanceOf(UnauthorizedAppError);
    await expect(service.rotate(b.refresh_token)).rejects.toBeInstanceOf(UnauthorizedAppError);
  });

  it('无效/空 refresh token 一律 401，不泄露具体原因', async () => {
    const { service } = createService(strict);
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
