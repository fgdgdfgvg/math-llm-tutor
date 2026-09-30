import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'events';

export interface PoolConnection {
  id: string;
  createdAt: number;
  lastUsedAt: number;
  useCount: number;
  inUse: boolean;
  data?: any;
}

export interface PoolConfig {
  name: string;
  minConnections: number;
  maxConnections: number;
  maxIdleTimeMs: number;
  maxLifetimeMs: number;
  acquireTimeoutMs: number;
  healthCheckIntervalMs: number;
  createConnection: () => Promise<any>;
  destroyConnection: (conn: any) => Promise<void>;
  healthCheck: (conn: any) => Promise<boolean>;
}

export interface PoolStats {
  name: string;
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalCreated: number;
  totalDestroyed: number;
  totalAcquired: number;
  totalReleased: number;
  avgWaitTime: number;
  healthCheckPassed: number;
  healthCheckFailed: number;
}

@Injectable()
export class ConnectionPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(ConnectionPoolService.name);
  private readonly pools = new Map<string, PoolConfig>();
  private readonly connections = new Map<string, PoolConnection[]>();
  private readonly waitQueues = new Map<string, Array<(conn: any) => void>>();
  private readonly healthCheckTimers = new Map<string, NodeJS.Timeout>();
  private readonly idleCleanupTimers = new Map<string, NodeJS.Timeout>();
  private readonly poolStats = new Map<string, PoolStats>();
  private readonly poolEvents = new EventEmitter();

  registerPool(config: PoolConfig): void {
    if (this.pools.has(config.name)) {
      throw new Error(`连接池 "${config.name}" 已注册`);
    }

    this.pools.set(config.name, config);
    this.connections.set(config.name, []);
    this.waitQueues.set(config.name, []);
    this.poolStats.set(config.name, {
      name: config.name,
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      totalCreated: 0,
      totalDestroyed: 0,
      totalAcquired: 0,
      totalReleased: 0,
      avgWaitTime: 0,
      healthCheckFailed: 0,
      healthCheckPassed: 0,
    });

    this.initializeMinConnections(config);
    this.startHealthCheck(config);
    this.startIdleCleanup(config);

    this.logger.log(`连接池 "${config.name}" 已注册 (min=${config.minConnections}, max=${config.maxConnections})`);
  }

  private async initializeMinConnections(config: PoolConfig): Promise<void> {
    for (let i = 0; i < config.minConnections; i++) {
      await this.createConnection(config.name);
    }
  }

  private async createConnection(poolName: string): Promise<PoolConnection> {
    const config = this.pools.get(poolName);
    if (!config) throw new Error(`连接池 "${poolName}" 不存在`);

    const conns = this.connections.get(poolName)!;
    if (conns.length >= config.maxConnections) {
      throw new Error(`连接池 "${poolName}" 已达最大连接数 (${config.maxConnections})`);
    }

    const conn: PoolConnection = {
      id: this.generateConnId(poolName),
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      useCount: 0,
      inUse: false,
    };

    conn.data = await config.createConnection();
    conns.push(conn);

    const stats = this.poolStats.get(poolName)!;
    stats.totalConnections++;
    stats.totalCreated++;
    stats.idleConnections++;

    this.poolEvents.emit('connectionCreated', { pool: poolName, connId: conn.id });
    return conn;
  }

  async acquire(poolName: string): Promise<any> {
    const config = this.pools.get(poolName);
    if (!config) throw new Error(`连接池 "${poolName}" 不存在`);

    const conns = this.connections.get(poolName)!;
    const waitStart = Date.now();
    const stats = this.poolStats.get(poolName)!;

    const idleConn = conns.find((c) => !c.inUse);
    if (idleConn) {
      idleConn.inUse = true;
      idleConn.lastUsedAt = Date.now();
      idleConn.useCount++;
      stats.activeConnections++;
      stats.idleConnections--;
      stats.totalAcquired++;
      return idleConn.data;
    }

    if (conns.length < config.maxConnections) {
      const newConn = await this.createConnection(poolName);
      newConn.inUse = true;
      newConn.useCount++;
      stats.activeConnections++;
      stats.idleConnections--;
      stats.totalAcquired++;
      return newConn.data;
    }

    return new Promise((resolve, reject) => {
      const waitQueue = this.waitQueues.get(poolName)!;
      stats.waitingRequests++;

      const timeout = setTimeout(() => {
        const idx = waitQueue.indexOf(resolve as any);
        if (idx >= 0) waitQueue.splice(idx, 1);
        stats.waitingRequests--;
        reject(new Error(`获取连接超时 (${config.acquireTimeoutMs}ms)`));
      }, config.acquireTimeoutMs);

      waitQueue.push((conn: any) => {
        clearTimeout(timeout);
        stats.waitingRequests--;
        const waitTime = Date.now() - waitStart;
        stats.avgWaitTime =
          (stats.avgWaitTime * (stats.totalAcquired - 1) + waitTime) /
          stats.totalAcquired;
        resolve(conn);
      });
    });
  }

  async release(poolName: string, connection: any): Promise<void> {
    const config = this.pools.get(poolName);
    if (!config) throw new Error(`连接池 "${poolName}" 不存在`);

    const conns = this.connections.get(poolName)!;
    const conn = conns.find((c) => c.data === connection);
    if (!conn) {
      this.logger.warn(`尝试释放不属于连接池 "${poolName}" 的连接`);
      return;
    }

    conn.inUse = false;
    conn.lastUsedAt = Date.now();

    const stats = this.poolStats.get(poolName)!;
    stats.activeConnections--;
    stats.idleConnections++;
    stats.totalReleased++;

    const waitQueue = this.waitQueues.get(poolName)!;
    if (waitQueue.length > 0) {
      const resolve = waitQueue.shift()!;
      conn.inUse = true;
      conn.lastUsedAt = Date.now();
      conn.useCount++;
      stats.activeConnections++;
      stats.idleConnections--;
      stats.totalAcquired++;
      resolve(conn.data);
    }
  }

  async withConnection<T>(
    poolName: string,
    fn: (conn: any) => Promise<T>,
  ): Promise<T> {
    const conn = await this.acquire(poolName);
    try {
      return await fn(conn);
    } finally {
      await this.release(poolName, conn);
    }
  }

  private startHealthCheck(config: PoolConfig): void {
    const timer = setInterval(async () => {
      const conns = this.connections.get(config.name) || [];
      for (const conn of conns) {
        try {
          const healthy = await config.healthCheck(conn.data);
          const stats = this.poolStats.get(config.name)!;
          if (!healthy) {
            stats.healthCheckFailed++;
            this.logger.warn(`连接池 "${config.name}" 连接 ${conn.id} 健康检查失败`);
            await this.destroyConnection(config.name, conn);
            if (!conn.inUse && conns.length < config.minConnections) {
              await this.createConnection(config.name);
            }
          } else {
            stats.healthCheckPassed++;
          }
        } catch {
          const stats = this.poolStats.get(config.name)!;
          stats.healthCheckFailed++;
        }
      }
    }, config.healthCheckIntervalMs);

    this.healthCheckTimers.set(config.name, timer);
  }

  private startIdleCleanup(config: PoolConfig): void {
    const timer = setInterval(() => {
      const conns = this.connections.get(config.name) || [];
      const now = Date.now();
      const toRemove: PoolConnection[] = [];

      for (const conn of conns) {
        if (conn.inUse) continue;
        if (now - conn.lastUsedAt > config.maxIdleTimeMs) {
          if (conns.length > config.minConnections) {
            toRemove.push(conn);
          }
        }
        if (now - conn.createdAt > config.maxLifetimeMs) {
          toRemove.push(conn);
        }
      }

      for (const conn of toRemove) {
        this.destroyConnection(config.name, conn);
      }
    }, 30000);

    this.idleCleanupTimers.set(config.name, timer);
  }

  private async destroyConnection(poolName: string, conn: PoolConnection): Promise<void> {
    const config = this.pools.get(poolName);
    if (!config) return;

    const conns = this.connections.get(poolName)!;
    const idx = conns.indexOf(conn);
    if (idx >= 0) conns.splice(idx, 1);

    const stats = this.poolStats.get(poolName)!;
    stats.totalConnections--;
    stats.totalDestroyed++;
    if (conn.inUse) stats.activeConnections--;
    else stats.idleConnections--;

    try {
      await config.destroyConnection(conn.data);
    } catch (err) {
      this.logger.error(`销毁连接 "${conn.id}" 失败: ${(err as Error).message}`);
    }

    this.poolEvents.emit('connectionDestroyed', { pool: poolName, connId: conn.id });
  }

  getStats(poolName: string): PoolStats | undefined {
    return this.poolStats.get(poolName);
  }

  getAllStats(): PoolStats[] {
    return Array.from(this.poolStats.values());
  }

  getPoolNames(): string[] {
    return Array.from(this.pools.keys());
  }

  unregisterPool(poolName: string): void {
    const config = this.pools.get(poolName);
    if (!config) return;

    const hcTimer = this.healthCheckTimers.get(poolName);
    if (hcTimer) clearInterval(hcTimer);

    const icTimer = this.idleCleanupTimers.get(poolName);
    if (icTimer) clearInterval(icTimer);

    const conns = this.connections.get(poolName) || [];
    for (const conn of conns) {
      config.destroyConnection(conn.data).catch(() => {});
    }

    this.pools.delete(poolName);
    this.connections.delete(poolName);
    this.waitQueues.delete(poolName);
    this.poolStats.delete(poolName);
    this.healthCheckTimers.delete(poolName);
    this.idleCleanupTimers.delete(poolName);

    this.logger.log(`连接池 "${poolName}" 已注销`);
  }

  private generateConnId(poolName: string): string {
    return `${poolName}_conn_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`;
  }

  onModuleDestroy(): void {
    const poolNames = Array.from(this.pools.keys());
    for (const name of poolNames) {
      this.unregisterPool(name);
    }
    this.logger.log('所有连接池已关闭');
  }
}
