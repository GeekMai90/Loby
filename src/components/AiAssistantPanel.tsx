import { useEffect } from "react";
import type { useAiAssistant } from "../hooks/useAiAssistant";
import type { AiChangeSet, WritingSheet } from "../types";
import { AiPanel } from "./AiPanel";

interface AiAssistantPanelProps {
  assistant: ReturnType<typeof useAiAssistant>;
  activeSheet: WritingSheet;
  changeSets: AiChangeSet[];
  shownChangeSetIds: string[];
  onClose: () => void;
  onShowChanges: (changeSetId: string) => void;
  onHideChanges: (changeSetId: string) => void;
  onRollbackChangeSet: (changeSetId: string) => void;
}

export function AiAssistantPanel({
  assistant,
  activeSheet,
  changeSets,
  shownChangeSetIds,
  onClose,
  onShowChanges,
  onHideChanges,
  onRollbackChangeSet,
}: AiAssistantPanelProps) {
  const { attachMountedSheet } = assistant;

  useEffect(() => {
    attachMountedSheet();
  }, [activeSheet.id, attachMountedSheet]);

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
      onClose={onClose}
      onCancel={assistant.cancelMessage}
      onEditUserMessage={assistant.editUserMessage}
      onSendText={(text, skillIds) => assistant.sendMessage(text, skillIds)}
    />
  );
}
