/**
 * [INPUT]: 依赖 shared 会话/Provider 契约、Agent 运行快照恢复、图片产物身份恢复与旧欢迎消息
 * [OUTPUT]: 对外提供 normalizeLoadedConversations，收敛标题来源、对话级模型选择、恢复跨轮图片来源与待决多图批次、保留写作库受管附件并收口未完成 run
 * [POS]: AI 助手会话加载边界，历史记录进入 UI 前恢复标题与动作批次、图片来源和 Agent 生命周期不变量
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AgentConversationSelection, AgentProvider, ChatConversation, ChatMessage } from "@/shared/types";
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
    return {
      ...conversation,
      titleSource: normalizeConversationTitleSource(conversation.titleSource),
      titleGeneratedForMessageId: normalizeTitleGeneratedForMessageId(conversation.titleGeneratedForMessageId),
      agentSelection: normalizeConversationAgentSelection(conversation.agentSelection),
      messages: linkConversationGeneratedImageActions(messages),
    };
  });
}

function normalizeConversationTitleSource(value: unknown): "derived" | "ai" | "manual" {
  return value === "ai" || value === "manual" ? value : "derived";
}

function normalizeTitleGeneratedForMessageId(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

const AGENT_PROVIDERS = new Set<AgentProvider>([
  "openai-api",
  "anthropic-api",
  "qwen-api",
  "minimax-api",
  "deepseek-api",
  "kimi-api",
  "openai-compatible",
  "chatgpt-subscription",
]);

function normalizeConversationAgentSelection(value: unknown): AgentConversationSelection | undefined {
  if (!value || typeof value !== "object") return undefined;
  const selection = value as Partial<AgentConversationSelection>;
  if (!AGENT_PROVIDERS.has(selection.provider as AgentProvider)) return undefined;
  if (typeof selection.model !== "string" || !selection.model.trim()) return undefined;
  if (typeof selection.reasoningEffort !== "string") return undefined;
  return {
    provider: selection.provider as AgentProvider,
    model: selection.model,
    reasoningEffort: selection.reasoningEffort,
  };
}

function isManagedAttachmentPath(path: string): boolean {
  return path.replaceAll("\\", "/").includes("/.loby/ai/attachments/");
}
