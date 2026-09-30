import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { SympyService } from './sympy.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';

@Controller('sympy')
export class SympyController {
  constructor(private readonly sympyService: SympyService) {}

  @Get('health')
  async healthCheck() {
    const isHealthy = await this.sympyService.healthCheck();
    return { status: isHealthy ? 'healthy' : 'unhealthy' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('simplify')
  async simplify(@Body('expr') expr: string) {
    return this.sympyService.simplify(expr);
  }

  @UseGuards(JwtAuthGuard)
  @Post('expand')
  async expand(@Body('expr') expr: string) {
    return this.sympyService.expand(expr);
  }

  @UseGuards(JwtAuthGuard)
  @Post('factor')
  async factor(@Body('expr') expr: string) {
    return this.sympyService.factor(expr);
  }

  @UseGuards(JwtAuthGuard)
  @Post('derivative')
  async derivative(
    @Body('expr') expr: string,
    @Body('variable') variable: string,
    @Body('order') order?: number,
  ) {
    return this.sympyService.derivative(expr, variable, order || 1);
  }

  @UseGuards(JwtAuthGuard)
  @Post('integral')
  async integral(
    @Body('expr') expr: string,
    @Body('variable') variable: string,
    @Body('lower') lower?: string,
    @Body('upper') upper?: string,
  ) {
    return this.sympyService.integral(expr, variable, lower, upper);
  }

  @UseGuards(JwtAuthGuard)
  @Post('limit')
  async limit(
    @Body('expr') expr: string,
    @Body('variable') variable: string,
    @Body('approach') approach: string,
    @Body('direction') direction?: string,
  ) {
    // 默认双侧极限；显式传 '+' / '-' 才求单侧
    return this.sympyService.limit(expr, variable, approach, direction || '+-');
  }

  @UseGuards(JwtAuthGuard)
  @Post('solve')
  async solve(
    @Body('equation') equation: string,
    @Body('variable') variable: string,
  ) {
    return this.sympyService.solveEquation(equation, variable);
  }

  @UseGuards(JwtAuthGuard)
  @Post('series')
  async series(
    @Body('expr') expr: string,
    @Body('variable') variable: string,
    @Body('point') point?: string,
    @Body('n') n?: number,
  ) {
    return this.sympyService.series(expr, variable, point || '0', n || 6);
  }

  @UseGuards(JwtAuthGuard)
  @Post('calculate')
  async calculate(@Body('expr') expr: string) {
    return this.sympyService.calculate(expr);
  }

  @UseGuards(JwtAuthGuard)
  @Post('evaluate')
  async evaluate(
    @Body('expr') expr: string,
    @Body('variables') variables?: string[],
  ) {
    return this.sympyService.evaluate(expr, variables);
  }
}
