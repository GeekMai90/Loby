/**
 * [INPUT]: 依赖 shared 会话、消息运行状态与待确认动作契约
 * [OUTPUT]: 对外提供 AI 助手重新打开时的会话续接判断、旧数据文稿归属恢复与未完成工作检测
 * [POS]: AI 助手会话的任务边界策略，以当前文稿和两小时静默期决定续接或开启新任务
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { ChatConversation } from "@/shared/types";

export const CONVERSATION_INACTIVITY_LIMIT_MS = 2 * 60 * 60 * 1000;

interface ConversationOpeningDecisionInput {
  conversation: ChatConversation | undefined;
  activeSheetId: string;
  blocked: boolean;
  now?: number;
}

export function shouldStartNewConversationOnOpen({
  conversation,
  activeSheetId,
  blocked,
  now = Date.now(),
}: ConversationOpeningDecisionInput): boolean {
  if (!conversation?.messages.length || blocked || hasUnresolvedConversationWork(conversation)) return false;

  const lastSheetId = resolveConversationLastSheetId(conversation);
  if (lastSheetId && activeSheetId && lastSheetId !== activeSheetId) return true;

  const lastUserMessageAt = resolveLastUserMessageAt(conversation);
  return lastUserMessageAt > 0 && now - lastUserMessageAt > CONVERSATION_INACTIVITY_LIMIT_MS;
}

export function hasUnresolvedConversationWork(conversation: ChatConversation | undefined): boolean {
  return Boolean(
    conversation?.messages.some(
      (message) =>
        message.run?.status === "running" ||
        message.actions?.some((action) => action.status === "proposed" || action.status === "applying") ||
        message.changeSets?.some(
          (changeSet) =>
            changeSet.status === "pending" ||
            changeSet.status === "partiallyAccepted" ||
            changeSet.changes.some((change) => change.status === "pending"),
        ),
    ),
  );
}

export function resolveConversationLastSheetId(conversation: ChatConversation): string {
  if (conversation.lastContextSheetId?.trim()) return conversation.lastContextSheetId.trim();

  for (const message of [...conversation.messages].reverse()) {
    const contextSheetId = message.contexts?.find((context) => context.sheetId?.trim())?.sheetId?.trim();
    if (contextSheetId) return contextSheetId;
    const actionSheetId = message.actions?.find((action) => action.targetSheetId?.trim())?.targetSheetId?.trim();
    if (actionSheetId) return actionSheetId;
    const changeSetSheetId = message.changeSets?.find((changeSet) => changeSet.sheetId.trim())?.sheetId.trim();
    if (changeSetSheetId) return changeSetSheetId;
  }
  return "";
}

function resolveLastUserMessageAt(conversation: ChatConversation): number {
  const explicitTimestamp = Date.parse(conversation.lastUserMessageAt || "");
  if (Number.isFinite(explicitTimestamp)) return explicitTimestamp;

  const legacyUserMessage = [...conversation.messages].reverse().find((message) => message.role === "user");
  const legacyIdTimestamp = Number(legacyUserMessage?.id.match(/(?:^|-)(\d{13})(?:$|-)/)?.[1]);
  if (Number.isFinite(legacyIdTimestamp) && legacyIdTimestamp > 0) return legacyIdTimestamp;

  const updatedTimestamp = Date.parse(conversation.updatedAt);
  return Number.isFinite(updatedTimestamp) ? updatedTimestamp : 0;
}
