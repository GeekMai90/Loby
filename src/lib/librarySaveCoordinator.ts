import type { WritingProject } from "../types";
import { LatestTaskQueue } from "./latestTaskQueue";
import { saveProjects } from "./persistence";

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

  constructor({ delayMs, persist = saveProjects, onSaveStart, onSaved, onError }: LibrarySaveCoordinatorOptions) {
    this.queue = new LatestTaskQueue<LibrarySaveRequest>({
      delayMs,
      run: async (request) => {
        onSaveStart?.(request);
        const savedPath = await persist(request.projects, request.libraryPath);
        onSaved?.(savedPath, request);
      },
      onError,
    });
  }

  schedule(request: LibrarySaveRequest): void {
    this.queue.schedule(request);
  }

  async flush(): Promise<void> {
    await this.queue.flush();
  }

  async flushBefore<T>(action: () => T | Promise<T>): Promise<T> {
    await this.flush();
    return action();
  }
}
