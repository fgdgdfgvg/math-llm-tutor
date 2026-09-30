import { HttpModule, HttpService } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SympyService } from './sympy.service';
import { SympyController } from './sympy.controller';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        baseURL:
          configService.get<string>('SYMPY_SERVICE_URL') ||
          'http://localhost:8000',
        timeout: 30000,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [SympyController],
  providers: [SympyService],
  exports: [SympyService],
})
export class SympyModule {}
