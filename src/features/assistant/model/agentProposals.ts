/**
 * [INPUT]: 依赖 Agent runtime 的结构化 proposal 事件、图片 action 归一化、AI 动作与正文差异领域模型
 * [OUTPUT]: 对外提供单项 proposal 归一化及消息级提案解析，将严格工具 payload 转为可审阅 AiAction/AiChangeSet 并合并同目标待决图片
 * [POS]: renderer 的提案协议适配边界；不解析 Markdown、不执行写入，在作者确认前把同轮多图收敛为稳定批量领域对象
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AiAction, AiChangeSet, AiActionType, AgentRunActivity } from "@/shared/types";
import type { AgentChatStreamEvent } from "@/features/assistant/model/agentRuntime";
import { createAiActionFromPayload, extractAiActionsFromMessage, type AiActionContext } from "@/features/assistant/model/aiActions";
import {
  AI_CHANGE_SET_MESSAGES,
  changeSetIntroducesImageReference,
  createAiChangeSetFromPayload,
  extractAiChangeSetFromMessage,
} from "@/features/assistant/model/aiChangeSets";
import { consolidateGeneratedImageActions, linkGeneratedImageActions } from "@/features/assistant/model/agentImageArtifacts";

export interface NormalizedAgentProposal {
  action: AiAction | null;
  changeSet: AiChangeSet | null;
}

const ACTION_TYPES: Record<string, AiActionType> = {
  propose_create_sheet: "createSheet",
  propose_insert_text: "insertText",
  propose_insert_image: "insertImage",
  propose_save_export: "saveExport",
};

export function normalizeAgentProposal(
  event: AgentChatStreamEvent,
  context: AiActionContext & { sheetId: string; baseBody: string },
): NormalizedAgentProposal {
  if (!event.payload) return { action: null, changeSet: null };
  if (event.proposalKind === "documentChange" && event.toolName === "propose_document_change") {
    return {
      action: null,
      changeSet: createAiChangeSetFromPayload(event.payload, context.sheetId, context.baseBody),
    };
  }
  const type = ACTION_TYPES[event.toolName || ""];
  return {
    action: type ? createAiActionFromPayload(event.payload, context, type) : null,
    changeSet: null,
  };
}

export function resolveAssistantProposals({
  message,
  structuredActions,
  structuredChangeSet,
  context,
  activities,
}: {
  message: string;
  structuredActions: AiAction[];
  structuredChangeSet: AiChangeSet | null;
  context: AiActionContext & { sheetId: string; baseBody: string };
  activities: AgentRunActivity[];
}): { content: string; actions: AiAction[]; changeSet: AiChangeSet | null } {
  const parsedChange = structuredChangeSet
    ? { content: message, changeSet: structuredChangeSet }
    : extractAiChangeSetFromMessage(message, context.sheetId, context.baseBody);
  const parsedActions = structuredActions.length
    ? { content: parsedChange.content, actions: structuredActions }
    : extractAiActionsFromMessage(parsedChange.content, context);
  const actions = consolidateGeneratedImageActions(linkGeneratedImageActions(parsedActions.actions, activities));
  const hasImageAction = actions.some((action) => action.type === "insertImage" || action.type === "insertImages");
  const changeSet =
    parsedChange.changeSet && changeSetIntroducesImageReference(parsedChange.changeSet) && !hasImageAction
      ? { ...parsedChange.changeSet, error: AI_CHANGE_SET_MESSAGES.applyImageReferenceInserted }
      : parsedChange.changeSet;
  return { content: parsedActions.content, actions, changeSet };
}
