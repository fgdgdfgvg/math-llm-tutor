import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './core/auth/guards/global-auth.guard';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getApiInfo() {
    return {
      name: '数学AI导师 API',
      version: '1.0.0',
      description: '智能数学学习助手后端服务',
      endpoints: {
        'GET /': 'API 信息',
        'GET /health': '服务健康检查',
        'GET /api': '完整 API 文档',
        'GET /knowledge/concepts': '获取所有知识概念',
        'GET /knowledge/graph': '获取知识图谱',
        'POST /agents/solve': '智能体解题（需认证）',
        'POST /ai-solver/solve': 'AI 解题（需认证）',
        'POST /auth/login': '用户登录',
        'POST /auth/register': '用户注册',
      },
      services: {
        frontend: 'http://localhost:5173',
        backend: 'http://localhost:3000',
        sympy: 'http://localhost:8000',
        sympyDocs: 'http://localhost:8000/docs',
      },
    };
  }
}
