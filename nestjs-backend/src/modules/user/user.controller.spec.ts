import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { AuthService } from '../../core/auth/auth.service';
import { LoginThrottleService } from '../../core/auth/login-throttle.service';
import { CreateUserDto } from './dto/create-user.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LoginDto } from './dto/login.dto';

describe('UserController', () => {
  let controller: UserController;
  const userService = {
    findOne: jest.fn(),
    create: jest.fn(),
    validateUser: jest.fn(),
    findAll: jest.fn(),
    deleteByUsername: jest.fn(),
  };
  const authService = { login: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: userService },
        { provide: AuthService, useValue: authService },
        {
          // 登录节流服务：单测里固定放行，避免测试之间的计数互相污染
          provide: LoginThrottleService,
          useValue: {
            assertAllowed: jest.fn().mockResolvedValue(undefined),
            recordFailure: jest.fn().mockResolvedValue(undefined),
            reset: jest.fn().mockResolvedValue(undefined),
            status: jest.fn().mockResolvedValue({
              allowed: true,
              remainingAttempts: 5,
              retryAfterSeconds: 0,
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('注册（P0：越权提升）', () => {
    it('公开注册不允许分配 admin 角色', async () => {
      userService.findOne.mockResolvedValue(null);
      userService.create.mockImplementation(
        async (dto: any, roles?: string[]) => ({
          toObject: () => ({ _id: '1', username: dto.username, roles }),
        }),
      );

      await controller.register({
        username: 'alice',
        password: 'secret123',
      } as CreateUserDto);

      // 第二个参数（角色）必须缺省，由服务层固定为 student
      const [, roles] = userService.create.mock.calls[0];
      expect(roles).toBeUndefined();
      expect(userService.create.mock.calls[0][0].username).toBe('alice');
    });

    it('拒绝系统保留用户名 admin', async () => {
      await expect(
        controller.register({
          username: 'admin',
          password: 'secret123',
        } as CreateUserDto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(userService.create).not.toHaveBeenCalled();
    });

    it('用户名已存在返回 409', async () => {
      userService.findOne.mockResolvedValue({ username: 'alice' });
      await expect(
        controller.register({
          username: 'alice',
          password: 'secret123',
        } as CreateUserDto),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('DTO 校验', () => {
    it('CreateUserDto 不含 roles 字段（传了会被全局 ValidationPipe 拒绝）', async () => {
      const instance = plainToInstance(CreateUserDto, {
        username: 'bob',
        password: 'secret123',
        roles: ['admin'],
      } as any);
      const errors = await validate(instance, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      expect(errors.some((e) => e.property === 'roles')).toBe(true);
    });

    it('LoginDto 拒绝空密码/空用户名（旧的内联类型会被 ValidationPipe 跳过）', async () => {
      const empty = plainToInstance(LoginDto, {});
      const errors = await validate(empty);
      expect(errors.map((e) => e.property).sort()).toEqual([
        'password',
        'username',
      ]);

      const short = plainToInstance(LoginDto, {
        username: 'bob',
        password: '123',
      });
      const shortErrors = await validate(short);
      expect(shortErrors.some((e) => e.property === 'password')).toBe(true);
    });
  });

  describe('登录', () => {
    it('凭据错误返回 401 且不签发令牌', async () => {
      userService.validateUser.mockResolvedValue(null);
      await expect(
        controller.login(
          { username: 'bob', password: 'secret123' },
          { ip: '127.0.0.1' },
        ),
      ).rejects.toThrow();
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('凭据正确时签发令牌', async () => {
      userService.validateUser.mockResolvedValue({
        _id: '1',
        username: 'bob',
        roles: ['student'],
      });
      authService.login.mockResolvedValue({ access_token: 'token' });
      const result = await controller.login(
        {
          username: 'bob',
          password: 'secret123',
        },
        { ip: '127.0.0.1' },
      );
      expect(result).toEqual({ access_token: 'token' });
    });
  });
});
