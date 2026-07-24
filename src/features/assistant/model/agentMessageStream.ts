/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供 AgentMessageStreamState、appendAgentMessageDelta、completeAgentMessage
 * [POS]: AI 助手 feature 的消息流聚合边界，按 item id 保序合并 delta 与恢复后的 commentary/final 完整消息
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export interface AgentMessageStreamState {
  content: string;
  itemId: string;
  segments?: AgentMessageSegment[];
}

interface AgentMessageSegment {
  itemId: string;
  text: string;
}

export function appendAgentMessageDelta(state: AgentMessageStreamState, delta: string, itemId = ""): AgentMessageStreamState {
  const nextItemId = itemId.trim();
  const segments = normalizedSegments(state);
  const targetId = nextItemId || state.itemId || "streamed-agent-message";
  const index = segments.findIndex((segment) => segment.itemId === targetId);
  if (index >= 0) {
    segments[index] = { ...segments[index], text: segments[index].text + delta };
  } else {
    segments.push({ itemId: targetId, text: delta });
  }
  return streamState(segments, targetId);
}

export function completeAgentMessage(state: AgentMessageStreamState, text: string, itemId = ""): AgentMessageStreamState {
  const segments = normalizedSegments(state);
  const targetId = itemId.trim() || state.itemId || "completed-agent-message";
  const index = segments.findIndex((segment) => segment.itemId === targetId);
  if (index >= 0) {
    segments[index] = { ...segments[index], text };
  } else if (text && segments.some((segment) => segment.text === text || segment.text.endsWith(text))) {
    return streamState(segments, targetId);
  } else if (text) {
    segments.push({ itemId: targetId, text });
  }
  return streamState(segments, targetId);
}

function normalizedSegments(state: AgentMessageStreamState): AgentMessageSegment[] {
  if (state.segments) return state.segments.map((segment) => ({ ...segment }));
  return state.content ? [{ itemId: state.itemId || "streamed-agent-message", text: state.content }] : [];
}

function streamState(segments: AgentMessageSegment[], itemId: string): AgentMessageStreamState {
  return {
    content: segments.reduce((content, segment) => joinAgentMessageParagraphs(content, segment.text), ""),
    itemId,
    segments,
  };
}

function joinAgentMessageParagraphs(content: string, delta: string): string {
  if (!content || !delta) return content + delta;
  const trailingNewlines = content.match(/\n+$/)?.[0].length ?? 0;
  const leadingNewlines = delta.match(/^\n+/)?.[0].length ?? 0;
  const missingNewlines = Math.max(0, 2 - trailingNewlines - leadingNewlines);
  return `${content}${"\n".repeat(missingNewlines)}${delta}`;
}
