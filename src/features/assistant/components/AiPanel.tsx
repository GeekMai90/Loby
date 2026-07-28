/**
 * [INPUT]: 依赖 AI 助手消息/输入模块、当前对话连接目录、会话级错误边界、展示形态与应用级固定侧边偏好
 * [OUTPUT]: 对外提供 AiPanel，把会话内容与固定侧边菜单动作装配到同一助手界面，并按会话隔离消息 runtime
 * [POS]: AI 助手 feature 的界面组合单元，以活动会话作为消息子树的生命周期边界但不持有持久化状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { AiPanelHeader } from "@/features/assistant/components/AiPanelHeader";
import { AssistantPanelErrorBoundary } from "@/features/assistant/components/AssistantPanelErrorBoundary";
import { AssistantThread } from "@/features/assistant/components/AssistantThread";
import type {
  AgentModel,
  AgentConversationSelection,
  AgentApprovalDecision,
  AgentApprovalRequest,
  AgentReasoningEffort,
  AgentProvider,
  AssistantSendMode,
  AssistantPresentation,
  AiDocumentReference,
  AiMountedContext,
  AiAttachment,
  AiQuickPrompt,
  ChatContextPreview,
  ChatConversation,
  ChatMessage,
  AgentSkill,
  WritingProject,
  WritingSheet,
} from "@/shared/types";
import type { AgentConnectionDirectoryItem } from "@/features/assistant/model/agentConnectionDirectory";

interface AiPanelProps {
  messages: ChatMessage[];
  libraryPath: string;
  projects: WritingProject[];
  activeProject?: WritingProject;
  activeSheet?: WritingSheet;
  conversations: ChatConversation[];
  activeConversationId: string;
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
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: () => void;
  onDeleteConversation: () => void;
  onRenameConversation: (conversationId: string, title: string) => void;
  onDetachMountedContext: (contextId: string) => void;
  onAttachDocument: (sheetId: string) => void;
  onAgentSelectionChange: (selection: AgentConversationSelection) => void;
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
  presentation: AssistantPresentation;
  onTogglePresentation: () => void;
  dockedByDefault: boolean;
  onDockedByDefaultChange: (enabled: boolean) => void;
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

export function AiPanel({
  messages,
  libraryPath,
  projects,
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
  connections,
  connectionsLoading,
  agentProvider,
  agentModel,
  agentReasoningEffort,
  assistantSendMode,
  approvalRequests,
  shownChangeSetIds,
  onSelectConversation,
  onCreateConversation,
  onDeleteConversation,
  onRenameConversation,
  onDetachMountedContext,
  onAttachDocument,
  onAgentSelectionChange,
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
  presentation,
  onTogglePresentation,
  dockedByDefault,
  onDockedByDefaultChange,
  onCancel,
  onEditUserMessage,
  onSendText,
  onSteerText,
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
        presentation={presentation}
        onTogglePresentation={onTogglePresentation}
        dockedByDefault={dockedByDefault}
        onDockedByDefaultChange={onDockedByDefaultChange}
        conversationActionsDisabled={busy}
      />

      <AssistantPanelErrorBoundary key={activeConversationId}>
        <AssistantThread
          messages={messages}
          libraryPath={libraryPath}
          projects={projects}
          activeProject={activeProject}
          activeSheet={activeSheet}
          busy={busy}
          mountedContexts={mountedContexts}
          skills={skills}
          quickPrompts={quickPrompts}
          quickPromptsReady={quickPromptsReady}
          documents={documents}
          connections={connections}
          connectionsLoading={connectionsLoading}
          agentProvider={agentProvider}
          agentModel={agentModel}
          agentReasoningEffort={agentReasoningEffort}
          assistantSendMode={assistantSendMode}
          approvalRequests={approvalRequests}
          shownChangeSetIds={shownChangeSetIds}
          onDetachMountedContext={onDetachMountedContext}
          onAttachDocument={onAttachDocument}
          onAgentSelectionChange={onAgentSelectionChange}
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
          onSteerText={onSteerText}
        />
      </AssistantPanelErrorBoundary>
    </section>
  );
}
