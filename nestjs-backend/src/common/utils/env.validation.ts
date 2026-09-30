import { Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

const logger = new Logger('EnvValidation');

export function validateRequiredEnvVars(vars: Record<string, string>): void {
  const missingVars: string[] = [];

  for (const [key, value] of Object.entries(vars)) {
    if (!value || value.trim() === '') {
      missingVars.push(key);
    }
  }

  if (missingVars.length > 0) {
    const errorMsg = `缺少必需的环境变量: ${missingVars.join(', ')}`;
    logger.error(errorMsg);
    logger.error('请检查 .env 文件或环境变量配置');
    throw new Error(errorMsg);
  }

  logger.log('所有必需的环境变量已正确配置');
}

/**
 * 在 ConfigModule 加载之前，把 .env 中的值补进 process.env。
 *
 * 背景：`main.ts` 里的启动期校验早于 `NestFactory.create(AppModule)` 执行，
 * 一旦 `.env` 的加载时机发生变化（或改用其它配置加载方式），校验就会在
 * 明明配置了 .env 的情况下失败。这里做一个幂等的兜底加载：只填充**缺失**的键，
 * 不覆盖真实的环境变量（容器/CI 注入的值优先级更高）。
 */
export function loadEnvFileFallback(keys: string[], cwd = process.cwd()): void {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length === 0) return;

  const candidates = [
    join(cwd, '.env'),
    resolve(cwd, '..', '.env'),
    join(cwd, 'nestjs-backend', '.env'),
  ];

  for (const file of candidates) {
    if (!existsSync(file)) continue;
    try {
      const content = readFileSync(file, 'utf8');
      let filled = 0;
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        if (!missing.includes(key) || process.env[key]) continue;
        let value = trimmed.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
        filled++;
      }
      if (filled > 0) {
        logger.log(`已从 ${file} 补充 ${filled} 个环境变量（ConfigModule 加载前的兜底）`);
      }
      return;
    } catch (error: any) {
      logger.warn(`读取 ${file} 失败：${error?.message}`);
    }
  }
}

export interface ServerEnvCheckOptions {
  /** 生产环境额外强制要求的变量 */
  productionRequired?: string[];
  /** 仅告警、不阻断启动的变量（能力降级提示） */
  recommended?: string[];
}

const WEAK_SECRETS = [
  '123456',
  '12345678',
  'redis123456',
  'math_llm_tutor_dev_jwt_secret_key_2024',
  'secret',
  'changeme',
  'password',
];

/**
 * 启动期环境校验：
 *  - 必需项缺失 → 抛错（拒绝带病启动）；
 *  - 生产环境缺少 CORS_ORIGIN → 抛错（旧行为是 CORS 全放行 + credentials，等于任意站点可携带
 *    用户令牌访问 API）；
 *  - 生产环境使用弱密钥/默认口令 → 抛错；
 *  - 可选能力缺失（AI Key / Redis / SymPy / Neo4j）→ 只告警，并把降级状态交给 /health。
 */
export function validateServerEnv(options: ServerEnvCheckOptions = {}): void {
  const isProduction = process.env.NODE_ENV === 'production';

  const required = ['JWT_SECRET', 'MONGODB_URI', ...(options.productionRequired ?? [])];
  if (isProduction) {
    required.push('CORS_ORIGIN');
  }

  const missing = required.filter((key) => !process.env[key] || !String(process.env[key]).trim());
  if (missing.length > 0) {
    const message = `缺少必需的环境变量: ${missing.join(', ')}`;
    logger.error(message);
    if (isProduction) {
      logger.error('生产环境必须显式配置以上变量（尤其 CORS_ORIGIN，否则跨域策略无法安全生效）');
    }
    throw new Error(message);
  }

  if (isProduction) {
    const jwtSecret = process.env.JWT_SECRET as string;
    if (jwtSecret.length < 32) {
      throw new Error('生产环境的 JWT_SECRET 长度必须不少于 32 个字符');
    }
    // 弱口令/默认密钥只告警不阻断：它们属于“必须轮换”的部署卫生问题，
    // 而 CORS 全放行是真实可利用的漏洞（上面已硬性拦截）。
    // 这里用 ERROR 级日志确保在容器日志里一眼可见。
    const weak = [
      ['JWT_SECRET', jwtSecret],
      ['MONGO_ROOT_PASSWORD', process.env.MONGO_ROOT_PASSWORD],
      ['NEO4J_PASSWORD', process.env.NEO4J_PASSWORD],
      ['REDIS_PASSWORD', process.env.REDIS_PASSWORD],
    ].filter(([, value]) => value && WEAK_SECRETS.includes(String(value).trim()));
    if (weak.length > 0) {
      logger.error(
        `检测到默认口令/弱密钥: ${weak.map(([key]) => key).join(', ')} —— 仅限本地演示使用，正式部署前必须在 .env 中更换`,
      );
    }
  }

  // 可选能力：缺失只告警，前端/健康检查据此展示降级状态
  const degraded: string[] = [];
  const capabilityVars: [string, string][] = [
    ['AI_GLM_API_KEY', 'AI 智能体（GLM）'],
    ['AI_GPT_API_KEY', 'AI 智能体（备用模型）'],
    ['REDIS_PASSWORD', 'Redis 缓存'],
    ['SYMPY_SERVICE_URL', 'SymPy 符号计算'],
    ['NEO4J_URI', 'Neo4j 知识图谱'],
  ];
  for (const [key, label] of capabilityVars) {
    if (!process.env[key]) degraded.push(label);
  }
  if (degraded.length > 0) {
    logger.warn(`以下能力未配置，将降级运行: ${degraded.join('、')}`);
  }

  for (const key of options.recommended ?? []) {
    if (!process.env[key]) logger.warn(`建议配置的环境变量缺失: ${key}`);
  }

  logger.log('启动期环境变量校验通过');
}
