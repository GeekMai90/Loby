import { createContext } from "react";
import type { AgentRunInfo, ChatContextPreview, ChatMessage, WritingProject, WritingSheet } from "../types";

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
  onEditUserMessage: (messageId: string, content: string, contexts?: ChatContextPreview[]) => Promise<void> | void;
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
