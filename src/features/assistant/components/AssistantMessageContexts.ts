/**
 * [INPUT]: 依赖 React 运行时、shared 公共契约
 * [OUTPUT]: 对外提供 AssistantRunMapContext、AssistantContextPreviewMapContext、AssistantMessageMapContext、AssistantActionTargetContext、AssistantUserMessageActionsContext、AssistantActionActionsContext、AssistantChangeSetActionsContext
 * [POS]: AI 助手 feature 的界面组合单元，连接 AI 助手状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { createContext } from "react";
import type { AgentRunInfo, AiImageAttachment, ChatContextPreview, ChatMessage, WritingProject, WritingSheet } from "@/shared/types";

export const AssistantRunMapContext = createContext<Map<string, AgentRunInfo>>(new Map());
export const AssistantContextPreviewMapContext = createContext<Map<string, ChatContextPreview[]>>(new Map());
export const AssistantMessageMapContext = createContext<Map<string, ChatMessage>>(new Map());
export const AssistantActionTargetContext = createContext<{
  libraryPath: string;
  activeProject?: WritingProject;
  activeSheet?: WritingSheet;
}>({ libraryPath: "" });
export const AssistantUserMessageActionsContext = createContext<{
  busy: boolean;
  onEditUserMessage: (
    messageId: string,
    content: string,
    contexts?: ChatContextPreview[],
    images?: AiImageAttachment[],
  ) => Promise<void> | void;
}>({
  busy: false,
  onEditUserMessage: () => {},
});

export const AssistantActionActionsContext = createContext<{
  onApplyAction: (actionId: string) => Promise<void> | void;
  onRejectAction: (actionId: string) => Promise<void> | void;
  onRevertAction: (actionId: string) => Promise<void> | void;
  onOpenActionTarget: (actionId: string) => void;
}>({
  onApplyAction: () => {},
  onRejectAction: () => {},
  onRevertAction: () => {},
  onOpenActionTarget: () => {},
});

export const AssistantChangeSetActionsContext = createContext<{
  shownChangeSetIds: string[];
  activeSheetId: string;
  onShowChanges: (changeSetId: string) => void;
  onHideChanges: (changeSetId: string) => void;
  onRollbackChangeSet: (changeSetId: string) => void;
  onRejectChangeSet: (changeSetId: string) => void;
  onOpenChangeSetTarget: (sheetId: string) => void;
}>({
  shownChangeSetIds: [],
  activeSheetId: "",
  onShowChanges: () => {},
  onHideChanges: () => {},
  onRollbackChangeSet: () => {},
  onRejectChangeSet: () => {},
  onOpenChangeSetTarget: () => {},
});
