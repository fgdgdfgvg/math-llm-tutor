import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { User, UserSchema } from '../user/schemas/user.schema';
import { LearningRecord, LearningRecordSchema } from '../learning/schemas/learning-record.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: LearningRecord.name, schema: LearningRecordSchema },
    ]),
  ],
  controllers: [AdminController],
})
export class AdminModule {}
