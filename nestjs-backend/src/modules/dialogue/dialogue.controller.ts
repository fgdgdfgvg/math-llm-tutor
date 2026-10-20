import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import {
  DialogueService,
  DialogueMessage,
  DialogueSession,
  StepFeedback,
} from './dialogue.service';

@Controller('dialogue')
@UseGuards(JwtAuthGuard)
export class DialogueController {
  constructor(private readonly dialogueService: DialogueService) {}

  @Post('sessions')
  async createSession(
    @Request() req: Request & { user: { userId: string } },
    @Body()
    body: {
      context?: {
        problemId?: string;
        relatedConcepts?: string[];
      };
    },
  ): Promise<DialogueSession> {
    return this.dialogueService.createSession(req.user.userId, body.context);
  }

  @Post('sessions/:sessionId/messages')
  async sendMessage(
    @Param('sessionId') sessionId: string,
    @Body()
    body: {
      message: string;
      type?: 'question' | 'answer' | 'hint' | 'feedback';
    },
  ): Promise<DialogueMessage[]> {
    return this.dialogueService.sendMessage(sessionId, body.message, body.type);
  }

  @Post('sessions/:sessionId/analyze-step')
  async analyzeStep(
    @Param('sessionId') sessionId: string,
    @Body()
    body: {
      stepNumber: number;
      stepContent: string;
    },
  ): Promise<StepFeedback> {
    return this.dialogueService.analyzeStep(
      sessionId,
      body.stepNumber,
      body.stepContent,
    );
  }

  @Get('sessions/:sessionId')
  async getSession(
    @Param('sessionId') sessionId: string,
  ): Promise<DialogueSession | null> {
    return this.dialogueService.getSession(sessionId);
  }

  @Get('sessions')
  async listSessions(
    @Request() req: Request & { user: { userId: string } },
  ): Promise<DialogueSession[]> {
    return this.dialogueService.listSessions(req.user.userId);
  }

  @Delete('sessions/:sessionId')
  async closeSession(
    @Param('sessionId') sessionId: string,
  ): Promise<{ success: boolean }> {
    const success = await this.dialogueService.closeSession(sessionId);
    return { success };
  }

  @Post('cleanup')
  async cleanupSessions(): Promise<{ message: string }> {
    await this.dialogueService.cleanupSessions();
    return { message: 'Sessions cleaned up' };
  }
}
