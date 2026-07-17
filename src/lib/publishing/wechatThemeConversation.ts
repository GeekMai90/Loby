import type { WechatThemeAssistantMessage } from "../../components/WechatThemeAssistantPanel";
import type { WechatThemeConversation } from "./wechatThemeStore";

export function createWechatThemeMessageId(now = Date.now(), random = Math.random()) {
  return `theme-message-${now}-${random.toString(36).slice(2, 8)}`;
}

export function withWechatThemeConversationMessages(
  conversations: WechatThemeConversation[],
  conversationId: string,
  messages: WechatThemeAssistantMessage[],
  agentThreadId = "",
  updatedAt = new Date().toISOString(),
): WechatThemeConversation[] {
  return conversations.map((conversation) =>
    conversation.id === conversationId
      ? {
          ...conversation,
          messages,
          agentThreadId: agentThreadId || conversation.agentThreadId,
          updatedAt,
        }
      : conversation,
  );
}
