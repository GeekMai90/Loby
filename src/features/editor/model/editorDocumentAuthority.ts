/**
 * [INPUT]: 依赖编辑器文档 session identity、React 模型提交正文与外部正文快照
 * [OUTPUT]: 对外提供 EditorDocumentAuthority，按文档 session 区分本地模型回声与外部正文变更
 * [POS]: CodeMirror 即时文档与延迟 React 模型之间的单向权威边界，阻止旧受控 value 回灌打断输入与 IME composition
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
const MAX_PENDING_MODEL_ECHOES = 4;

interface PendingModelEcho {
  sessionKey: string;
  body: string;
}

export class EditorDocumentAuthority {
  private sessionKey = "";
  private pendingModelEchoes: PendingModelEcho[] = [];

  beginSession(sessionKey: string): void {
    if (this.sessionKey === sessionKey) return;
    this.sessionKey = sessionKey;
    this.pendingModelEchoes = [];
  }

  recordLocalCommit(sessionKey: string, body: string): void {
    if (sessionKey !== this.sessionKey) return;
    this.pendingModelEchoes.push({ sessionKey, body });
    if (this.pendingModelEchoes.length > MAX_PENDING_MODEL_ECHOES) this.pendingModelEchoes.shift();
  }

  consumeLocalEcho(sessionKey: string, body: string): boolean {
    const echoIndex = this.pendingModelEchoes.findIndex((echo) => echo.sessionKey === sessionKey && echo.body === body);
    if (echoIndex < 0) return false;
    this.pendingModelEchoes.splice(0, echoIndex + 1);
    return true;
  }
}
