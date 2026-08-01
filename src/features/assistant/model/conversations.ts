/**
 * [INPUT]: 依赖 shared/types 的 ChatConversation、ChatMessage 与用户消息文本
 * [OUTPUT]: 对外提供可注入默认模型选择的欢迎会话、首条消息标题推导、AI 标题安全应用、空会话判断与保留原历史的消息编辑分支构造
 * [POS]: AI 会话身份与分支的纯模型层，维护标题来源、欢迎空态和不可变历史分叉，不负责落盘
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AgentConversationSelection, ChatConversation, ChatMessage } from "@/shared/types";

export const LEGACY_WELCOME_MESSAGE =
  "我是落笔里的 AI 写作助手。连接你选择的模型服务后，我可以基于当前稿件做结构建议、局部润色、标题方向、资料检索或发布准备。";

export function createWelcomeConversation(
  id = "default",
  title = "默认对话",
  agentSelection?: AgentConversationSelection,
): ChatConversation {
  return {
    id,
    title,
    titleSource: "derived",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    agentSelection,
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

export function applyGeneratedConversationTitle(
  conversation: ChatConversation,
  title: string,
  expectedMessageId: string,
  now = new Date().toISOString(),
): ChatConversation {
  if (conversation.titleSource === "manual" || conversation.titleSource === "ai") return conversation;
  if (!conversation.messages.some((message) => message.id === expectedMessageId)) return conversation;
  if (conversation.titleGeneratedForMessageId === expectedMessageId) return conversation;
  return {
    ...conversation,
    title,
    titleSource: "ai",
    titleGeneratedForMessageId: expectedMessageId,
    updatedAt: now,
  };
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
