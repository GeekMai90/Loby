import type { ChatConversation } from "../types";

export const LEGACY_WELCOME_MESSAGE =
  "我是落笔里的 AI 写作助手。你可以直接和本机已登录的 Codex 或 Claude CLI 对话，让我基于当前稿件做结构建议、局部润色、标题方向或发布准备。";

export function createWelcomeConversation(id = "default", title = "默认对话"): ChatConversation {
  return {
    id,
    title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
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
