/**
 * [INPUT]: 依赖 React 运行时、AI 助手模块、shared 公共契约
 * [OUTPUT]: 对外提供 AiAssistantPanel
 * [POS]: AI 助手 feature 的界面组合单元，连接 AI 助手状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect } from "react";
import type { useAiAssistant } from "@/features/assistant/hooks/useAiAssistant";
import type { AiQuickPrompt, AssistantPresentation, WritingProject, WritingSheet } from "@/shared/types";
import { AiPanel } from "@/features/assistant/components/AiPanel";

interface AiAssistantPanelProps {
  assistant: ReturnType<typeof useAiAssistant>;
  quickPrompts: AiQuickPrompt[];
  quickPromptsReady: boolean;
  libraryPath: string;
  activeProject: WritingProject;
  activeSheet: WritingSheet;
  shownChangeSetIds: string[];
  onClose: () => void;
  presentation: AssistantPresentation;
  onTogglePresentation: () => void;
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
}

export function AiAssistantPanel({
  assistant,
  quickPrompts,
  quickPromptsReady,
  libraryPath,
  activeProject,
  activeSheet,
  shownChangeSetIds,
  onClose,
  presentation,
  onTogglePresentation,
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
}: AiAssistantPanelProps) {
  const { attachMountedSheet } = assistant;

  useEffect(() => {
    attachMountedSheet();
  }, [activeSheet.id, attachMountedSheet]);

  return (
    <AiPanel
      messages={assistant.messages}
      libraryPath={libraryPath}
      activeProject={activeProject}
      activeSheet={activeSheet}
      conversations={assistant.conversations}
      activeConversationId={assistant.activeConversationId}
      busy={assistant.busy}
      mountedContexts={assistant.mountedContexts}
      skills={assistant.skills}
      quickPrompts={quickPrompts}
      quickPromptsReady={quickPromptsReady}
      documents={assistant.availableDocuments}
      modelCatalog={assistant.modelCatalog}
      agentModel={assistant.agentModel}
      agentReasoningEffort={assistant.agentReasoningEffort}
      agentQuickMode={assistant.agentQuickMode}
      assistantSendMode={assistant.assistantSendMode}
      approvalRequests={assistant.approvalRequests}
      shownChangeSetIds={shownChangeSetIds}
      onSelectConversation={assistant.setActiveConversationId}
      onCreateConversation={assistant.createConversation}
      onDeleteConversation={assistant.deleteConversation}
      onRenameConversation={assistant.renameConversation}
      onDetachMountedContext={assistant.detachMountedContext}
      onAttachDocument={assistant.attachMountedDocument}
      onAgentModelChange={assistant.setAgentModel}
      onAgentReasoningEffortChange={assistant.setAgentReasoningEffort}
      onAgentQuickModeChange={assistant.setAgentQuickMode}
      onRespondApproval={assistant.respondApproval}
      onShowChanges={onShowChanges}
      onHideChanges={onHideChanges}
      onRollbackChangeSet={onRollbackChangeSet}
      onRejectChangeSet={onRejectChangeSet}
      onOpenChangeSetTarget={onOpenChangeSetTarget}
      onApplyAction={onApplyAction}
      onRejectAction={onRejectAction}
      onRevertAction={onRevertAction}
      onOpenActionTarget={onOpenActionTarget}
      onOpenQuickPromptSettings={onOpenQuickPromptSettings}
      onClose={onClose}
      presentation={presentation}
      onTogglePresentation={onTogglePresentation}
      onCancel={assistant.cancelMessage}
      onEditUserMessage={assistant.editUserMessage}
      onSendText={(text, skillIds, images) => assistant.sendMessage(text, skillIds, images)}
      onSteerText={assistant.steerMessage}
    />
  );
}
