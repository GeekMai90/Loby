/**
 * [INPUT]: 依赖浏览器 Window EventTarget
 * [OUTPUT]: 对外提供 AGENT_CREDENTIALS_CHANGED_EVENT 与 notifyAgentCredentialsChanged
 * [POS]: assistant model 的无秘密凭证失效通知契约，连接设置与当前 Provider hook 通过它同步 native 状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export const AGENT_CREDENTIALS_CHANGED_EVENT = "loby:agent-credentials-changed";

export function notifyAgentCredentialsChanged() {
  window.dispatchEvent(new Event(AGENT_CREDENTIALS_CHANGED_EVENT));
}
