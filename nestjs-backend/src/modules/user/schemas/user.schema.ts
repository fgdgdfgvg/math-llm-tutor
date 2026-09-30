import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as bcrypt from 'bcrypt';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, trim: true })
  username: string;

  @Prop({ required: true })
  password: string;

  @Prop({ type: [String], default: ['student'] })
  roles: string[];

  @Prop({ required: false })
  email?: string;

  createdAt?: Date;

  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.pre<UserDocument>('save', async function () {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});
