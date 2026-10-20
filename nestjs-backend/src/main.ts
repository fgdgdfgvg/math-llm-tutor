import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { json, urlencoded } from 'express';
import {
  loadEnvFileFallback,
  validateServerEnv,
} from './common/utils/env.validation';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { securityHeaders } from './common/middleware/security-headers.middleware';
import { gzipCompression } from './common/middleware/compression.middleware';
import { AppError } from './common/errors/app-error';
import { ErrorCode } from './common/errors/error-codes';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // 兜底加载 .env：启动期校验早于 ConfigModule 完成加载，只填充缺失的键，
  // 不覆盖容器/CI 注入的真实环境变量。
  loadEnvFileFallback([
    'JWT_SECRET',
    'MONGODB_URI',
    'CORS_ORIGIN',
    'REDIS_PASSWORD',
  ]);
  validateServerEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const isProduction = process.env.NODE_ENV === 'production';

  /**
   * 反向代理信任配置（安全敏感，默认关闭）。
   *
   * Express 默认**不信任** X-Forwarded-For，`req.ip` 取 socket 地址——这是安全默认：
   * 该头客户端可任意伪造，无条件采信等于取消限流（实测随机伪造该头可让 LLM 限流
   * 40/40 全部放行，见 common/guards/rate-limit.guard.ts 的说明）。
   *
   * 部署在 nginx / 网关之后时才应显式开启，值语义与 Express 的 trust proxy 一致：
   *   TRUST_PROXY=1                 → 信任最近一跳（本项目 compose 里 nginx 反代的场景）
   *   TRUST_PROXY=loopback,linklocal → 只信任本地/链路本地代理
   *   留空（默认）                   → 完全不信任，req.ip = socket 地址
   */
  const trustProxy = process.env.TRUST_PROXY?.trim();
  if (trustProxy) {
    const value: string | number = /^\d+$/.test(trustProxy)
      ? Number(trustProxy)
      : trustProxy;
    app.set('trust proxy', value);
    logger.log(
      `已启用反向代理信任（trust proxy = ${value}），req.ip 将按该策略解析 X-Forwarded-For`,
    );
  }

  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : isProduction
      ? []
      : [
          'http://localhost:3000',
          'http://localhost:5173',
          'http://localhost:4200',
        ];

  // 生产环境未配置 CORS_ORIGIN 时，旧代码会走 `corsOrigin.length === 0 → 放行任意来源`
  // 分支，配合 credentials: true 等于任何站点都能带用户凭证调 API。
  // 现在改为启动即失败（validateServerEnv 已校验，这里再拦一层以防被绕过）。
  if (isProduction && corsOrigin.length === 0) {
    throw new Error(
      '生产环境必须配置 CORS_ORIGIN（逗号分隔的允许来源列表），拒绝以“放行任意来源”的方式启动',
    );
  }

  /** 开发期本机调试入口（localhost / 127.0.0.1 / ::1，端口不限）都放行 */
  const isLocalDevOrigin = (origin: string): boolean => {
    if (isProduction) return false;
    try {
      const { hostname, protocol } = new URL(origin);
      return (
        (protocol === 'http:' || protocol === 'https:') &&
        ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)
      );
    } catch {
      return false;
    }
  };

  const corsMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];

  app.enableCors({
    origin: (origin, callback) => {
      // 无 Origin 头：同源请求、服务端到服务端、curl 等，不涉及浏览器跨域策略
      if (!origin) {
        callback(null, true);
        return;
      }
      if (corsOrigin.includes(origin) || isLocalDevOrigin(origin)) {
        callback(null, true);
        return;
      }
      // 不以错误消息回显具体 origin，避免把白名单探测当成信息泄露渠道。
      // 用 AppError(FORBIDDEN) 而不是裸 Error：裸 Error 会被全局过滤器归一化为
      // 500 InternalError，把一个"客户端来源不被允许"的正常拒绝记成服务端故障，
      // 污染错误日志与 5xx 监控（CORS 拒绝本就不该是 5xx）。
      logger.warn(`CORS 拒绝来源: ${origin}`);
      callback(new AppError(ErrorCode.FORBIDDEN, '请求来源不在允许列表中'));
    },
    credentials: true,
    methods: corsMethods,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400,
  });

  // 安全响应头（零依赖最小集）：nosniff / 防嵌入 / Referrer-Policy，生产另加 HSTS。
  // 放在最前面，保证错误响应（含 CORS 拒绝、校验失败）也带上这些头。
  app.use(securityHeaders(isProduction));

  // 响应压缩（零依赖 zlib）。必须早于所有会写响应体的中间件；
  // 内部已跳过 text/event-stream，因此不会破坏 /agents/solve/stream 的 SSE 推送。
  app.use(gzipCompression());

  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      // 每个属性只报第一条失败：空密码不会再叠报"密码过长"之类的荒谬提示（自检 P2-8），
      // 同时不放宽"必填字段缺失必须报错"的既有语义（比 skipUndefinedProperties 更安全）
      stopAtFirstError: true,
    }),
  );

  app.useGlobalInterceptors(new TransformInterceptor());

  // 优雅停机：收到 SIGTERM/SIGINT 时触发 onModuleDestroy，
  // 让 Mongo/Redis/Neo4j 连接与定时器得以及时释放（容器重建时不再靠超时硬杀）。
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('Math AI Tutor API')
    .setDescription(
      `
## 数学AI导师后端API文档

### 功能模块
- **认证模块**: 用户注册、登录、JWT认证
- **学生模块**: 学习进度、知识点掌握度、学习历史
- **AI解题模块**: 数学问题求解、错误诊断、学习建议
- **知识图谱模块**: 知识点关系、前置知识、学习路径
- **管理模块**: 用户管理、系统配置

### 认证方式
使用JWT Bearer Token认证，在请求头中添加：
\`\`\`
Authorization: Bearer <your_token>
\`\`\`

### 错误码说明
| 错误码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | 未授权，请先登录 |
| 403 | 禁止访问，权限不足 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
    `,
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('auth', '认证相关接口')
    .addTag('student', '学生学习相关接口')
    .addTag('agents', 'AI智能体接口')
    .addTag('knowledge', '知识图谱接口')
    .addTag('admin', '管理后台接口')
    .addTag('health', '健康检查接口')
    .build();

  /**
   * API 文档默认只在非生产环境注册。
   * Swagger 会完整枚举全部端点（含管理端），对公网等于一份现成的攻击面清单；
   * 内网部署确需开放时用 ENABLE_SWAGGER=true 显式打开。
   */
  const enableSwagger = process.env.ENABLE_SWAGGER === 'true' || !isProduction;

  if (enableSwagger) {
    const document = SwaggerModule.createDocument(app, config, {
      extraModels: [],
      ignoreGlobalPrefix: false,
    });

    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
      },
      customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { font-size: 28px; }
      .swagger-ui .opblock-tag { font-size: 18px; }
    `,
      customSiteTitle: 'Math AI Tutor API Docs',
    });
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');

  /**
   * keep-alive 调优。
   * Node 默认 server.keepAliveTimeout = 5s，比浏览器 / fetch(undici) 的空闲复用判定
   * 更早回收连接；客户端若正好复用一个刚被服务端关闭的连接，POST 会直接
   * ECONNRESET 丢失（GET 可自动重试，POST 不会）。表现为「放置一会儿后第一次
   * 提交偶发失败」。把服务端保活时间调到比任何客户端空闲判定都长，
   * headersTimeout 再留出余量，即可消除这个竞态。
   */
  const httpServer = app.getHttpServer();
  httpServer.keepAliveTimeout = Number(
    process.env.KEEP_ALIVE_TIMEOUT_MS || 65_000,
  );
  httpServer.headersTimeout = httpServer.keepAliveTimeout + 5_000;

  logger.log(`Application is running on: http://localhost:${port}`);
  if (enableSwagger) {
    logger.log(`Swagger documentation: http://localhost:${port}/api/docs`);
  } else {
    logger.log(
      'Swagger 文档未注册（生产环境默认关闭，可用 ENABLE_SWAGGER=true 打开）',
    );
  }
}
bootstrap();
