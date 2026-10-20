import { Controller, Get, Post, Param } from '@nestjs/common';
import { Public } from '../auth/guards/global-auth.guard';
import { RecoveryService, ServiceStatus } from './recovery.service';

@Controller('recovery')
export class RecoveryController {
  constructor(private readonly recoveryService: RecoveryService) {}

  @Get('status')
  @Public()
  async getRecoveryStatus(): Promise<Record<string, ServiceStatus>> {
    return this.recoveryService.getRecoveryStatus();
  }

  @Post('force/:serviceName')
  @Public()
  async forceRecovery(
    @Param('serviceName') serviceName: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.recoveryService.forceRecovery(serviceName);
  }
}
