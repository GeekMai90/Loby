/**
 * [INPUT]: 依赖浏览器计时器与编辑器产生的 sheetId/CodeMirror Text 延迟读取快照
 * [OUTPUT]: 对外提供 DocumentChangeBuffer，将逐键 revision 合并为有 idle/max-delay 上界的单次正文物化与模型提交
 * [POS]: editor 高频输入与 React 写作库模型之间的缓冲边界；耐久化仍由每次输入的独立回调立即排队
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export interface BufferedDocumentChange {
  sheetId: string;
  body: string;
  readBody: () => string;
}

export interface BufferedDocumentChangeIntent {
  sheetId: string;
  readBody: () => string;
}

interface DocumentChangeBufferOptions {
  delayMs: number;
  maxDelayMs: number;
  commit: (change: BufferedDocumentChange) => void;
}

export class DocumentChangeBuffer {
  private readonly delayMs: number;
  private readonly maxDelayMs: number;
  private readonly commitChange: (change: BufferedDocumentChange) => void;
  private pending: BufferedDocumentChangeIntent | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private maximumTimer: ReturnType<typeof setTimeout> | null = null;

  constructor({ delayMs, maxDelayMs, commit }: DocumentChangeBufferOptions) {
    this.delayMs = delayMs;
    this.maxDelayMs = maxDelayMs;
    this.commitChange = commit;
  }

  schedule(change: BufferedDocumentChangeIntent): void {
    if (this.pending && this.pending.sheetId !== change.sheetId) this.flush();
    this.pending = change;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.flush(), this.delayMs);
    if (!this.maximumTimer) this.maximumTimer = setTimeout(() => this.flush(), this.maxDelayMs);
  }

  flush(): void {
    const pending = this.pending;
    this.pending = null;
    this.clearTimers();
    if (pending) this.commitChange({ sheetId: pending.sheetId, body: pending.readBody(), readBody: pending.readBody });
  }

  private clearTimers(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.maximumTimer) clearTimeout(this.maximumTimer);
    this.idleTimer = null;
    this.maximumTimer = null;
  }
}
