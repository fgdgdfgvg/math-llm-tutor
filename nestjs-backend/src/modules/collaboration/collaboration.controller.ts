import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import {
  CollaborationSessionService,
  CollaborationRole,
} from '../../common/services/collaboration-session.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('collaboration')
@Controller('api/collaboration')
export class CollaborationController {
  constructor(
    private readonly collaborationService: CollaborationSessionService,
  ) {}

  @Post('sessions')
  @ApiOperation({ summary: '创建协作会话' })
  createSession(
    @Body()
    body: {
      problem: string;
      category: string;
      ownerId: string;
      ownerName: string;
      maxUsers?: number;
      allowLateJoin?: boolean;
      requireApproval?: boolean;
    },
  ) {
    const session = this.collaborationService.createSession(
      body.problem,
      body.category,
      body.ownerId,
      body.ownerName,
      {
        maxUsers: body.maxUsers,
        allowLateJoin: body.allowLateJoin,
        requireApproval: body.requireApproval,
      },
    );
    return { success: true, session };
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ summary: '获取协作会话详情' })
  getSession(@Param('sessionId') sessionId: string) {
    const session = this.collaborationService.getSession(sessionId);
    if (!session) {
      return { success: false, message: '会话不存在' };
    }
    return { success: true, session };
  }

  @Post('sessions/:sessionId/join')
  @ApiOperation({ summary: '加入协作会话' })
  joinSession(
    @Param('sessionId') sessionId: string,
    @Body()
    body: {
      userId: string;
      userName: string;
      role?: CollaborationRole;
    },
  ) {
    const result = this.collaborationService.joinSession(
      sessionId,
      body.userId,
      body.userName,
      body.role,
    );
    return result;
  }

  @Post('sessions/:sessionId/leave')
  @ApiOperation({ summary: '离开协作会话' })
  leaveSession(
    @Param('sessionId') sessionId: string,
    @Body() body: { userId: string },
  ) {
    const success = this.collaborationService.leaveSession(
      sessionId,
      body.userId,
    );
    return { success, message: success ? '已离开' : '操作失败' };
  }

  @Post('sessions/:sessionId/steps')
  @ApiOperation({ summary: '添加解题步骤' })
  addStep(
    @Param('sessionId') sessionId: string,
    @Body()
    body: {
      userId: string;
      content: string;
      type: 'reasoning' | 'calculation' | 'result' | 'comment';
    },
  ) {
    return this.collaborationService.addStep(
      sessionId,
      body.userId,
      body.content,
      body.type,
    );
  }

  @Put('sessions/:sessionId/steps/:stepId')
  @ApiOperation({ summary: '更新解题步骤' })
  updateStep(
    @Param('sessionId') sessionId: string,
    @Param('stepId') stepId: string,
    @Body() body: { userId: string; content: string },
  ) {
    return this.collaborationService.updateStep(
      sessionId,
      stepId,
      body.userId,
      body.content,
    );
  }

  @Post('sessions/:sessionId/steps/:stepId/confirm')
  @ApiOperation({ summary: '确认解题步骤' })
  confirmStep(
    @Param('sessionId') sessionId: string,
    @Param('stepId') stepId: string,
    @Body() body: { userId: string },
  ) {
    return this.collaborationService.confirmStep(
      sessionId,
      stepId,
      body.userId,
    );
  }

  @Post('sessions/:sessionId/steps/:stepId/react')
  @ApiOperation({ summary: '对步骤添加/移除反应' })
  addReaction(
    @Param('sessionId') sessionId: string,
    @Param('stepId') stepId: string,
    @Body() body: { userId: string; emoji: string },
  ) {
    return this.collaborationService.addReaction(
      sessionId,
      stepId,
      body.userId,
      body.emoji,
    );
  }

  @Put('sessions/:sessionId/users/:targetUserId/role')
  @ApiOperation({ summary: '更新用户角色' })
  updateRole(
    @Param('sessionId') sessionId: string,
    @Param('targetUserId') targetUserId: string,
    @Body() body: { requesterId: string; newRole: CollaborationRole },
  ) {
    return this.collaborationService.updateUserRole(
      sessionId,
      targetUserId,
      body.newRole,
      body.requesterId,
    );
  }

  @Post('sessions/:sessionId/pause')
  @ApiOperation({ summary: '暂停会话' })
  pauseSession(
    @Param('sessionId') sessionId: string,
    @Body() body: { userId: string },
  ) {
    return this.collaborationService.pauseSession(sessionId, body.userId);
  }

  @Post('sessions/:sessionId/resume')
  @ApiOperation({ summary: '恢复会话' })
  resumeSession(
    @Param('sessionId') sessionId: string,
    @Body() body: { userId: string },
  ) {
    return this.collaborationService.resumeSession(sessionId, body.userId);
  }

  @Post('sessions/:sessionId/complete')
  @ApiOperation({ summary: '完成会话' })
  completeSession(
    @Param('sessionId') sessionId: string,
    @Body() body: { userId: string },
  ) {
    return this.collaborationService.completeSession(sessionId, body.userId);
  }

  @Get('sessions/:sessionId/history')
  @ApiOperation({ summary: '获取解题历史' })
  getHistory(@Param('sessionId') sessionId: string) {
    const history = this.collaborationService.getSessionHistory(sessionId);
    if (!history) {
      return { success: false, message: '无历史记录' };
    }
    return { success: true, history };
  }

  @Get('sessions')
  @ApiOperation({ summary: '获取所有活跃会话' })
  getActiveSessions() {
    const sessions = this.collaborationService.getAllActiveSessions();
    return { success: true, sessions };
  }
}
