/**
 * [INPUT]: 依赖 React 运行时、assistant-ui runtime 的 turn top anchor、当前对话连接目录、AI 助手模块与 shared 公共契约
 * [OUTPUT]: 对外提供 AssistantThread，并在每轮发送后将最新用户消息单次定位到对话视口顶部
 * [POS]: AI 助手 feature 的界面组合单元，连接 AI 助手状态、消息滚动与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useMemo, useRef, useState } from "react";
import { AssistantRuntimeProvider, ThreadPrimitive, useExternalStoreRuntime, type ThreadMessageLike } from "@assistant-ui/react";
import { AssistantApprovalDock } from "@/features/assistant/components/AssistantApprovalDock";
import { AssistantComposer } from "@/features/assistant/components/AssistantComposer";
import { AssistantMessage } from "@/features/assistant/components/AssistantMessage";
import { AssistantQuickPromptEmptyState, AssistantThreadViewport } from "@/features/assistant/components/AssistantPanelChrome";
import {
  AssistantActionActionsContext,
  AssistantActionTargetContext,
  AssistantChangeSetActionsContext,
  AssistantContextPreviewMapContext,
  AssistantMessageMapContext,
  AssistantRunMapContext,
  AssistantUserMessageActionsContext,
} from "@/features/assistant/components/AssistantMessageContexts";
import type {
  AgentApprovalDecision,
  AgentApprovalRequest,
  AgentConversationSelection,
  AgentModel,
  AgentProvider,
  AgentReasoningEffort,
  AssistantSendMode,
  AgentRunInfo,
  AiDocumentReference,
  AiMountedContext,
  ChatContextPreview,
  ChatMessage,
  AiAttachment,
  AiQuickPrompt,
  AgentSkill,
  WritingProject,
  WritingSheet,
} from "@/shared/types";
import type { AgentConnectionDirectoryItem } from "@/features/assistant/model/agentConnectionDirectory";

interface AssistantThreadProps {
  messages: ChatMessage[];
  libraryPath: string;
  projects: WritingProject[];
  activeProject?: WritingProject;
  activeSheet?: WritingSheet;
  busy: boolean;
  mountedContexts: AiMountedContext[];
  skills: AgentSkill[];
  quickPrompts: AiQuickPrompt[];
  quickPromptsReady: boolean;
  documents: AiDocumentReference[];
  connections: AgentConnectionDirectoryItem[];
  connectionsLoading?: boolean;
  agentProvider: AgentProvider;
  agentModel: AgentModel;
  agentReasoningEffort: AgentReasoningEffort;
  assistantSendMode: AssistantSendMode;
  approvalRequests: AgentApprovalRequest[];
  shownChangeSetIds: string[];
  onDetachMountedContext: (contextId: string) => void;
  onAttachDocument: (sheetId: string) => void;
  onAgentSelectionChange: (selection: AgentConversationSelection) => void;
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
  onOpenQuickPromptSettings: () => void;
  onCancel: () => Promise<void> | void;
  onEditUserMessage: (
    messageId: string,
    content: string,
    contexts?: ChatContextPreview[],
    attachments?: AiAttachment[],
  ) => Promise<void> | void;
  onSendText: (text: string, skillIds?: string[], attachments?: AiAttachment[]) => Promise<void> | void;
  onSteerText: (text: string) => Promise<void> | void;
}

export function AssistantThread({
  messages,
  libraryPath,
  projects,
  activeProject,
  activeSheet,
  busy,
  mountedContexts,
  skills,
  quickPrompts,
  quickPromptsReady,
  documents,
  connections,
  connectionsLoading,
  agentProvider,
  agentModel,
  agentReasoningEffort,
  assistantSendMode,
  approvalRequests,
  shownChangeSetIds,
  onDetachMountedContext,
  onAttachDocument,
  onAgentSelectionChange,
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
  onOpenQuickPromptSettings,
  onCancel,
  onEditUserMessage,
  onSendText,
  onSteerText,
}: AssistantThreadProps) {
  const promptRequestId = useRef(0);
  const [draftRequest, setDraftRequest] = useState<{ id: number; content: string } | null>(null);
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
    isSendDisabled: false,
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

  function fillComposerWithPrompt(content: string) {
    promptRequestId.current += 1;
    setDraftRequest({ id: promptRequestId.current, content });
  }

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="flex min-h-0 flex-auto flex-col">
        <AssistantThreadViewport asChild className="px-[var(--assistant-panel-gutter)]">
          <ThreadPrimitive.Viewport turnAnchor="top">
            <ThreadPrimitive.Empty>
              <AssistantQuickPromptEmptyState
                quickPrompts={quickPrompts}
                quickPromptsReady={quickPromptsReady}
                busy={busy}
                onSelectPrompt={fillComposerWithPrompt}
                onOpenQuickPromptSettings={onOpenQuickPromptSettings}
              />
            </ThreadPrimitive.Empty>
            <AssistantRunMapContext.Provider value={runByMessageId}>
              <AssistantContextPreviewMapContext.Provider value={contextPreviewsByMessageId}>
                <AssistantMessageMapContext.Provider value={messageById}>
                  <AssistantActionTargetContext.Provider value={{ libraryPath, projects, activeProject, activeSheet }}>
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
          draftRequest={draftRequest}
          busy={busy}
          mountedContexts={mountedContexts}
          skills={skills}
          quickPrompts={quickPrompts}
          documents={documents}
          connections={connections}
          connectionsLoading={connectionsLoading}
          agentProvider={agentProvider}
          agentModel={agentModel}
          agentReasoningEffort={agentReasoningEffort}
          assistantSendMode={assistantSendMode}
          onDetachMountedContext={onDetachMountedContext}
          onAttachDocument={onAttachDocument}
          onAgentSelectionChange={onAgentSelectionChange}
          onCancel={onCancel}
          onSendText={onSendText}
          onSteerText={onSteerText}
        />
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
