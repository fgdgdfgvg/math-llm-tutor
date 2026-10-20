import {
  Controller,
  Post,
  Body,
  Get,
  Res,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import type { Response } from 'express';
import { Public } from '../../core/auth/guards/global-auth.guard';
import { AgentsService } from './agents.service';
import { MultiAgentResult } from './agent.types';
import { AgentProgressEvent } from './agent.orchestrator';
import { toUserFriendlyError } from '../../common/utils/error-messages';
import { describeErrorForLog } from '../../common/utils/redact';

class SolveProblemDto {
  @IsString()
  @IsNotEmpty()
  problem: string;
}

class DiagnoseAnswerDto {
  @IsNotEmpty()
  problem: any;

  @IsString()
  @IsNotEmpty()
  studentAnswer: string;

  @IsOptional()
  @IsObject()
  solution?: any;
}

class FeedbackDto extends DiagnoseAnswerDto {
  @IsOptional()
  @IsObject()
  diagnosis?: any;
}

@Controller('agents')
export class AgentsController {
  private readonly logger = new Logger(AgentsController.name);

  constructor(private readonly agentsService: AgentsService) {}

  @Public()
  @Post('solve')
  async solve(
    @Body() solveProblemDto: SolveProblemDto,
  ): Promise<MultiAgentResult> {
    try {
      return await this.agentsService.solveProblem(solveProblemDto.problem);
    } catch (error) {
      this.logger.error('解题请求失败', describeErrorForLog(error));
      const friendly = toUserFriendlyError(error);
      throw new HttpException(friendly.message, friendly.statusCode);
    }
  }

  @Public()
  @Post('diagnose')
  async diagnose(@Body() dto: DiagnoseAnswerDto) {
    return this.agentsService.diagnoseStudentAnswer(dto);
  }

  @Public()
  @Post('feedback')
  async feedback(@Body() dto: FeedbackDto) {
    return this.agentsService.generateStudentFeedback(dto);
  }

  @Public()
  @Get('solve/stream')
  async solveStream(@Res() response: Response): Promise<void> {
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();

    const sendEvent = (event: AgentProgressEvent) => {
      response.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    const progressSub = this.agentsService.getProgressEvents().subscribe({
      next: (event) => {
        sendEvent(event);
        if (event.type === 'complete') {
          response.write('event: done\ndata: {}\n\n');
          response.end();
        }
      },
      error: (err) => {
        const friendly = toUserFriendlyError(err);
        sendEvent({
          type: 'agent_error',
          message: friendly.message,
          timestamp: Date.now(),
        });
        response.write(`event: error\ndata: ${JSON.stringify(friendly)}\n\n`);
        response.end();
      },
    });

    response.on('close', () => {
      progressSub.unsubscribe();
    });
  }

  @Get('status')
  getAgentStatus() {
    return this.agentsService.getAgentStatus();
  }

  @Get('config')
  getOrchestratorConfig() {
    return this.agentsService.getOrchestratorConfig();
  }
}
