import { createContext } from "react";
import type { AgentRunInfo, AiImageAttachment, ChatContextPreview, ChatMessage, WritingProject, WritingSheet } from "../types";

export const AssistantRunMapContext = createContext<Map<string, AgentRunInfo>>(new Map());
export const AssistantContextPreviewMapContext = createContext<Map<string, ChatContextPreview[]>>(new Map());
export const AssistantMessageMapContext = createContext<Map<string, ChatMessage>>(new Map());
export const AssistantChangeSetReviewContext = createContext<{
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
