import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MultimodalService } from './multimodal.service';
import { MultimodalController } from './multimodal.controller';

@Module({
  imports: [HttpModule],
  providers: [MultimodalService],
  controllers: [MultimodalController],
  exports: [MultimodalService],
})
export class MultimodalModule {}
