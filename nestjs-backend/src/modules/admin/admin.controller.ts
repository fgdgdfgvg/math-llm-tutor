import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  Request,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, Document } from 'mongoose';
import { User, UserDocument } from '../user/schemas/user.schema';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { LearningRecord, LearningRecordDocument } from '../learning/schemas/learning-record.schema';

interface UserStats {
  userId: string;
  username: string;
  email?: string;
  roles: string[];
  createdAt?: Date;
  totalConcepts: number;
  masteredConcepts: number;
  totalPracticeTime: number;
  averageMastery: number;
}

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalLearningRecords: number;
  averageMastery: number;
}

type UserDocumentWithTimestamps = UserDocument & Document & { createdAt: Date; updatedAt: Date };

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(LearningRecord.name) private readonly learningRecordModel: Model<LearningRecordDocument>,
  ) {}

  private async checkAdmin(userId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.roles || !Array.isArray(user.roles) || !user.roles.includes('admin')) {
      throw new ForbiddenException('Admin access required');
    }
    return user;
  }

  @Get('stats')
  async getAdminStats(@Request() req: Request & { user: { userId: string } }) {
    await this.checkAdmin(req.user.userId);

    const [totalUsers, totalRecords, records] = await Promise.all([
      this.userModel.countDocuments(),
      this.learningRecordModel.countDocuments(),
      this.learningRecordModel.find().exec(),
    ]);

    const activeUserIds = new Set(records.map((r) => r.userId.toString()));
    const averageMastery = records.length > 0
      ? records.reduce((sum, r) => sum + r.masteryLevel, 0) / records.length
      : 0;

    return {
      totalUsers,
      activeUsers: activeUserIds.size,
      totalLearningRecords: totalRecords,
      averageMastery,
    } as AdminStats;
  }

  @Get('users')
  async getAllUsers(@Request() req: Request & { user: { userId: string } }) {
    await this.checkAdmin(req.user.userId);

    const users = await this.userModel.find().select('-password').exec();

    const userStats: UserStats[] = await Promise.all(
      users.map(async (user) => {
        const typedUser = user as UserDocumentWithTimestamps;
        const records = await this.learningRecordModel
          .find({ userId: user._id })
          .exec();

        const conceptMap = new Map<string, LearningRecordDocument>();
        records.forEach((record) => {
          if (!conceptMap.has(record.conceptId)) {
            conceptMap.set(record.conceptId, record);
          }
        });

        const concepts = Array.from(conceptMap.values());

        return {
          userId: user._id.toString(),
          username: user.username,
          email: user.email,
          roles: user.roles || [],
          createdAt: typedUser.createdAt,
          totalConcepts: concepts.length,
          masteredConcepts: concepts.filter((c) => c.masteryLevel >= 0.8).length,
          totalPracticeTime: records.reduce((sum, r) => sum + (r.timeSpent || 0), 0),
          averageMastery: concepts.length > 0
            ? concepts.reduce((sum, c) => sum + c.masteryLevel, 0) / concepts.length
            : 0,
        };
      }),
    );

    return userStats;
  }

  @Get('users/:id')
  async getUserById(
    @Request() req: Request & { user: { userId: string } },
    @Param('id') userId: string,
  ) {
    await this.checkAdmin(req.user.userId);

    const user = await this.userModel.findById(userId).select('-password');
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const typedUser = user as UserDocumentWithTimestamps;
    const records = await this.learningRecordModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();

    return {
      user: {
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
        roles: user.roles || [],
        createdAt: typedUser.createdAt,
      },
      recentActivity: records,
    };
  }

  @Delete('users/:id')
  async deleteUser(
    @Request() req: Request & { user: { userId: string } },
    @Param('id') userId: string,
  ) {
    await this.checkAdmin(req.user.userId);

    if (userId === req.user.userId) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.learningRecordModel.deleteMany({ userId: new Types.ObjectId(userId) });
    await this.userModel.deleteOne({ _id: new Types.ObjectId(userId) });

    this.logger.log(`Admin ${req.user.userId} deleted user ${userId}`);

    return {
      message: 'User deleted successfully',
      deletedUserId: userId,
      timestamp: new Date(),
    };
  }
}
