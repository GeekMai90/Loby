/**
 * [INPUT]: 依赖 shared 写作文稿契约与写作库 persistence 的单文稿保存边界
 * [OUTPUT]: 对外提供 DocumentSaveRequest、延迟解析正文的 DocumentSaveCoordinator、单文稿变更识别与待提交正文合并
 * [POS]: 写作库高频持久化协调器，以文稿为粒度维护 revision、持久 Text 读取器、idle/max-delay 定时器和全局串行写入
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { WritingProject, WritingSheet } from "@/shared/types";
import { saveDocument, type DocumentProjectContext, type DocumentSaveReceipt } from "@/features/library/model/persistence";

export interface DocumentSaveRequest {
  libraryPath: string;
  project: DocumentProjectContext;
  sheetId: string;
  resolveSheet: () => WritingSheet;
  revision: number;
}

interface DocumentSaveCoordinatorOptions {
  delayMs: number;
  maxDelayMs: number;
  persist?: (request: DocumentSaveRequest) => Promise<DocumentSaveReceipt>;
  onSaved?: (receipt: DocumentSaveReceipt, request: DocumentSaveRequest) => void;
  onError?: (error: unknown, request: DocumentSaveRequest) => void;
}

interface DocumentTimers {
  idle: ReturnType<typeof setTimeout> | null;
  maximum: ReturnType<typeof setTimeout>;
}

/**
 * Collapses rapid edits per document while keeping all native writes globally
 * serialized. A maximum dirty age prevents continuous typing from postponing
 * durable storage forever.
 */
export class DocumentSaveCoordinator {
  private readonly delayMs: number;
  private readonly maxDelayMs: number;
  private readonly persist: (request: DocumentSaveRequest) => Promise<DocumentSaveReceipt>;
  private readonly onSaved?: (receipt: DocumentSaveReceipt, request: DocumentSaveRequest) => void;
  private readonly onError?: (error: unknown, request: DocumentSaveRequest) => void;
  private readonly pending = new Map<string, DocumentSaveRequest>();
  private readonly readyKeys = new Set<string>();
  private readonly timers = new Map<string, DocumentTimers>();
  private readonly latestRevisions = new Map<string, number>();
  private readonly savedRevisions = new Map<string, number>();
  private activeDrain: Promise<void> | null = null;
  private flushRequested = false;
  private flushError: unknown = null;

  constructor({
    delayMs,
    maxDelayMs,
    persist = (request) =>
      saveDocument({
        libraryPath: request.libraryPath,
        project: request.project,
        sheet: request.resolveSheet(),
        revision: request.revision,
      }),
    onSaved,
    onError,
  }: DocumentSaveCoordinatorOptions) {
    this.delayMs = delayMs;
    this.maxDelayMs = maxDelayMs;
    this.persist = persist;
    this.onSaved = onSaved;
    this.onError = onError;
  }

  schedule(request: DocumentSaveRequest): void {
    const key = documentSaveKey(request.libraryPath, request.sheetId);
    const latestRevision = this.latestRevisions.get(key) ?? 0;
    if (request.revision < latestRevision) return;

    this.latestRevisions.set(key, request.revision);
    this.pending.set(key, request);
    if (this.flushRequested) {
      this.markReady(key);
      return;
    }

    const existingTimers = this.timers.get(key);
    if (existingTimers?.idle) clearTimeout(existingTimers.idle);
    const idle = setTimeout(() => this.markReady(key), this.delayMs);
    if (existingTimers) {
      existingTimers.idle = idle;
      return;
    }
    this.timers.set(key, {
      idle,
      maximum: setTimeout(() => this.markReady(key), this.maxDelayMs),
    });
  }

  isDirty(libraryPath: string, sheetId: string): boolean {
    const key = documentSaveKey(libraryPath, sheetId);
    return (this.latestRevisions.get(key) ?? 0) > (this.savedRevisions.get(key) ?? 0);
  }

  async flush(): Promise<void> {
    this.flushRequested = true;
    this.flushError = null;
    try {
      for (const key of this.pending.keys()) this.markReady(key);
      await this.drain();
      if (this.flushError) throw this.flushError;
    } finally {
      this.flushRequested = false;
    }
  }

