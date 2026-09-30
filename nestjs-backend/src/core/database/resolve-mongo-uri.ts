import { Logger } from '@nestjs/common';
import { MongoClient } from 'mongodb';

const logger = new Logger('MongoDB');

/**
 * 常见坑：.env 里写的是带账号密码的 MONGODB_URI（docker compose 的 MongoDB 需要鉴权），
 * 但开发机上的 MongoDB 服务通常没开鉴权，于是启动时直接 Authentication failed 起不来。
 *
 * 这里先探测配置的 URI：能连通就用它；只有鉴权失败时才退回到同一台机器的无凭据连接，
 * 并打印明确警告，避免“换个环境就跑不起来”。
 */
export async function resolveMongoUri(configuredUri?: string): Promise<string> {
  const uri = (configuredUri || '').trim() || 'mongodb://localhost:27017/math_llm_tutor';

  const probe = await probeConnection(uri);
  if (probe.ok) return uri;

  const fallback = stripCredentials(uri);
  if (!fallback || fallback === uri) {
    logger.error(`无法连接 MongoDB：${probe.reason}`);
    return uri;
  }

  logger.warn(`MongoDB 连接失败（${probe.reason}），改用无凭据连接重试：${maskUri(fallback)}`);
  const retry = await probeConnection(fallback);
  if (retry.ok) {
    logger.warn('已改用无凭据连接的 MongoDB（本机 MongoDB 通常未开启鉴权）');
    return fallback;
  }

  logger.error(`无凭据连接同样失败：${retry.reason}`);
  return uri;
}

async function probeConnection(uri: string): Promise<{ ok: boolean; reason: string }> {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 4000, connectTimeoutMS: 4000 });
  try {
    await client.connect();
    await client.db().admin().ping();
    return { ok: true, reason: '' };
  } catch (error) {
    return { ok: false, reason: (error as Error).message };
  } finally {
    await client.close().catch(() => undefined);
  }
}

/** mongodb://user:pass@host/db?x=y → mongodb://host/db?x=y */
function stripCredentials(uri: string): string | null {
  try {
    const withoutScheme = uri.replace(/^mongodb(\+srv)?:\/\//, '');
    if (!withoutScheme.includes('@')) return null;
    const [, hostAndRest] = withoutScheme.split('@');
    return `mongodb://${hostAndRest}`;
  } catch {
    return null;
  }
}

function maskUri(uri: string): string {
  return uri.replace(/\/\/[^@]*@/, '//***@');
}
