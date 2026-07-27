/**
 * [INPUT]: 依赖 shared 会话契约、Agent 运行快照恢复、图片产物身份恢复与旧欢迎消息
 * [OUTPUT]: 对外提供 normalizeLoadedConversations，恢复跨轮图片来源、保留写作库受管附件、清理瞬态附件并收口未完成 run
 * [POS]: AI 助手会话加载边界，历史记录进入 UI 前恢复动作、图片来源和 Agent 生命周期不变量
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { ChatConversation, ChatMessage } from "@/shared/types";
import { LEGACY_WELCOME_MESSAGE } from "@/features/assistant/model/conversations";
import { linkConversationGeneratedImageActions } from "@/features/assistant/model/agentImageArtifacts";
import { normalizePersistedAgentRun } from "@/features/assistant/model/agentRunReducer";

const INTERRUPTED_ACTION_ERROR = "上次执行时落笔已关闭或刷新，动作没有确认完成。请检查文稿或文件后重试。";

export function normalizeLoadedConversations(conversations: ChatConversation[]): ChatConversation[] {
  return conversations.map((conversation) => {
    const messages = conversation.messages
      .filter((message) => !(message.id.endsWith("-welcome") && message.content === LEGACY_WELCOME_MESSAGE))
      .map((message): ChatMessage => {
        const { attachments, ...withoutAttachments } = message;
        const { images: _legacyTransientImages, ...persistedMessage } = withoutAttachments as typeof withoutAttachments & {
          images?: unknown[];
        };
        const managedAttachments = attachments?.filter((attachment) => isManagedAttachmentPath(attachment.path));
        const restoredMessage = managedAttachments?.length ? { ...persistedMessage, attachments: managedAttachments } : persistedMessage;
        const normalizedRunMessage = restoredMessage.run
          ? { ...restoredMessage, run: normalizePersistedAgentRun(restoredMessage.run) }
          : restoredMessage;
        return normalizedRunMessage.actions?.some((action) => action.status === "applying")
          ? {
              ...normalizedRunMessage,
              actions: normalizedRunMessage.actions.map((action) =>
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
          : normalizedRunMessage;
      });
    return { ...conversation, messages: linkConversationGeneratedImageActions(messages) };
  });
}

function isManagedAttachmentPath(path: string): boolean {
  return path.replaceAll("\\", "/").includes("/.loby/ai/attachments/");
}
