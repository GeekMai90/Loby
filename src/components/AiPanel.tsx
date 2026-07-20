import { AiPanelHeader } from "./AiPanelHeader";
import { AssistantThread } from "./AssistantThread";
import type {
  AgentModel,
  AgentApprovalDecision,
  AgentApprovalRequest,
  AgentReasoningEffort,
  AssistantSendMode,
  AiDocumentReference,
  AiMountedContext,
  AiImageAttachment,
  AiQuickPrompt,
  ChatContextPreview,
  ChatConversation,
  ChatMessage,
  CodexModelCatalog,
  CodexSkill,
  WritingProject,
  WritingSheet,
} from "../types";

interface AiPanelProps {
  messages: ChatMessage[];
  libraryPath: string;
  activeProject?: WritingProject;
  activeSheet?: WritingSheet;
  conversations: ChatConversation[];
  activeConversationId: string;
  busy: boolean;
  mountedContexts: AiMountedContext[];
  skills: CodexSkill[];
  quickPrompts: AiQuickPrompt[];
  quickPromptsReady: boolean;
  documents: AiDocumentReference[];
  modelCatalog: CodexModelCatalog | null;
  agentModel: AgentModel;
  agentReasoningEffort: AgentReasoningEffort;
  agentQuickMode: boolean;
  assistantSendMode: AssistantSendMode;
  approvalRequests: AgentApprovalRequest[];
  shownChangeSetIds: string[];
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: () => void;
  onDeleteConversation: () => void;
  onRenameConversation: (conversationId: string, title: string) => void;
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
  onApplyAction: (actionId: string) => Promise<void> | void;
  onRejectAction: (actionId: string) => Promise<void> | void;
  onRevertAction: (actionId: string) => Promise<void> | void;
  onOpenActionTarget: (actionId: string) => void;
  onOpenQuickPromptSettings: () => void;
  onClose: () => void;
  onCancel: () => Promise<void> | void;
  onEditUserMessage: (
    messageId: string,
    content: string,
    contexts?: ChatContextPreview[],
    images?: AiImageAttachment[],
  ) => Promise<void> | void;
  onSendText: (text: string, skillIds?: string[], images?: AiImageAttachment[]) => Promise<void> | void;
}

export function AiPanel({
  messages,
  libraryPath,
  activeProject,
  activeSheet,
  conversations,
  activeConversationId,
  busy,
  mountedContexts,
  skills,
  quickPrompts,
  quickPromptsReady,
  documents,
  modelCatalog,
  agentModel,
  agentReasoningEffort,
  agentQuickMode,
  assistantSendMode,
  approvalRequests,
  shownChangeSetIds,
  onSelectConversation,
  onCreateConversation,
  onDeleteConversation,
  onRenameConversation,
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
  onApplyAction,
  onRejectAction,
  onRevertAction,
  onOpenActionTarget,
  onOpenQuickPromptSettings,
  onClose,
  onCancel,
  onEditUserMessage,
  onSendText,
}: AiPanelProps) {
  return (
    <section
      data-slot="assistant-panel"
      className="relative flex min-h-0 min-w-0 flex-auto flex-col text-sm [--assistant-panel-gutter:10px]"
    >
      <AiPanelHeader
        messages={messages}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={onSelectConversation}
        onCreateConversation={onCreateConversation}
        onDeleteConversation={onDeleteConversation}
        onRenameConversation={onRenameConversation}
        onClose={onClose}
      />

      <AssistantThread
        messages={messages}
        libraryPath={libraryPath}
        activeProject={activeProject}
        activeSheet={activeSheet}
        busy={busy}
        mountedContexts={mountedContexts}
        skills={skills}
        quickPrompts={quickPrompts}
        quickPromptsReady={quickPromptsReady}
        documents={documents}
        modelCatalog={modelCatalog}
        agentModel={agentModel}
        agentReasoningEffort={agentReasoningEffort}
        agentQuickMode={agentQuickMode}
        assistantSendMode={assistantSendMode}
        approvalRequests={approvalRequests}
        shownChangeSetIds={shownChangeSetIds}
        onDetachMountedContext={onDetachMountedContext}
        onAttachDocument={onAttachDocument}
        onAgentModelChange={onAgentModelChange}
        onAgentReasoningEffortChange={onAgentReasoningEffortChange}
        onAgentQuickModeChange={onAgentQuickModeChange}
        onRespondApproval={onRespondApproval}
        onShowChanges={onShowChanges}
        onHideChanges={onHideChanges}
        onRollbackChangeSet={onRollbackChangeSet}
        onRejectChangeSet={onRejectChangeSet}
        onOpenChangeSetTarget={onOpenChangeSetTarget}
        activeSheetId={activeSheet?.id ?? ""}
        onApplyAction={onApplyAction}
        onRejectAction={onRejectAction}
        onRevertAction={onRevertAction}
        onOpenActionTarget={onOpenActionTarget}
        onOpenQuickPromptSettings={onOpenQuickPromptSettings}
        onCancel={onCancel}
        onEditUserMessage={onEditUserMessage}
        onSendText={onSendText}
      />
    </section>
  );
}
