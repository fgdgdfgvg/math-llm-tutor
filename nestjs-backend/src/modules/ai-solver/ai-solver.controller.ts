import { Controller, Post, Body } from '@nestjs/common';
import { AiSolverService, SolveProblemDto } from './ai-solver.service';

// 设置此控制器的基础路由为 'ai-solver'
// 意味着所有此处的路由都会以 /ai-solver 开头
@Controller('ai-solver')
export class AiSolverController {
  // 通过构造函数注入 AiSolverService
  constructor(private readonly aiSolverService: AiSolverService) {}

  // 定义一个处理 POST 请求的路由，路径为 /ai-solver/solve
  @Post('solve')
  async solve(
    // @Body() 会自动提取请求体中的JSON数据，并根据 SolveProblemDto 的定义进行验证
    @Body() solveProblemDto: SolveProblemDto,
  ) {
    // 调用服务层的 solve 方法，并将前端传来的数据整个传递过去
    return this.aiSolverService.solve(solveProblemDto);
  }
}
