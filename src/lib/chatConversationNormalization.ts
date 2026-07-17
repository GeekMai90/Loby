import type { ChatConversation } from "../types";
import { LEGACY_WELCOME_MESSAGE } from "./conversations";

const INTERRUPTED_ACTION_ERROR = "上次执行时 Nibva 已关闭或刷新，动作没有确认完成。请检查文稿或文件后重试。";

export function normalizeLoadedConversations(conversations: ChatConversation[]): ChatConversation[] {
  return conversations.map((conversation) => ({
    ...conversation,
    messages: conversation.messages
      .filter((message) => !(message.id.endsWith("-welcome") && message.content === LEGACY_WELCOME_MESSAGE))
      .map((message) => {
        const { images: _transientImages, ...persistedMessage } = message;
        return persistedMessage.actions?.some((action) => action.status === "applying")
          ? {
              ...persistedMessage,
              actions: persistedMessage.actions.map((action) =>
                action.status === "applying"
                  ? {
                      ...action,
                      status: "failed",
                      result: undefined,
                      error: action.error || INTERRUPTED_ACTION_ERROR,
                      effect: undefined,
                    }
                  : action,
              ),
            }
          : persistedMessage;
      }),
  }));
}
