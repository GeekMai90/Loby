import { useEffect } from "react";
import type { useAiAssistant } from "../hooks/useAiAssistant";
import type { WritingSheet } from "../types";
import { AiPanel } from "./AiPanel";

interface AiAssistantPanelProps {
  assistant: ReturnType<typeof useAiAssistant>;
  activeSheet: WritingSheet;
  onClose: () => void;
}

export function AiAssistantPanel({ assistant, activeSheet, onClose }: AiAssistantPanelProps) {
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
      onSelectConversation={assistant.setActiveConversationId}
      onCreateConversation={assistant.createConversation}
      onDeleteConversation={assistant.deleteConversation}
      onRenameConversation={assistant.renameConversation}
      onDetachMountedContext={assistant.detachMountedContext}
      onClose={onClose}
      onSendText={(text, skillIds) => assistant.sendMessage(text, skillIds)}
    />
  );
}
