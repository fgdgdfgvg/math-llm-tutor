import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ICacheManager } from '../interfaces/interactive-learning.interfaces';
import type { CacheConfig } from '../types/interactive-learning.schemas';
import { DefaultCacheConfig } from '../types/interactive-learning.schemas';

interface CacheEntry<T> {
  value: T;
  timestamp: Date;
  ttl: number;
}

@Injectable()
export class InMemoryCacheManager implements ICacheManager, OnModuleDestroy {
  private readonly logger = new Logger(InMemoryCacheManager.name);

  private cache = new Map<string, CacheEntry<any>>();

  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private config: CacheConfig = DefaultCacheConfig) {
    this.startCleanupInterval();
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const ttl = ttlMs ?? this.config.ttlMs;

    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      timestamp: new Date(),
      ttl,
    });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.logger.log('Cache cleared');
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.cache.keys());

    if (!pattern) return allKeys;

    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));

    return allKeys.filter((key) => regex.test(key));
  }

  getStats(): {
    size: number;
    maxSize: number;
    hitRate?: number;
    keys: string[];
  } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      keys: Array.from(this.cache.keys()),
    };
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    const age = Date.now() - entry.timestamp.getTime();
    return age > entry.ttl;
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp.getTime() < oldestTime) {
        oldestTime = entry.timestamp.getTime();
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.logger.debug(`Evicted LRU cache entry: ${oldestKey}`);
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 60 * 1000);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  private cleanupExpired(): void {
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        count++;
      }
    }

    if (count > 0) {
      this.logger.debug(`Cleaned up ${count} expired cache entries`);
    }
  }

  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

/**
 * 进程级共享缓存实例。
 * 认知状态由 DynamicKnowledgeGraphService 计算并缓存，但练习数据的写入方在
 * student 模块；只有共享同一个实例，练习后才能真正失效缓存，
 * 否则学生刚做完题看到的学习评估还是 5 分钟前的旧结果。
 */
export const sharedCacheManager = new InMemoryCacheManager();

/** 认知状态的缓存键（务必与读写双方一致） */
export const cognitiveStateCacheKey = (userId: string): string =>
  `cognitive:${userId}`;
