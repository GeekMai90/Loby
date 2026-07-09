import { createContext } from "react";
import type { AgentRunInfo, ChatContextPreview, ChatMessage } from "../types";

export const AssistantRunMapContext = createContext<Map<string, AgentRunInfo>>(new Map());
export const AssistantContextPreviewMapContext = createContext<Map<string, ChatContextPreview[]>>(new Map());
export const AssistantMessageMapContext = createContext<Map<string, ChatMessage>>(new Map());
export const AssistantUserMessageActionsContext = createContext<{
  busy: boolean;
  onEditUserMessage: (messageId: string, content: string, contexts?: ChatContextPreview[]) => Promise<void> | void;
}>({
  busy: false,
  onEditUserMessage: () => {},
});
