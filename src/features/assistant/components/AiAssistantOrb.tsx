/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供 AiAssistantOrb
 * [POS]: AI 助手 feature 的界面组合单元，连接 AI 助手状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export function AiAssistantOrb() {
  return (
    <span className="assistant-launcher-glass" aria-hidden="true">
      <span className="assistant-launcher-fluid" />
    </span>
  );
}
