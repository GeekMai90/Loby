/**
 * [INPUT]: 依赖 React 面板生命周期、AI 会话协调、窗口拖拽回调、展示形态与应用级固定侧边偏好
 * [OUTPUT]: 对外提供 AiAssistantPanel，执行重新打开策略并把会话菜单与面板关闭动作下发给标题栏
 * [POS]: AI 助手 feature 的面板装配边界，连接会话生命周期和展示偏好但不持有应用级设置
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import type { useAiAssistant } from "@/features/assistant/hooks/useAiAssistant";
import type { AiQuickPrompt, AssistantPresentation, WritingProject, WritingSheet } from "@/shared/types";
import { AiPanel } from "@/features/assistant/components/AiPanel";
import { useAgentConnectionDirectory } from "@/features/assistant/hooks/useAgentConnectionDirectory";

interface AiAssistantPanelProps {
  assistant: ReturnType<typeof useAiAssistant>;
  quickPrompts: AiQuickPrompt[];
  quickPromptsReady: boolean;
  libraryPath: string;
  projects: WritingProject[];
  activeProject: WritingProject;
  activeSheet: WritingSheet;
  shownChangeSetIds: string[];
  onClose: () => void;
  presentation: AssistantPresentation;
  onTogglePresentation: () => void;
  onWindowDragStart: (event: MouseEvent<HTMLElement>) => void;
  onWindowToolbarDoubleClick: (event: MouseEvent<HTMLElement>) => void;
  dockedByDefault: boolean;
  onDockedByDefaultChange: (enabled: boolean) => void;
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
  projects,
  activeProject,
  activeSheet,
  shownChangeSetIds,
  onClose,
  presentation,
  onTogglePresentation,
  onWindowDragStart,
  onWindowToolbarDoubleClick,
  dockedByDefault,
  onDockedByDefaultChange,
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
  const { attachMountedSheet, prepareConversationForOpen } = assistant;
  const connectionDirectory = useAgentConnectionDirectory();
  const preparedConversationRef = useRef(false);

  useEffect(() => {
    if (preparedConversationRef.current || !assistant.conversationsReady) return;
    preparedConversationRef.current = true;
    prepareConversationForOpen();
  }, [assistant.conversationsReady, prepareConversationForOpen]);

  useEffect(() => {
    attachMountedSheet();
  }, [activeSheet.id, attachMountedSheet]);

  return (
    <AiPanel
      messages={assistant.messages}
      libraryPath={libraryPath}
      projects={projects}
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
      connections={connectionDirectory.connections}
      connectionsLoading={connectionDirectory.loading}
      agentProvider={assistant.agentProvider}
      agentModel={assistant.agentModel}
      agentReasoningEffort={assistant.agentReasoningEffort}
      assistantSendMode={assistant.assistantSendMode}
      approvalRequests={assistant.approvalRequests}
      shownChangeSetIds={shownChangeSetIds}
      onSelectConversation={assistant.setActiveConversationId}
      onCreateConversation={assistant.createConversation}
      onDeleteConversation={assistant.deleteConversation}
      onRenameConversation={assistant.renameConversation}
      onDetachMountedContext={assistant.detachMountedContext}
      onAttachDocument={assistant.attachMountedDocument}
      onAgentSelectionChange={assistant.setAgentSelection}
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
      onWindowDragStart={onWindowDragStart}
      onWindowToolbarDoubleClick={onWindowToolbarDoubleClick}
      dockedByDefault={dockedByDefault}
      onDockedByDefaultChange={onDockedByDefaultChange}
      onCancel={assistant.cancelMessage}
      onEditUserMessage={assistant.editUserMessage}
      onSendText={(text, skillIds, images) => assistant.sendMessage(text, skillIds, images)}
      onSteerText={assistant.steerMessage}
    />
  );
}
