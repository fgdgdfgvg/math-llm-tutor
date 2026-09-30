import { Module } from '@nestjs/common';
import { CollaborationController } from './collaboration.controller';
import { CollaborationSessionService } from '../../common/services/collaboration-session.service';

@Module({
  controllers: [CollaborationController],
  providers: [CollaborationSessionService],
  exports: [CollaborationSessionService],
})
export class CollaborationModule {}
