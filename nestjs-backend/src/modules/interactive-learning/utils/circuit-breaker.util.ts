import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxAttempts: number;
  monitoringWindowMs: number;
}

export const DefaultCircuitBreakerConfig: CircuitBreakerConfig = {
  failureThreshold: 3,
  resetTimeoutMs: 30000,
  halfOpenMaxAttempts: 1,
  monitoringWindowMs: 60000,
};

@Injectable()
export class CircuitBreaker<T> implements OnModuleDestroy {
  private readonly logger = new Logger(CircuitBreaker.name);

  private state: CircuitState = CircuitState.CLOSED;

  private failureCount: number = 0;

  private successCount: number = 0;

  private lastFailureTime: Date | null = null;

  private lastSuccessfulResult: T | null = null;

  private circuitStateSubject$ = new Subject<CircuitState>();

  constructor(
    private readonly serviceName: string,
    private readonly config: CircuitBreakerConfig = DefaultCircuitBreakerConfig,
  ) {
    this.circuitStateSubject$.pipe(debounceTime(1000)).subscribe((state) => {
      this.logger.debug(`Circuit breaker [${this.serviceName}] state changed to: ${state}`);
    });
  }

  async execute(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      this.checkResetCondition();
      if (this.state === CircuitState.OPEN) {
        this.logger.warn(`Circuit breaker [${this.serviceName}] is OPEN, using fallback`);
        return fallback ? fallback() : this.getLastSuccessfulOrThrow();
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      this.lastSuccessfulResult = result;
      return result;
    } catch (error) {
      this.onFailure(error);
      return fallback ? fallback() : this.getLastSuccessfulOrThrow();
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getHealthStatus(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: Date | null;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.logger.log(`Circuit breaker [${this.serviceName}] manually reset`);
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      this.logger.log(`Circuit breaker [${this.serviceName}] recovered (HALF_OPEN -> CLOSED)`);
    }

    this.successCount++;
    this.circuitStateSubject$.next(this.state);
  }

  private onFailure(error: any): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    this.logger.error(
      `Circuit breaker [${this.serviceName}] failure #${this.failureCount}: ${error.message}`,
    );

    if (
      this.state === CircuitState.HALF_OPEN ||
      this.failureCount >= this.config.failureThreshold
    ) {
      this.state = CircuitState.OPEN;
      this.logger.warn(`Circuit breaker [${this.serviceName}] opened due to failures`);
    }

    this.circuitStateSubject$.next(this.state);
  }

  private checkResetCondition(): void {
    if (
      this.lastFailureTime &&
      Date.now() - this.lastFailureTime.getTime() >= this.config.resetTimeoutMs
    ) {
      this.state = CircuitState.HALF_OPEN;
      this.logger.log(`Circuit breaker [${this.serviceName}] transitioning to HALF_OPEN`);
    }
  }

  private getLastSuccessfulOrThrow(): T {
    if (this.lastSuccessfulResult) {
      return this.lastSuccessfulResult;
    }
    throw new Error(`Service ${this.serviceName} unavailable and no cached result exists`);
  }

  onModuleDestroy(): void {
    this.circuitStateSubject$.complete();
  }
}
