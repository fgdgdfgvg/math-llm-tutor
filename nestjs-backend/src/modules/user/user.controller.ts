import {
  Controller,
  Post,
  Body,
  ConflictException,
  UnauthorizedException,
  UseGuards,
  Request,
  Get,
  Delete,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';

/** 保留用户名：避免仿冒与钓鱼（admin 已不再自动获得管理员角色，但仍会误导用户） */
const RESERVED_USERNAMES = ['admin', 'administrator', 'root', 'system', 'superuser', 'support'];
import { AuthService } from '../../core/auth/auth.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Public } from '../../core/auth/guards/global-auth.guard';

/** 把 mongoose 文档转换成对外安全的纯对象（去掉密码与内部字段） */
function toSafeUser(user: any) {
  const plain = typeof user?.toObject === 'function' ? user.toObject() : { ...user };
  const { password, __v, _id, ...rest } = plain;
  return { id: String(_id ?? user?._id ?? ''), ...rest };
}

@ApiTags('auth')
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: '用户注册', description: '创建新用户账号（角色固定为 student）' })
  @ApiResponse({ status: 201, description: '注册成功' })
  @ApiResponse({ status: 409, description: '用户名已存在' })
  async register(@Body() createUserDto: CreateUserDto) {
    // 公开注册不允许指定角色。以前“用户名 == admin 即管理员”是 P0 越权，
    // 现在角色一律由服务层固定为 student。
    const username = createUserDto.username?.trim();
    if (RESERVED_USERNAMES.includes(username.toLowerCase())) {
      throw new ConflictException('该用户名为系统保留，请更换');
    }
    const existingUser = await this.userService.findOne(username);
    if (existingUser) {
      throw new ConflictException('用户名已存在');
    }
    // create() 内部捕获 E11000 并转成 409，避免并发注册返回 500
    const user = await this.userService.create({ ...createUserDto, username });
    return toSafeUser(user);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: '用户登录', description: '使用用户名密码登录，返回JWT令牌' })
  @ApiResponse({ status: 200, description: '登录成功，返回JWT令牌' })
  @ApiResponse({ status: 401, description: '用户名或密码错误' })
  async login(@Body() loginDto: LoginDto) {
    const user = await this.userService.validateUser(
      loginDto.username,
      loginDto.password,
    );
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    return this.authService.login(user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取用户信息', description: '获取当前登录用户的个人信息' })
  @ApiResponse({ status: 200, description: '返回用户信息' })
  @ApiResponse({ status: 401, description: '未授权' })
  getProfile(@Request() req) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Roles('admin')
  @Get('list')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取用户列表（分页）', description: '管理员获取用户列表，支持分页' })
  @ApiResponse({ status: 200, description: '返回分页用户列表' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  async listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page || '1', 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const result = await this.userService.findAll(pageNum, limitNum);
    return {
      ...result,
      users: result.users.map((user) => toSafeUser(user)),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Roles('admin')
  @Post('create')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '创建用户', description: '管理员创建新用户' })
  @ApiResponse({ status: 201, description: '用户创建成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 409, description: '用户名已存在' })
  async createUser(@Body() createUserDto: AdminCreateUserDto) {
    const existingUser = await this.userService.findOne(createUserDto.username);
    if (existingUser) {
      throw new ConflictException('用户名已存在');
    }
    // 唯一允许指定角色的入口；DTO 已做白名单校验，服务层再过滤一次
    const { roles, ...rest } = createUserDto;
    const user = await this.userService.create(rest, roles);
    return toSafeUser(user);
  }

  @UseGuards(JwtAuthGuard)
  @Roles('admin')
  @Delete('delete/:username')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '删除用户', description: '管理员删除指定用户' })
  @ApiParam({ name: 'username', description: '用户名', type: String })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  async deleteUser(@Param('username') username: string) {
    const success = await this.userService.deleteByUsername(username);
    if (success) {
      return { message: `用户 ${username} 已删除` };
    }
    return { message: `用户 ${username} 不存在` };
  }
}
