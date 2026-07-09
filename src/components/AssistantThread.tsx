import { useMemo } from "react";
import { AssistantRuntimeProvider, ThreadPrimitive, useExternalStoreRuntime, type ThreadMessageLike } from "@assistant-ui/react";
import { AiChangeReviewPanel } from "./AiChangeReviewPanel";
import { AssistantApprovalDock } from "./AssistantApprovalDock";
import { AssistantComposer } from "./AssistantComposer";
import { AssistantMessage } from "./AssistantMessage";
import {
  AssistantContextPreviewMapContext,
  AssistantMessageMapContext,
  AssistantRunMapContext,
  AssistantUserMessageActionsContext,
} from "./AssistantMessageContexts";
import type {
  AiChangeSet,
  AgentApprovalDecision,
  AgentApprovalRequest,
  AgentModel,
  AgentReasoningEffort,
  AgentRunInfo,
  AiDocumentReference,
  AiMountedContext,
  ChatContextPreview,
  ChatMessage,
  CodexModelCatalog,
  CodexSkill,
} from "../types";

interface AssistantThreadProps {
  messages: ChatMessage[];
  busy: boolean;
  mountedContexts: AiMountedContext[];
  skills: CodexSkill[];
  documents: AiDocumentReference[];
  modelCatalog: CodexModelCatalog | null;
  agentModel: AgentModel;
  agentReasoningEffort: AgentReasoningEffort;
  agentQuickMode: boolean;
  approvalRequests: AgentApprovalRequest[];
  changeSets: AiChangeSet[];
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
  onCancel: () => Promise<void> | void;
  onEditUserMessage: (messageId: string, content: string, contexts?: ChatContextPreview[]) => Promise<void> | void;
  onSendText: (text: string, skillIds?: string[]) => Promise<void> | void;
}

export function AssistantThread({
  messages,
  busy,
  mountedContexts,
  skills,
  documents,
  modelCatalog,
  agentModel,
  agentReasoningEffort,
  agentQuickMode,
  approvalRequests,
  changeSets,
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
      <ThreadPrimitive.Root className="assistant-thread">
        <ThreadPrimitive.Viewport className="assistant-thread-viewport">
          <ThreadPrimitive.Empty>
            <div className="assistant-empty">开始一段新对话。</div>
          </ThreadPrimitive.Empty>
          <AssistantRunMapContext.Provider value={runByMessageId}>
            <AssistantContextPreviewMapContext.Provider value={contextPreviewsByMessageId}>
              <AssistantMessageMapContext.Provider value={messageById}>
                <AssistantUserMessageActionsContext.Provider value={{ busy, onEditUserMessage }}>
                  <ThreadPrimitive.Messages components={{ Message: AssistantMessage }} />
                </AssistantUserMessageActionsContext.Provider>
              </AssistantMessageMapContext.Provider>
            </AssistantContextPreviewMapContext.Provider>
          </AssistantRunMapContext.Provider>
          <AiChangeReviewPanel
            changeSets={changeSets}
            shownChangeSetIds={shownChangeSetIds}
            onShowChanges={onShowChanges}
            onHideChanges={onHideChanges}
            onRollbackChangeSet={onRollbackChangeSet}
          />
        </ThreadPrimitive.Viewport>

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
