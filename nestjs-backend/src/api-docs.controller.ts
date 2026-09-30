import { Controller, Get } from '@nestjs/common';

@Controller()
export class ApiDocsController {
  @Get()
  getApiInfo() {
    return {
      name: '数学AI导师 API',
      version: '1.0.0',
      description: '智能数学学习助手后端服务',
      endpoints: {
        'GET /': 'API 信息',
        'GET /health': '服务健康检查',
        'GET /knowledge/concepts': '获取所有知识概念',
        'GET /knowledge/graph': '获取知识图谱',
        'GET /knowledge/status': '知识图谱服务状态',
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

  @Get('api')
  getFullApiDocs() {
    return {
      name: '数学AI导师 API 文档',
      version: '1.0.0',
      modules: {
        auth: {
          prefix: '/auth',
          endpoints: [
            {
              method: 'POST',
              path: '/login',
              description: '用户登录',
              auth: false,
            },
            {
              method: 'POST',
              path: '/register',
              description: '用户注册',
              auth: false,
            },
            {
              method: 'GET',
              path: '/profile',
              description: '获取用户信息',
              auth: true,
            },
          ],
        },
        knowledge: {
          prefix: '/knowledge',
          endpoints: [
            {
              method: 'GET',
              path: '/concepts',
              description: '获取所有知识概念',
              auth: false,
            },
            {
              method: 'GET',
              path: '/concepts/:id',
              description: '获取单个概念',
              auth: false,
            },
            {
              method: 'GET',
              path: '/concepts/:id/prerequisites',
              description: '获取前置知识',
              auth: false,
            },
            {
              method: 'GET',
              path: '/concepts/:id/learning-path',
              description: '获取学习路径',
              auth: false,
            },
            {
              method: 'GET',
              path: '/graph',
              description: '获取完整知识图谱',
              auth: false,
            },
            {
              method: 'GET',
              path: '/status',
              description: '知识图谱服务状态',
              auth: false,
            },
            {
              method: 'POST',
              path: '/concepts',
              description: '创建新概念',
              auth: true,
            },
          ],
        },
        agents: {
          prefix: '/agents',
          description: '多智能体解题系统',
          endpoints: [
            {
              method: 'POST',
              path: '/solve',
              description: '智能体解题',
              auth: true,
              body: { problem: 'string', studentAnswer: 'string (可选)' },
            },
          ],
          supportedTypes: [
            'LIMIT',
            'DERIVATIVE',
            'INTEGRAL',
            'EQUATION',
            'SIMPLIFICATION',
          ],
          workflow: [
            'PlannerAgent → SolverAgent → DiagnoserAgent → FeedbackAgent',
          ],
        },
        aiSolver: {
          prefix: '/ai-solver',
          endpoints: [
            {
              method: 'POST',
              path: '/solve',
              description: 'AI 解题',
              auth: true,
              body: { prompt: 'string', model: 'DeepSeek | KatCoder' },
            },
          ],
        },
        sympy: {
          prefix: '/sympy',
          description: 'SymPy 符号计算服务代理',
          endpoints: [
            {
              method: 'GET',
              path: '/health',
              description: 'SymPy 服务健康检查',
              auth: false,
            },
            {
              method: 'POST',
              path: '/simplify',
              description: '化简表达式',
              auth: false,
            },
            {
              method: 'POST',
              path: '/derivative',
              description: '求导',
              auth: false,
            },
            {
              method: 'POST',
              path: '/integral',
              description: '积分',
              auth: false,
            },
            {
              method: 'POST',
              path: '/limit',
              description: '求极限',
              auth: false,
            },
            {
              method: 'POST',
              path: '/solve',
              description: '解方程',
              auth: false,
            },
          ],
        },
        student: {
          prefix: '/student/knowledge',
          description: '学生知识状态追踪',
          endpoints: [
            {
              method: 'GET',
              path: '/summary',
              description: '学习概况',
              auth: true,
            },
            {
              method: 'GET',
              path: '/progress',
              description: '学习进度',
              auth: true,
            },
            {
              method: 'GET',
              path: '/review',
              description: '待复习列表',
              auth: true,
            },
            {
              method: 'POST',
              path: '/practice',
              description: '记录练习',
              auth: true,
            },
          ],
        },
      },
    };
  }
}
