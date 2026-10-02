import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { createHash } from 'crypto';

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: string;
}

@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private client: RedisClientType;
  private isConnected = false;
  private hits = 0;
  private misses = 0;
  private readonly defaultTTL: number;
  private readonly fallbackCache: Map<string, { value: string; expiresAt: number }>;

  constructor(private readonly configService: ConfigService) {
    this.defaultTTL = parseInt(this.configService.get('REDIS_TTL') || '3600', 10);
    this.fallbackCache = new Map();
  }

  async onModuleInit(): Promise<void> {
    const redisUrl = this.configService.get('REDIS_URL');
    const redisPassword = this.configService.get('REDIS_PASSWORD') || undefined;

    if (!redisUrl) {
      this.logger.log('Redis 未配置，使用内存缓存降级模式。如需启用，请在 .env 中设置 REDIS_URL。');
      this.isConnected = false;
      this.startFallbackCleanup();
      return;
    }

    try {
      this.client = createClient({
        url: redisUrl,
        password: redisPassword,
        socket: {
          connectTimeout: 5000,
          reconnectStrategy: (retries) => {
            if (retries > 5) {
              this.logger.warn('Redis重连失败次数过多，使用内存缓存降级');
              return false;
            }
            return Math.min(retries * 200, 3000);
          },
        },
      });

      this.client.on('error', (err) => {
        this.logger.warn(`Redis连接错误: ${err.message}`);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        this.logger.log('Redis连接成功');
        this.isConnected = true;
      });

      this.client.on('reconnecting', () => {
        this.logger.log('Redis正在重连...');
      });

      await this.client.connect();
      this.isConnected = true;
      this.logger.log(`Redis缓存服务初始化完成: ${redisUrl}`);
    } catch (error: any) {
      this.logger.warn(`Redis连接失败，使用内存缓存降级: ${error.message}`);
      this.isConnected = false;
      this.startFallbackCleanup();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.logger.log('Redis连接已关闭');
    }
  }

  generateKey(problem: string, context?: string): string {
    const normalized = problem.trim().toLowerCase().replace(/\s+/g, ' ');
    const hashInput = context ? `${normalized}|${context}` : normalized;
    const hash = createHash('md5').update(hashInput).digest('hex');
    return `math:cache:${hash}`;
  }

  async get(key: string): Promise<string | null> {
    if (this.isConnected) {
      try {
        const result = await this.client.get(key);
        if (result) {
          this.hits++;
          this.logger.debug(`Cache HIT: ${key.substring(0, 30)}...`);
          return result;
        }
        this.misses++;
        return null;
      } catch (error: any) {
        this.logger.warn(`Redis GET失败: ${error.message}`);
      }
    }

    const fallbackEntry = this.fallbackCache.get(key);
    if (fallbackEntry) {
      if (Date.now() > fallbackEntry.expiresAt) {
        this.fallbackCache.delete(key);
        this.misses++;
        return null;
      }
      this.hits++;
      return fallbackEntry.value;
    }
    this.misses++;
    return null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTTL;

    if (this.isConnected) {
      try {
        await this.client.set(key, value, { EX: ttl });
        return;
      } catch (error: any) {
        this.logger.warn(`Redis SET失败: ${error.message}`);
      }
    }

    this.fallbackCache.set(key, {
      value,
      expiresAt: Date.now() + ttl * 1000,
    });

    if (this.fallbackCache.size > 10000) {
      const oldestKey = this.fallbackCache.keys().next().value;
      if (oldestKey) this.fallbackCache.delete(oldestKey);
    }
  }

  /**
   * 原子性的 set-if-absent（Redis `SET NX EX`）。
   * 用途：分布式锁与幂等标记——refresh token 轮换的并发单飞依赖它。
   * 返回 true 表示写入成功（此前不存在），false 表示已存在。
   */
  async setIfAbsent(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    const ttl = ttlSeconds ?? this.defaultTTL;

    if (this.isConnected) {
      try {
        const result = await this.client.set(key, value, { EX: ttl, NX: true });
        if (result === 'OK') return true;
        return false;
      } catch (error: any) {
        this.logger.warn(`Redis SETNX失败: ${error.message}`);
        // 失败时落到内存兜底判断，保证单进程下语义仍然成立
      }
    }

    const existing = this.fallbackCache.get(key);
    if (existing && Date.now() <= existing.expiresAt) {
      return false;
    }
    this.fallbackCache.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
    return true;
  }

  async delete(key: string): Promise<void> {
    if (this.isConnected) {
      try {
        await this.client.del(key);
        return;
      } catch (error: any) {
        this.logger.warn(`Redis DEL失败: ${error.message}`);
      }
    }
    this.fallbackCache.delete(key);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    if (this.isConnected) {
      try {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(keys);
          this.logger.log(`已清除 ${keys.length} 个匹配 "${pattern}" 的缓存键`);
        }
      } catch (error: any) {
        this.logger.warn(`Redis KEYS/DEL失败: ${error.message}`);
      }
    } else {
      for (const key of this.fallbackCache.keys()) {
        if (key.includes(pattern.replace(/\*/g, ''))) {
          this.fallbackCache.delete(key);
        }
      }
    }
  }

  async getOrSet(
    key: string,
    factory: () => Promise<string>,
    ttlSeconds?: number,
  ): Promise<string> {
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(1) + '%' : '0.0%';
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.isConnected ? -1 : this.fallbackCache.size,
      hitRate,
    };
  }

  isAvailable(): boolean {
    return this.isConnected || this.fallbackCache.size >= 0;
  }

  /**
   * 是否真的连上了 Redis。
   * 健康检查需要区分两种"可用"：真连上 Redis（多实例安全），
   * 还是降级到进程内内存（refresh token / 限流状态只在本实例有效）。
   */
  isRedisConnected(): boolean {
    return this.isConnected;
  }

  private startFallbackCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.fallbackCache.entries()) {
        if (now > entry.expiresAt) {
          this.fallbackCache.delete(key);
        }
      }
    }, 60000);
  }
}
