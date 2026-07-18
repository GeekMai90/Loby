import { useMemo } from "react";
import { AssistantRuntimeProvider, ThreadPrimitive, useExternalStoreRuntime, type ThreadMessageLike } from "@assistant-ui/react";
import { AssistantApprovalDock } from "./AssistantApprovalDock";
import { AssistantComposer } from "./AssistantComposer";
import { AssistantMessage } from "./AssistantMessage";
import { AssistantEmptyState, AssistantThreadViewport } from "./AssistantPanelChrome";
import {
  AssistantActionActionsContext,
  AssistantActionTargetContext,
  AssistantChangeSetActionsContext,
  AssistantContextPreviewMapContext,
  AssistantMessageMapContext,
  AssistantRunMapContext,
  AssistantUserMessageActionsContext,
} from "./AssistantMessageContexts";
import type {
  AgentApprovalDecision,
  AgentApprovalRequest,
  AgentModel,
  AgentReasoningEffort,
  AssistantSendMode,
  AgentRunInfo,
  AiDocumentReference,
  AiMountedContext,
  ChatContextPreview,
  ChatMessage,
  AiImageAttachment,
  CodexModelCatalog,
  CodexSkill,
  WritingProject,
  WritingSheet,
} from "../types";

interface AssistantThreadProps {
  messages: ChatMessage[];
  libraryPath: string;
  activeProject?: WritingProject;
  activeSheet?: WritingSheet;
  busy: boolean;
  mountedContexts: AiMountedContext[];
  skills: CodexSkill[];
  documents: AiDocumentReference[];
  modelCatalog: CodexModelCatalog | null;
  agentModel: AgentModel;
  agentReasoningEffort: AgentReasoningEffort;
  agentQuickMode: boolean;
  assistantSendMode: AssistantSendMode;
  approvalRequests: AgentApprovalRequest[];
  shownChangeSetIds: string[];
  onDetachMountedContext: (contextId: string) => void;
  onAttachDocument: (sheetId: string) => void;
  onAgentModelChange: (model: AgentModel) => void;
  onAgentReasoningEffortChange: (effort: AgentReasoningEffort) => void;
  onAgentQuickModeChange: (enabled: boolean) => void;
  onRespondApproval: (approvalId: string, decision: AgentApprovalDecision) => Promise<void> | void;
  onShowChanges: (changeSetId: string) => void;
  onHideChanges: (changeSetId: string) => void;
  onRollbackChangeSet: (changeSetId: string) => void;
  onRejectChangeSet: (changeSetId: string) => void;
  onOpenChangeSetTarget: (sheetId: string) => void;
  activeSheetId: string;
  onApplyAction: (actionId: string) => Promise<void> | void;
  onRejectAction: (actionId: string) => Promise<void> | void;
  onRevertAction: (actionId: string) => Promise<void> | void;
  onOpenActionTarget: (actionId: string) => void;
  onCancel: () => Promise<void> | void;
  onEditUserMessage: (
    messageId: string,
    content: string,
    contexts?: ChatContextPreview[],
    images?: AiImageAttachment[],
  ) => Promise<void> | void;
  onSendText: (text: string, skillIds?: string[], images?: AiImageAttachment[]) => Promise<void> | void;
}

