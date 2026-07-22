/**
 * [INPUT]: 依赖 发布模块
 * [OUTPUT]: 对外提供 createWechatThemeMessageId、withWechatThemeConversationMessages
 * [POS]: 发布 feature 的领域模型边界，集中 发布 规则、数据转换与外部契约
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
  agentThreadId = "",
  updatedAt = new Date().toISOString(),
  themeContextUpdatedAt = "",
  themeContextVersion?: number,
): WechatThemeConversation[] {
  return conversations.map((conversation) =>
    conversation.id === conversationId
      ? {
          ...conversation,
          messages,
          agentThreadId: agentThreadId || conversation.agentThreadId,
          themeContextUpdatedAt: themeContextUpdatedAt || conversation.themeContextUpdatedAt,
          themeContextVersion: themeContextVersion ?? conversation.themeContextVersion,
          updatedAt,
        }
      : conversation,
  );
}
