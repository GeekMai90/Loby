/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供 AgentMessageStreamState、appendAgentMessageDelta
 * [POS]: AI 助手 feature 的领域模型边界，集中 AI 助手 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export interface AgentMessageStreamState {
  content: string;
  itemId: string;
}

export function appendAgentMessageDelta(state: AgentMessageStreamState, delta: string, itemId = ""): AgentMessageStreamState {
  const nextItemId = itemId.trim();
  const startsNewMessage = Boolean(nextItemId && state.itemId && nextItemId !== state.itemId);
  return {
    content: startsNewMessage ? joinAgentMessageParagraphs(state.content, delta) : state.content + delta,
    itemId: nextItemId || state.itemId,
  };
}

function joinAgentMessageParagraphs(content: string, delta: string): string {
  if (!content || !delta) return content + delta;
  const trailingNewlines = content.match(/\n+$/)?.[0].length ?? 0;
  const leadingNewlines = delta.match(/^\n+/)?.[0].length ?? 0;
  const missingNewlines = Math.max(0, 2 - trailingNewlines - leadingNewlines);
  return `${content}${"\n".repeat(missingNewlines)}${delta}`;
}
