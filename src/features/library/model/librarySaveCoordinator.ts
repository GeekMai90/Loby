/**
 * [INPUT]: 依赖 shared 公共契约、写作库模块
 * [OUTPUT]: 对外提供 LibrarySaveRequest、LibrarySaveCoordinator
 * [POS]: 写作库 feature 的领域模型边界，集中 写作库 规则、数据转换与外部契约
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
  private pendingError: unknown = null;

  constructor({ delayMs, persist = saveProjects, onSaveStart, onSaved, onError }: LibrarySaveCoordinatorOptions) {
    this.queue = new LatestTaskQueue<LibrarySaveRequest>({
      delayMs,
      run: async (request) => {
        onSaveStart?.(request);
        const savedPath = await persist(request.projects, request.libraryPath);
        this.pendingError = null;
        onSaved?.(savedPath, request);
      },
      onError: (error, request) => {
        this.pendingError = error;
        onError?.(error, request);
      },
    });
  }

  schedule(request: LibrarySaveRequest): void {
    this.queue.schedule(request);
  }

  async flush(): Promise<void> {
    await this.queue.flush();
    if (this.pendingError) throw this.pendingError;
  }

  async flushBefore<T>(action: () => T | Promise<T>): Promise<T> {
    await this.flush();
    return action();
  }
}
