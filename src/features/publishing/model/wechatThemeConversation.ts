/**
 * [INPUT]: 依赖主题助手消息视图模型与 wechatThemeStore 的会话持久化契约
 * [OUTPUT]: 对外提供 createWechatThemeMessageId、withWechatThemeConversationMessages
 * [POS]: 公众号主题会话的不可变消息更新层，维持会话身份、主题上下文版本和更新时间
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { WechatThemeAssistantMessage } from "@/features/publishing/components/WechatThemeAssistantPanel";
import type { WechatThemeConversation } from "@/features/publishing/model/wechatThemeStore";

export function createWechatThemeMessageId(now = Date.now(), random = Math.random()) {
  return `theme-message-${now}-${random.toString(36).slice(2, 8)}`;
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
