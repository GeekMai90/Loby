/**
 * [INPUT]: 依赖主题助手消息视图模型与 wechatThemeStore 的会话持久化契约
 * [OUTPUT]: 对外提供 createWechatThemeMessageId、toWechatThemeChatMessages、withWechatThemeConversationMessages
 * [POS]: 公众号主题会话的不可变更新层，把主题消息适配到通用 Conversation Context Planner，同时维持主题上下文版本
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { WechatThemeAssistantMessage } from "@/features/publishing/components/WechatThemeAssistantPanel";
import type { WechatThemeConversation } from "@/features/publishing/model/wechatThemeStore";
import type { ChatMessage } from "@/shared/types";

export function createWechatThemeMessageId(now = Date.now(), random = Math.random()) {
  return `theme-message-${now}-${random.toString(36).slice(2, 8)}`;
}

export function toWechatThemeChatMessages(messages: WechatThemeAssistantMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    attachments: message.attachments,
    run: message.run,
  }));
}

export function withWechatThemeConversationMessages(
  conversations: WechatThemeConversation[],
  conversationId: string,
  messages: WechatThemeAssistantMessage[],
  updatedAt = new Date().toISOString(),
  themeContextUpdatedAt = "",
  themeContextVersion?: number,
): WechatThemeConversation[] {
  return conversations.map((conversation) =>
    conversation.id === conversationId
      ? {
          ...conversation,
          messages,
          themeContextUpdatedAt: themeContextUpdatedAt || conversation.themeContextUpdatedAt,
          themeContextVersion: themeContextVersion ?? conversation.themeContextVersion,
          updatedAt,
        }
      : conversation,
  );
}
