/**
 * [INPUT]: 依赖 Agent runtime 的结构化 proposal 事件、图片 action 归一化、AI 动作与正文差异领域模型
 * [OUTPUT]: 对外提供单项 proposal 归一化及消息级提案解析，将严格工具 payload 转为可审阅 AiAction/AiChangeSet、移除模型重复的协议回显并合并同目标待决图片
 * [POS]: renderer 的提案协议适配边界；不执行写入，以结构化事件为动作事实并保持最终回复为面向作者的自然语言
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

const PROPOSAL_ECHO_HEADING_PATTERN = /^\s*(?:#{1,6}\s*)?文稿动作\s*[：:]\s*$/;
const PROPOSAL_ECHO_SIGNAL_PATTERNS = [
  /\b(?:pending|proposed|applied|reverted|failed)\b/i,
  /\btarget\s*=/i,
  /\btitle\s*=/i,
  /\bpath\s*=/i,
  /\balt\s*=/i,
  /(?:锚点|anchor)\s*=/i,
];

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
  const hasStructuredProposal = structuredActions.length > 0 || Boolean(structuredChangeSet);
  const authorFacingContent = hasStructuredProposal ? stripStructuredProposalEcho(parsedActions.content) : parsedActions.content;
  const content = authorFacingContent || (structuredActions.length > 0 ? proposalCompletionMessage(actions) : "");
  return { content, actions, changeSet };
}

function proposalCompletionMessage(actions: AiAction[]): string {
  if (actions.length > 0 && actions.every((action) => action.type === "insertImage" || action.type === "insertImages")) {
    return "已创建图片插入确认卡片，请在下方确认。";
  }
  if (actions.length > 0 && actions.every((action) => action.type === "insertText")) {
    return "已创建文本插入确认卡片，请在下方确认。";
  }
  if (actions.length > 0 && actions.every((action) => action.type === "createSheet")) {
    return "已创建新建文稿确认卡片，请在下方确认。";
  }
  if (actions.length > 0 && actions.every((action) => action.type === "saveExport")) {
    return "已创建保存导出确认卡片，请在下方确认。";
  }
  return actions.length > 0 ? "已创建文稿操作确认卡片，请在下方确认。" : "";
}

function stripStructuredProposalEcho(message: string): string {
  const lines = message.split(/\r?\n/);
  const retained: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (isProposalEchoLine(line)) continue;
    if (!PROPOSAL_ECHO_HEADING_PATTERN.test(line)) {
      retained.push(line);
      continue;
    }

    let cursor = index + 1;
    while (cursor < lines.length && !(lines[cursor] ?? "").trim()) cursor += 1;
    if (cursor >= lines.length || !isProposalEchoLine(lines[cursor] ?? "")) {
      retained.push(line);
      continue;
    }

    index = cursor;
    while (index + 1 < lines.length) {
      const next = lines[index + 1] ?? "";
      if (!next.trim() || isProposalEchoLine(next)) {
        index += 1;
        continue;
      }
      break;
    }
  }

  return retained
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isProposalEchoLine(line: string): boolean {
  const value = line.replace(/^\s*[-*+]\s*/, "").trim();
  if (!value || !/[;；|｜]/.test(value)) return false;
  return PROPOSAL_ECHO_SIGNAL_PATTERNS.filter((pattern) => pattern.test(value)).length >= 2;
}
