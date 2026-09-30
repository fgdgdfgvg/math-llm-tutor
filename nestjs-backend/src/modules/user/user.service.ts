import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  /** 公开注册/create 路径不允许分配角色：一律为 student */
  private static readonly DEFAULT_ROLES = ['student'];

  /**
   * 创建用户。
   *
   * 安全：**角色不再由用户名决定**。旧实现 `roles: username === 'admin' ? ['admin'] : ['student']`
   * 配合公开注册接口，意味着任何人注册用户名 `admin` 即可拿到管理员权限，
   * 进而调用用户列表/创建/删除接口（P0 越权）。现在只有管理员接口可显式传角色。
   */
  async create(createUserDto: CreateUserDto, roles: string[] = UserService.DEFAULT_ROLES): Promise<User> {
    this.logger.log(`Creating user: ${createUserDto.username}`);
    const createdUser = new this.userModel({
      username: createUserDto.username,
      password: createUserDto.password,
      email: createUserDto.email,
      roles: UserService.normalizeRoles(roles),
    });
    try {
      return await createdUser.save();
    } catch (error: any) {
      // 并发注册同一用户名时唯一索引会抛 E11000；映射成明确的业务错误，
      // 而不是让用户看到 500。
      if (error?.code === 11000) {
        throw new ConflictException('用户名已存在');
      }
      throw error;
    }
  }

  /** 只允许已知角色，防止管理员接口写入任意角色字符串 */
  private static normalizeRoles(roles: string[] | undefined | null): string[] {
    const allowed = ['student', 'teacher', 'admin'];
    const cleaned = (roles ?? []).filter((role) => allowed.includes(role));
    return cleaned.length ? Array.from(new Set(cleaned)) : [...UserService.DEFAULT_ROLES];
  }

  async findOne(username: string): Promise<User | null> {
    // 旧代码在 username 为 undefined 时会让 Mongoose 忽略该条件，
    // 返回集合中第一个用户（构成逻辑绕过面）。这里提前拦住。
    if (!username || typeof username !== 'string') return null;
    this.logger.log(`Finding user: ${username}`);
    return this.userModel.findOne({ username }).lean().exec();
  }

  async findAll(page = 1, limit = 20): Promise<{ users: User[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.userModel.find().skip(skip).limit(limit).lean().exec(),
      this.userModel.countDocuments().exec(),
    ]);
    return { users, total, page, limit };
  }

  async deleteByUsername(username: string): Promise<boolean> {
    this.logger.log(`Deleting user: ${username}`);
    const result = await this.userModel.deleteOne({ username }).exec();
    return result.deletedCount > 0;
  }

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.userModel.findOne({ username }).exec();
    this.logger.log(`Found user: ${user ? 'yes' : 'no'}`);
    if (user) {
      const isMatch = await bcrypt.compare(pass, user.password);
      if (isMatch) {
        const { password, ...result } = user.toObject();
        return result;
      }
    }
    this.logger.log(`User validation failed for: ${username}`);
    return null;
  }
}
