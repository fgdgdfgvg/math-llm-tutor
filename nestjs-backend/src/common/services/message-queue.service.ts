import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { RedisCacheService } from './redis-cache.service';

export enum TaskPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

export enum TaskStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
  CANCELLED = 'cancelled',
}

export interface QueueTask<T = any> {
  id: string;
  type: string;
  payload: T;
  priority: TaskPriority;
  status: TaskStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  result?: any;
  metadata?: Record<string, any>;
}

export interface QueueStats {
  totalQueued: number;
  totalProcessing: number;
  totalCompleted: number;
  totalFailed: number;
  throughput: number;
  avgLatency: number;
  queueSize: number;
  byType: Record<string, { queued: number; processing: number; failed: number }>;
}

const QUEUE_PREFIX = 'mq:';

@Injectable()
export class MessageQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(MessageQueueService.name);
  private readonly queues = new Map<string, QueueTask[]>();
  private readonly processing = new Map<string, QueueTask>();
  private readonly taskSubjects = new Map<string, Subject<QueueTask>>();
  private readonly handlers = new Map<string, (task: QueueTask) => Promise<any>>();
  private processingInterval: NodeJS.Timeout | null = null;
  private completedCount = 0;
  private failedCount = 0;
  private latencySamples: number[] = [];
  private maxConcurrency = 5;
  private activeProcessing = 0;

  constructor(private readonly redisCache?: RedisCacheService) {
    this.startWorker();
  }

  private startWorker(): void {
    this.processingInterval = setInterval(() => {
      this.processNext();
    }, 100);
  }

  registerHandler(taskType: string, handler: (task: QueueTask) => Promise<any>): void {
    this.handlers.set(taskType, handler);
    this.logger.log(`注册消息处理器: ${taskType}`);
  }

  enqueue<T>(
    type: string,
    payload: T,
    options: {
      priority?: TaskPriority;
      maxAttempts?: number;
      metadata?: Record<string, any>;
    } = {},
  ): string {
    const task: QueueTask<T> = {
      id: this.generateTaskId(),
      type,
      payload,
      priority: options.priority ?? TaskPriority.NORMAL,
      status: TaskStatus.QUEUED,
      attempts: 0,
      maxAttempts: options.maxAttempts ?? 3,
      createdAt: Date.now(),
      metadata: options.metadata,
    };

    if (!this.queues.has(type)) {
      this.queues.set(type, []);
    }

    const queue = this.queues.get(type)!;
    queue.push(task);
    queue.sort((a, b) => b.priority - a.priority);

    this.emitTaskEvent(task.id, task);
    this.logger.debug(`任务入队: ${task.id} (${type})`);

    return task.id;
  }

  enqueueBatch<T>(
    type: string,
    payloads: T[],
    options: {
      priority?: TaskPriority;
      maxAttempts?: number;
      metadata?: Record<string, any>;
    } = {},
  ): string[] {
    return payloads.map((payload) => this.enqueue(type, payload, options));
  }

  private async processNext(): Promise<void> {
    if (this.activeProcessing >= this.maxConcurrency) return;

    for (const [type, queue] of this.queues) {
      if (queue.length === 0) continue;
      const handler = this.handlers.get(type);
      if (!handler) {
        this.logger.warn(`没有找到类型 "${type}" 的处理器，跳过`);
        continue;
      }

      const task = queue.shift()!;
      if (!task) continue;

      this.activeProcessing++;
      task.status = TaskStatus.PROCESSING;
      task.startedAt = Date.now();
      task.attempts++;
      this.processing.set(task.id, task);

      try {
        const result = await handler(task);
        task.status = TaskStatus.COMPLETED;
        task.completedAt = Date.now();
        task.result = result;
        this.completedCount++;
        this.recordLatency(task.completedAt - task.createdAt);
        this.processing.delete(task.id);
        this.emitTaskEvent(task.id, task);
        this.logger.debug(`任务完成: ${task.id}`);
      } catch (err) {
        const errorMsg = (err as Error).message;
        if (task.attempts < task.maxAttempts) {
          task.status = TaskStatus.RETRYING;
          task.error = errorMsg;
          const queue = this.queues.get(type) || [];
          queue.unshift(task);
          this.queues.set(type, queue);
          this.logger.warn(`任务重试: ${task.id} (${task.attempts}/${task.maxAttempts})`);
        } else {
          task.status = TaskStatus.FAILED;
          task.error = errorMsg;
          task.completedAt = Date.now();
          this.failedCount++;
          this.processing.delete(task.id);
          this.emitTaskEvent(task.id, task);
          this.logger.error(`任务失败: ${task.id} - ${errorMsg}`);
        }
      } finally {
        this.activeProcessing--;
      }
      return;
    }
  }

  getTask(taskId: string): QueueTask | undefined {
    for (const queue of this.queues.values()) {
      const found = queue.find((t) => t.id === taskId);
      if (found) return found;
    }
    return this.processing.get(taskId);
  }

  observeTask(taskId: string): Observable<QueueTask> {
    if (!this.taskSubjects.has(taskId)) {
      this.taskSubjects.set(taskId, new Subject<QueueTask>());
    }
    return this.taskSubjects.get(taskId)!.asObservable();
  }

  cancelTask(taskId: string): boolean {
    for (const [type, queue] of this.queues) {
      const idx = queue.findIndex((t) => t.id === taskId);
      if (idx >= 0) {
        const task = queue.splice(idx, 1)[0];
        task.status = TaskStatus.CANCELLED;
        task.completedAt = Date.now();
        this.emitTaskEvent(taskId, task);
        return true;
      }
    }
    return false;
  }

  getStats(): QueueStats {
    let totalQueued = 0;
    let totalProcessing = 0;
    const byType: QueueStats['byType'] = {};

    for (const [type, queue] of this.queues) {
      totalQueued += queue.length;
      if (!byType[type]) byType[type] = { queued: 0, processing: 0, failed: 0 };
      byType[type].queued = queue.length;
    }

    totalProcessing = this.processing.size;
    for (const [id, task] of this.processing) {
      const type = task.type;
      if (!byType[type]) byType[type] = { queued: 0, processing: 0, failed: 0 };
      byType[type].processing++;
    }

    const avgLatency =
      this.latencySamples.length > 0
        ? this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length
        : 0;

    const throughput =
      this.latencySamples.length > 0
        ? (this.completedCount / this.latencySamples.length) * 1000
        : 0;

    return {
      totalQueued,
      totalProcessing,
      totalCompleted: this.completedCount,
      totalFailed: this.failedCount,
      throughput,
      avgLatency,
      queueSize: totalQueued + totalProcessing,
      byType,
    };
  }

  setMaxConcurrency(n: number): void {
    this.maxConcurrency = Math.max(1, n);
    this.logger.log(`最大并发数设置为: ${this.maxConcurrency}`);
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private emitTaskEvent(taskId: string, task: QueueTask): void {
    const subject = this.taskSubjects.get(taskId);
    if (subject) {
      subject.next(task);
      if (
        task.status === TaskStatus.COMPLETED ||
        task.status === TaskStatus.FAILED ||
        task.status === TaskStatus.CANCELLED
      ) {
        subject.complete();
        this.taskSubjects.delete(taskId);
      }
    }
  }

  private recordLatency(latency: number): void {
    this.latencySamples.push(latency);
    if (this.latencySamples.length > 1000) {
      this.latencySamples.shift();
    }
  }

  onModuleDestroy(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    for (const subject of this.taskSubjects.values()) {
      subject.complete();
    }
    this.taskSubjects.clear();
    this.logger.log('消息队列服务已关闭');
  }
}