  private markReady(key: string): void {
    this.clearTimers(key);
    if (!this.pending.has(key)) return;
    this.readyKeys.add(key);
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.activeDrain) {
      await this.activeDrain;
      if (this.readyKeys.size > 0) await this.drain();
      return;
    }

    this.activeDrain = this.runReadyTasks();
    try {
      await this.activeDrain;
    } finally {
      this.activeDrain = null;
    }

    if (this.readyKeys.size > 0) await this.drain();
  }

  private async runReadyTasks(): Promise<void> {
    while (this.readyKeys.size > 0) {
      const key = this.readyKeys.values().next().value as string;
      this.readyKeys.delete(key);
      const request = this.pending.get(key);
      if (!request) continue;
      this.pending.delete(key);
      this.clearTimers(key);

      try {
        const receipt = await this.persist(request);
        this.savedRevisions.set(key, Math.max(this.savedRevisions.get(key) ?? 0, request.revision));
        this.onSaved?.(receipt, request);
      } catch (error) {
        this.onError?.(error, request);
        this.flushError ??= error;
        if (!this.pending.has(key)) this.pending.set(key, request);
        if (this.flushRequested) return;
      }

      if (this.flushRequested && this.pending.has(key)) this.readyKeys.add(key);
    }
  }

  private clearTimers(key: string): void {
    const timers = this.timers.get(key);
    if (!timers) return;
    if (timers.idle) clearTimeout(timers.idle);
    clearTimeout(timers.maximum);
    this.timers.delete(key);
  }
}

export interface SingleDocumentChange {
  project: WritingProject;
  sheet: WritingSheet;
}

export function detectSingleDocumentChange(previousProjects: WritingProject[], projects: WritingProject[]): SingleDocumentChange | null {
  if (previousProjects.length !== projects.length) return null;
  let change: SingleDocumentChange | null = null;

  for (let projectIndex = 0; projectIndex < projects.length; projectIndex += 1) {
    const previousProject = previousProjects[projectIndex];
    const project = projects[projectIndex];
    if (previousProject === project) continue;
    if (!previousProject || previousProject.id !== project.id || change) return null;
    if (!sameProjectMetadata(previousProject, project)) return null;
    if (previousProject.sheets.length !== project.sheets.length) return null;

    let changedSheet: WritingSheet | null = null;
    for (let sheetIndex = 0; sheetIndex < project.sheets.length; sheetIndex += 1) {
      const previousSheet = previousProject.sheets[sheetIndex];
      const sheet = project.sheets[sheetIndex];
      if (!previousSheet || previousSheet.id !== sheet.id) return null;
      if (previousSheet === sheet) continue;
      if (changedSheet) return null;
      changedSheet = sheet;
    }
    if (!changedSheet) return null;
    change = { project, sheet: changedSheet };
  }

  return change;
}

export function documentProjectContext(project: WritingProject): DocumentProjectContext {
  return {
    id: project.id,
    title: project.title,
    groups: project.groups ?? [],
  };
}

export function materializeDocumentSnapshots(projects: WritingProject[], snapshots: ReadonlyMap<string, WritingSheet>): WritingProject[] {
  let changed = false;
  const materialized = projects.map((project) => {
    let projectChanged = false;
    const sheets = project.sheets.map((sheet) => {
      const snapshot = snapshots.get(sheet.id);
      if (!snapshot || (snapshot.body === sheet.body && snapshot.title === sheet.title && snapshot.updatedAt === sheet.updatedAt)) {
        return sheet;
      }
      projectChanged = true;
      changed = true;
      return {
        ...sheet,
        title: snapshot.title,
        body: snapshot.body,
        updatedAt: snapshot.updatedAt,
      };
    });
    return projectChanged ? { ...project, sheets } : project;
  });
  return changed ? materialized : projects;
}

function sameProjectMetadata(previous: WritingProject, current: WritingProject): boolean {
  const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
  for (const key of keys) {
    if (key === "sheets" || key === "updatedAt") continue;
    if (!Object.is(previous[key as keyof WritingProject], current[key as keyof WritingProject])) return false;
  }
  return true;
}

function documentSaveKey(libraryPath: string, sheetId: string): string {
  return `${libraryPath}\u0000${sheetId}`;
}
