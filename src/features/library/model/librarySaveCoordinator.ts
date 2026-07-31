/**
 * [INPUT]: 依赖 shared 公共契约、写作库模块
 * [OUTPUT]: 对外提供 LibrarySaveRequest、带失败保留与自动重试的 LibrarySaveCoordinator
 * [POS]: 写作库结构与 metadata 保存边界，失败请求保留到成功或被更新快照替代，关闭 flush 不得把失败误当完成
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { WritingProject } from "@/shared/types";
import { LatestTaskQueue } from "@/shared/lib/latestTaskQueue";
import { saveProjects } from "@/features/library/model/persistence";

export interface LibrarySaveRequest {
  projects: WritingProject[];
  libraryPath?: string;
}

interface LibrarySaveCoordinatorOptions {
  delayMs: number;
  retryDelayMs?: number;
  persist?: (projects: WritingProject[], libraryPath?: string) => Promise<string>;
  onSaveStart?: (request: LibrarySaveRequest) => void;
  onSaved?: (savedPath: string, request: LibrarySaveRequest) => void;
  onError?: (error: unknown, request: LibrarySaveRequest) => void;
}

/**
 * Owns the replaceable writing-library save queue used by the application.
 * Each queued snapshot keeps the path that was active when it was scheduled,
 * so a later library switch cannot redirect pending work to the new library.
 */
export class LibrarySaveCoordinator {
  private readonly queue: LatestTaskQueue<LibrarySaveRequest>;
  private readonly retryDelayMs: number;
  private pendingError: unknown = null;
  private latestRequest: LibrarySaveRequest | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor({ delayMs, retryDelayMs = 2_000, persist = saveProjects, onSaveStart, onSaved, onError }: LibrarySaveCoordinatorOptions) {
    this.retryDelayMs = retryDelayMs;
    this.queue = new LatestTaskQueue<LibrarySaveRequest>({
      delayMs,
      run: async (request) => {
        onSaveStart?.(request);
        const savedPath = await persist(request.projects, request.libraryPath);
        if (this.latestRequest === request) {
          this.pendingError = null;
          this.clearRetryTimer();
        }
        onSaved?.(savedPath, request);
      },
      onError: (error, request) => {
        if (this.latestRequest === request) {
          this.pendingError = error;
          this.scheduleRetry(request);
        }
        onError?.(error, request);
      },
    });
  }

  schedule(request: LibrarySaveRequest): void {
    this.latestRequest = request;
    this.pendingError = null;
    this.clearRetryTimer();
    this.queue.schedule(request);
  }

  async flush(): Promise<void> {
    this.clearRetryTimer();
    if (this.pendingError && this.latestRequest) this.queue.schedule(this.latestRequest);
    await this.queue.flush();
    if (this.pendingError) throw this.pendingError;
  }

  async flushBefore<T>(action: () => T | Promise<T>): Promise<T> {
    await this.flush();
    return action();
  }

  private scheduleRetry(request: LibrarySaveRequest): void {
    this.clearRetryTimer();
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.latestRequest === request) this.queue.schedule(request);
    }, this.retryDelayMs);
  }

  private clearRetryTimer(): void {
    if (!this.retryTimer) return;
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }
}
