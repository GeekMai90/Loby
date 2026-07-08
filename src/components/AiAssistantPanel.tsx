import { useEffect } from "react";
import type { useAiAssistant } from "../hooks/useAiAssistant";
import type { AiChangeSet, WritingSheet } from "../types";
import { AiPanel } from "./AiPanel";

interface AiAssistantPanelProps {
  assistant: ReturnType<typeof useAiAssistant>;
  activeSheet: WritingSheet;
  changeSets: AiChangeSet[];
  focusedChangeId: string;
  previewingChangeSetId: string;
  onClose: () => void;
  onAcceptChange: (changeSetId: string, changeId: string) => void;
  onRejectChange: (changeSetId: string, changeId: string) => void;
  onAcceptAllChanges: (changeSetId: string) => void;
  onRejectAllChanges: (changeSetId: string) => void;
  onFocusChange: (changeSetId: string, changeId: string) => void;
  onToggleOriginalPreview: (changeSetId: string) => void;
  onRollbackChangeSet: (changeSetId: string) => void;
}

export function AiAssistantPanel({
  assistant,
  activeSheet,
  changeSets,
  focusedChangeId,
  previewingChangeSetId,
  onClose,
  onAcceptChange,
  onRejectChange,
  onAcceptAllChanges,
  onRejectAllChanges,
  onFocusChange,
  onToggleOriginalPreview,
  onRollbackChangeSet,
}: AiAssistantPanelProps) {
  useEffect(() => {
    assistant.attachMountedSheet();
  }, [activeSheet.id]);

  return (
    <AiPanel
      messages={assistant.messages}
      conversations={assistant.conversations}
      activeConversationId={assistant.activeConversationId}
      busy={assistant.busy}
      mountedContexts={assistant.mountedContexts}
      skills={assistant.skills}
      documents={assistant.availableDocuments}
      modelCatalog={assistant.modelCatalog}
      agentModel={assistant.agentModel}
      agentReasoningEffort={assistant.agentReasoningEffort}
      agentQuickMode={assistant.agentQuickMode}
      approvalRequests={assistant.approvalRequests}
      changeSets={changeSets}
      focusedChangeId={focusedChangeId}
      previewingChangeSetId={previewingChangeSetId}
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
      onAcceptChange={onAcceptChange}
      onRejectChange={onRejectChange}
      onAcceptAllChanges={onAcceptAllChanges}
      onRejectAllChanges={onRejectAllChanges}
      onFocusChange={onFocusChange}
      onToggleOriginalPreview={onToggleOriginalPreview}
      onRollbackChangeSet={onRollbackChangeSet}
      onClose={onClose}
      onCancel={assistant.cancelMessage}
      onEditUserMessage={assistant.editUserMessage}
      onSendText={(text, skillIds) => assistant.sendMessage(text, skillIds)}
    />
  );
}
