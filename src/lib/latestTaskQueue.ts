export interface LatestTaskQueueOptions<T> {
  delayMs: number;
  run: (value: T) => Promise<void>;
  onError?: (error: unknown, value: T) => void;
}

/**
 * Debounces replaceable work and guarantees that only one task runs at a time.
 * Values queued while a task is running are collapsed to the latest value.
 */
export class LatestTaskQueue<T> {
  private readonly delayMs: number;
  private readonly runTask: (value: T) => Promise<void>;
  private readonly onError?: (error: unknown, value: T) => void;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingValue: T | undefined;
  private hasPendingValue = false;
  private activeDrain: Promise<void> | null = null;

  constructor({ delayMs, run, onError }: LatestTaskQueueOptions<T>) {
    this.delayMs = delayMs;
    this.runTask = run;
    this.onError = onError;
  }

  schedule(value: T): void {
    this.pendingValue = value;
    this.hasPendingValue = true;
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.drain();
    }, this.delayMs);
  }

  async flush(): Promise<void> {
    this.clearTimer();
    await this.drain();
  }

  cancelPending(): void {
    this.clearTimer();
    this.pendingValue = undefined;
    this.hasPendingValue = false;
  }

  private async drain(): Promise<void> {
    if (this.activeDrain) {
      await this.activeDrain;
      if (this.hasPendingValue) await this.drain();
      return;
    }

    this.activeDrain = this.runPendingTasks();
    try {
      await this.activeDrain;
    } finally {
      this.activeDrain = null;
    }

    if (this.hasPendingValue) await this.drain();
  }

  private async runPendingTasks(): Promise<void> {
    while (this.hasPendingValue) {
      const value = this.pendingValue as T;
      this.pendingValue = undefined;
      this.hasPendingValue = false;
      try {
        await this.runTask(value);
      } catch (error) {
        this.onError?.(error, value);
      }
    }
  }

  private clearTimer(): void {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }
}
