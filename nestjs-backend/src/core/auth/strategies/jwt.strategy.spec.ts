import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy（自检 P0-2 回归）', () => {
  const configService = {
    get: jest.fn().mockReturnValue('test-secret-at-least-32-characters-long'),
  } as unknown as ConfigService;

  it('validate 必须透传 roles（此前丢失导致 RBAC 失效）', () => {
    const strategy = new JwtStrategy(configService);
    const user = strategy.validate({ sub: 'u1', username: 'alice', roles: ['admin'] });
    expect(user).toEqual({
      sub: 'u1',
      userId: 'u1',
      username: 'alice',
      roles: ['admin'],
    });
  });

  it('validate 产物与 GlobalAuthGuard 的结构一致（sub/userId/username/roles）', () => {
    const strategy = new JwtStrategy(configService);
    const user = strategy.validate({ sub: 'u2', username: 'bob' });
    expect(user.sub).toBe('u2');
    expect(user.userId).toBe('u2');
    expect(user.username).toBe('bob');
    expect(user.roles).toBeUndefined();
  });
});
