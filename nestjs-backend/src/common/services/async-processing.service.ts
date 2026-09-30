import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable, forkJoin, from, of, throwError, timer } from 'rxjs';
import { mergeMap, catchError, retry, timeout, map, tap } from 'rxjs/operators';

export interface AsyncTask<T = any> {
  id: string;
  name: string;
  execute: () => Promise<T>;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  metadata?: Record<string, any>;
}

export interface AsyncTaskResult<T = any> {
  taskId: string;
  success: boolean;
  result?: T;
  error?: string;
  durationMs: number;
  attempts: number;
}

export interface BatchProcessResult<T = any> {
  totalTasks: number;
  completed: number;
  failed: number;
  totalDurationMs: number;
  results: AsyncTaskResult<T>[];
  throughput: number;
}

@Injectable()
export class AsyncProcessingService {
  private readonly logger = new Logger(AsyncProcessingService.name);
  private readonly eventBus = new Subject<{ type: string; data: any }>();

  get eventStream(): Observable<{ type: string; data: any }> {
    return this.eventBus.asObservable();
  }

  async executeAsync<T>(task: AsyncTask<T>): Promise<AsyncTaskResult<T>> {
    const startTime = Date.now();
    let attempts = 0;
    const maxRetries = task.retries ?? 2;
    const retryDelay = task.retryDelayMs ?? 1000;

    while (attempts <= maxRetries) {
      attempts++;
      try {
        const resultPromise = task.execute();
        const result = task.timeoutMs
          ? await Promise.race([
              resultPromise,
              new Promise<T>((_, reject) =>
                setTimeout(
                  () => reject(new Error(`任务 "${task.name}" 超时 (${task.timeoutMs}ms)`)),
                  task.timeoutMs,
                ),
              ),
            ])
          : await resultPromise;

        const duration = Date.now() - startTime;
        return {
          taskId: task.id,
          success: true,
          result,
          durationMs: duration,
          attempts,
        };
      } catch (err) {
        const errorMsg = (err as Error).message;
        if (attempts <= maxRetries) {
          this.logger.warn(
            `任务 "${task.name}" 失败，第${attempts}次重试: ${errorMsg}`,
          );
          await this.delay(retryDelay * attempts);
        } else {
          const duration = Date.now() - startTime;
          return {
            taskId: task.id,
            success: false,
            error: errorMsg,
            durationMs: duration,
            attempts,
          };
        }
      }
    }

    return {
      taskId: task.id,
      success: false,
      error: '未知错误',
      durationMs: Date.now() - startTime,
      attempts,
    };
  }

  async executeParallel<T>(
    tasks: AsyncTask<T>[],
    maxConcurrency: number = 5,
  ): Promise<AsyncTaskResult<T>[]> {
    const results: AsyncTaskResult<T>[] = [];
    const queue = [...tasks];
    const inFlight: Promise<void>[] = [];

    const processNext = async (): Promise<void> => {
      while (queue.length > 0) {
        const task = queue.shift()!;
        const result = await this.executeAsync(task);
        results.push(result);
      }
    };

    for (let i = 0; i < Math.min(maxConcurrency, tasks.length); i++) {
      inFlight.push(processNext());
    }

    await Promise.all(inFlight);
    return results;
  }

  async processBatch<T>(
    tasks: AsyncTask<T>[],
    maxConcurrency: number = 5,
  ): Promise<BatchProcessResult<T>> {
    const startTime = Date.now();
    this.logger.log(`开始批处理: ${tasks.length} 个任务, 最大并发=${maxConcurrency}`);

    this.eventBus.next({
      type: 'batch:started',
      data: { totalTasks: tasks.length, maxConcurrency },
    });

    const results = await this.executeParallel(tasks, maxConcurrency);
    const completed = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const totalDuration = Date.now() - startTime;

    const throughput = totalDuration > 0
      ? Math.round((tasks.length / totalDuration) * 1000 * 100) / 100
      : 0;

    const batchResult: BatchProcessResult<T> = {
      totalTasks: tasks.length,
      completed,
      failed,
      totalDurationMs: totalDuration,
      results,
      throughput,
    };

    this.eventBus.next({
      type: 'batch:completed',
      data: { completed, failed, throughput, totalDuration },
    });

    this.logger.log(
      `批处理完成: ${completed}/${tasks.length} 成功, ${failed} 失败, 耗时${totalDuration}ms, 吞吐量${throughput}个/秒`,
    );

    return batchResult;
  }

  wrapAsAsyncTask<T>(
    name: string,
    fn: () => Promise<T>,
    options: {
      timeoutMs?: number;
      retries?: number;
      retryDelayMs?: number;
    } = {},
  ): AsyncTask<T> {
    return {
      id: this.generateId(),
      name,
      execute: fn,
      timeoutMs: options.timeoutMs ?? 60000,
      retries: options.retries ?? 2,
      retryDelayMs: options.retryDelayMs ?? 1000,
    };
  }

  debounce<T>(fn: () => Promise<T>, delayMs: number): () => Promise<T> {
    let pending: Promise<T> | null = null;
    let timer: NodeJS.Timeout | null = null;

    return () => {
      if (pending) return pending;

      pending = new Promise<T>((resolve, reject) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(async () => {
          try {
            const result = await fn();
            resolve(result);
          } catch (err) {
            reject(err);
          } finally {
            pending = null;
          }
        }, delayMs);
      });

      return pending;
    };
  }

  throttle<T>(fn: () => Promise<T>, minIntervalMs: number): () => Promise<T> {
    let lastCallTime = 0;
    let pendingCall: Promise<T> | null = null;

    return async () => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallTime;

      if (timeSinceLastCall >= minIntervalMs) {
        lastCallTime = now;
        try {
          return await fn();
        } catch (err) {
          throw err;
        }
      }

      if (pendingCall) return pendingCall;

      const delayMs = minIntervalMs - timeSinceLastCall;
      pendingCall = new Promise<T>(async (resolve, reject) => {
        await this.delay(delayMs);
        try {
          lastCallTime = Date.now();
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          pendingCall = null;
        }
      });

      return pendingCall;
    };
  }

  async race<T>(tasks: AsyncTask<T>[]): Promise<AsyncTaskResult<T>> {
    const promises = tasks.map((task) =>
      this.executeAsync(task).catch((err) => {
        throw { taskId: task.id, error: err };
      }),
    );

    try {
      return await Promise.race(promises);
    } catch (err: any) {
      return {
        taskId: err?.taskId || 'unknown',
        success: false,
        error: (err as Error)?.message || String(err),
        durationMs: 0,
        attempts: 0,
      };
    }
  }

  chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }
    return chunks;
  }

  async processChunked<T, R>(
    items: T[],
    chunkSize: number,
    processor: (chunk: T[]) => Promise<R[]>,
    maxConcurrency: number = 3,
  ): Promise<R[]> {
    const chunks = this.chunk(items, chunkSize);
    const tasks = chunks.map((chunk, idx) =>
      this.wrapAsAsyncTask(`chunk_${idx}`, () => processor(chunk), {
        retries: 1,
      }),
    );

    const batchResult = await this.processBatch(tasks, maxConcurrency);

    const results: R[] = [];
    for (const r of batchResult.results) {
      if (r.success && Array.isArray(r.result)) {
        results.push(...r.result);
      }
    }

    return results;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private generateId(): string {
    return `async_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
