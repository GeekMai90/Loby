/**
 * [INPUT]: 依赖 shared 公共契约
 * [OUTPUT]: 对外提供欢迎会话、标题推导、空会话判断与保留原历史的消息编辑分支构造
 * [POS]: AI 助手 feature 的领域模型边界，集中 AI 助手 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { ChatConversation, ChatMessage } from "@/shared/types";

export const LEGACY_WELCOME_MESSAGE =
  "我是落笔里的 AI 写作助手。连接你选择的模型服务后，我可以基于当前稿件做结构建议、局部润色、标题方向、资料检索或发布准备。";

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

export function createConversationBranch(
  source: ChatConversation,
  messageId: string,
  message: ChatMessage,
  contextSheetId: string,
  branchId: string,
  now: string,
): ChatConversation {
  const messageIndex = source.messages.findIndex((item) => item.id === messageId);
  const previousMessages = messageIndex === -1 ? source.messages : source.messages.slice(0, messageIndex);
  return {
    ...source,
    id: branchId,
    title: `${source.title.replace(/ · 分支$/, "")} · 分支`,
    messages: [...previousMessages, message],
    parentConversationId: source.id,
    forkedFromMessageId: messageId,
    checkpoint: undefined,
    lastContextStats: undefined,
    lastUserMessageAt: message.role === "user" ? now : source.lastUserMessageAt,
    lastContextSheetId: message.role === "user" && contextSheetId ? contextSheetId : source.lastContextSheetId,
    createdAt: now,
    updatedAt: now,
  };
}
