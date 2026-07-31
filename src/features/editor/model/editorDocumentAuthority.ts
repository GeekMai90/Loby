/**
 * [INPUT]: 依赖编辑器文档 session identity、React 模型提交正文与外部正文快照
 * [OUTPUT]: 对外提供 EditorDocumentAuthority，按文档 session 完整追踪尚未确认的本地模型回声并放行外部正文变更
 * [POS]: CodeMirror 即时文档与延迟 React 模型之间的单向权威边界；待确认回声与 React 队列同生共灭，不得用固定容量丢弃仍可能到达的合法输入
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
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
  }

  consumeLocalEcho(sessionKey: string, body: string): boolean {
    const echoIndex = this.pendingModelEchoes.findIndex((echo) => echo.sessionKey === sessionKey && echo.body === body);
    if (echoIndex < 0) return false;
    this.pendingModelEchoes.splice(0, echoIndex + 1);
    return true;
  }
}
