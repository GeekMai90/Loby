/**
 * [INPUT]: 依赖 shared 公共契约
 * [OUTPUT]: 对外提供 LEGACY_WELCOME_MESSAGE、createWelcomeConversation、deriveConversationTitle、hasConversationMessages
 * [POS]: AI 助手 feature 的领域模型边界，集中 AI 助手 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { ChatConversation } from "@/shared/types";

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

export function hasConversationMessages(conversation: { messages: readonly unknown[] } | null | undefined): boolean {
  return Boolean(conversation?.messages.length);
}
