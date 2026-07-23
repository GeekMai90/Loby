/**
 * [INPUT]: 依赖 shared 公共契约、AI 助手模块
 * [OUTPUT]: 对外提供 normalizeLoadedConversations
 * [POS]: AI 助手 feature 的领域模型边界，集中 AI 助手 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { ChatConversation } from "@/shared/types";
import { LEGACY_WELCOME_MESSAGE } from "@/features/assistant/model/conversations";

const INTERRUPTED_ACTION_ERROR = "上次执行时落笔已关闭或刷新，动作没有确认完成。请检查文稿或文件后重试。";

export function normalizeLoadedConversations(conversations: ChatConversation[]): ChatConversation[] {
  return conversations.map((conversation) => ({
    ...conversation,
    messages: conversation.messages
      .filter((message) => !(message.id.endsWith("-welcome") && message.content === LEGACY_WELCOME_MESSAGE))
      .map((message) => {
        const { attachments: _transientAttachments, ...withoutAttachments } = message;
        const { images: _legacyTransientImages, ...persistedMessage } = withoutAttachments as typeof withoutAttachments & {
          images?: unknown[];
        };
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