export function AssistantThread({
  messages,
  libraryPath,
  activeProject,
  activeSheet,
  busy,
  mountedContexts,
  skills,
  documents,
  modelCatalog,
  agentModel,
  agentReasoningEffort,
  agentQuickMode,
  assistantSendMode,
  approvalRequests,
  shownChangeSetIds,
  onDetachMountedContext,
  onAttachDocument,
  onAgentModelChange,
  onAgentReasoningEffortChange,
  onAgentQuickModeChange,
  onRespondApproval,
  onShowChanges,
  onHideChanges,
  onRollbackChangeSet,
  onRejectChangeSet,
  onOpenChangeSetTarget,
  activeSheetId,
  onApplyAction,
  onRejectAction,
  onRevertAction,
  onOpenActionTarget,
  onCancel,
  onEditUserMessage,
  onSendText,
}: AssistantThreadProps) {
  const runningMessageId = useMemo(
    () => (busy ? [...messages].reverse().find((message) => message.role === "assistant")?.id : undefined),
    [busy, messages],
  );
  const runByMessageId = useMemo(() => {
    const runs = new Map<string, AgentRunInfo>();
    for (const message of messages) {
      if (message.run) runs.set(message.id, message.run);
    }
    return runs;
  }, [messages]);
  const contextPreviewsByMessageId = useMemo(() => {
    const previews = new Map<string, ChatContextPreview[]>();
    for (const message of messages) {
      if (message.contexts?.length) previews.set(message.id, message.contexts);
    }
    return previews;
  }, [messages]);
  const messageById = useMemo(() => {
    const messageMap = new Map<string, ChatMessage>();
    for (const message of messages) {
      messageMap.set(message.id, message);
    }
    return messageMap;
  }, [messages]);

  const runtime = useExternalStoreRuntime<ChatMessage>({
    messages,
    isRunning: busy,
    isSendDisabled: busy,
    convertMessage: (message): ThreadMessageLike => ({
      id: message.id,
      role: message.role,
      content: message.content,
      status:
        message.role === "assistant"
          ? message.id === runningMessageId
            ? { type: "running" }
            : { type: "complete", reason: "stop" }
          : undefined,
    }),
    onNew: async () => {},
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="flex min-h-0 flex-auto flex-col gap-2.5">
        <AssistantThreadViewport asChild>
          <ThreadPrimitive.Viewport>
            <ThreadPrimitive.Empty>
              <AssistantEmptyState title="开始一段新对话。" />
            </ThreadPrimitive.Empty>
            <AssistantRunMapContext.Provider value={runByMessageId}>
              <AssistantContextPreviewMapContext.Provider value={contextPreviewsByMessageId}>
                <AssistantMessageMapContext.Provider value={messageById}>
                  <AssistantActionTargetContext.Provider value={{ libraryPath, activeProject, activeSheet }}>
                    <AssistantActionActionsContext.Provider value={{ onApplyAction, onRejectAction, onRevertAction, onOpenActionTarget }}>
                      <AssistantChangeSetActionsContext.Provider
                        value={{
                          shownChangeSetIds,
                          activeSheetId,
                          onShowChanges,
                          onHideChanges,
                          onRollbackChangeSet,
                          onRejectChangeSet,
                          onOpenChangeSetTarget,
                        }}
                      >
                        <AssistantUserMessageActionsContext.Provider value={{ busy, onEditUserMessage }}>
                          <ThreadPrimitive.Messages components={{ Message: AssistantMessage }} />
                        </AssistantUserMessageActionsContext.Provider>
                      </AssistantChangeSetActionsContext.Provider>
                    </AssistantActionActionsContext.Provider>
                  </AssistantActionTargetContext.Provider>
                </AssistantMessageMapContext.Provider>
              </AssistantContextPreviewMapContext.Provider>
            </AssistantRunMapContext.Provider>
          </ThreadPrimitive.Viewport>
        </AssistantThreadViewport>

        <AssistantApprovalDock approvals={approvalRequests} onRespondApproval={onRespondApproval} />

        <AssistantComposer
          busy={busy}
          mountedContexts={mountedContexts}
          skills={skills}
          documents={documents}
          modelCatalog={modelCatalog}
          agentModel={agentModel}
          agentReasoningEffort={agentReasoningEffort}
          agentQuickMode={agentQuickMode}
          assistantSendMode={assistantSendMode}
          onDetachMountedContext={onDetachMountedContext}
          onAttachDocument={onAttachDocument}
          onAgentModelChange={onAgentModelChange}
          onAgentReasoningEffortChange={onAgentReasoningEffortChange}
          onAgentQuickModeChange={onAgentQuickModeChange}
          onCancel={onCancel}
          onSendText={onSendText}
        />
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
