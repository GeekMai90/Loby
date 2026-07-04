import type { ChatConversation } from "../types";

export function createWelcomeConversation(id = "default", title = "默认对话"): ChatConversation {
  return {
    id,
    title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
      {
        id: `${id}-welcome`,
        role: "assistant",
        content: "我是 Nibva 里的 Codex 写作助手。你可以让我基于当前稿件做结构建议、局部润色、标题方向、配图构思或发布准备。",
      },
    ],
  };
}

export function deriveConversationTitle(content: string): string {
  const normalized = content
    .replace(/\s+/g, " ")
    .replace(/^\/\w+\s*/, "")
    .trim();
  if (!normalized) return "新对话";
  return normalized.length > 18 ? `${normalized.slice(0, 18)}...` : normalized;
}
