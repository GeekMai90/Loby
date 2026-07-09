import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Copy, Menu, MessageCirclePlus, MessageSquare, Pencil, Plus, Trash2, X } from "lucide-react";
import { copyTextToClipboard } from "../lib/export";
import { AssistantThread } from "./AssistantThread";
import type {
  AiChangeSet,
  AgentModel,
  AgentApprovalDecision,
  AgentApprovalRequest,
  AgentReasoningEffort,
  AiDocumentReference,
  AiMountedContext,
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
  documents: AiDocumentReference[];
  modelCatalog: CodexModelCatalog | null;
  agentModel: AgentModel;
  agentReasoningEffort: AgentReasoningEffort;
  agentQuickMode: boolean;
  approvalRequests: AgentApprovalRequest[];
  changeSets: AiChangeSet[];
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
  onClose: () => void;
  onCancel: () => Promise<void> | void;
  onEditUserMessage: (messageId: string, content: string, contexts?: ChatContextPreview[]) => Promise<void> | void;
  onSendText: (text: string, skillIds?: string[]) => Promise<void> | void;
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
  documents,
  modelCatalog,
  agentModel,
  agentReasoningEffort,
  agentQuickMode,
  approvalRequests,
  changeSets,
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
  onClose,
  onCancel,
  onEditUserMessage,
  onSendText,
}: AiPanelProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);
  const title = activeConversation?.title || "新聊天";
  const hasConversationContent = messages.length > 0;

  useEffect(() => {
    if (!menuOpen) return;
    function closeMenu(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
    }
    window.addEventListener("pointerdown", closeMenu);
    return () => window.removeEventListener("pointerdown", closeMenu);
  }, [menuOpen]);

  async function copyConversation() {
    const content = messages
      .map((message) => {
        const role = message.role === "user" ? "你" : message.role === "assistant" ? "AI" : "系统";
        return `## ${role}\n\n${message.content}`;
      })
      .join("\n\n");
    await copyTextToClipboard(content);
    setMenuOpen(false);
  }

  function renameConversation() {
    const nextTitle = window.prompt("更改本次对话标题", title);
    if (nextTitle) onRenameConversation(activeConversationId, nextTitle);
    setMenuOpen(false);
  }

  function deleteConversation() {
    onDeleteConversation();
    setMenuOpen(false);
  }

  return (
    <section className="ai-chat-shell">
      <header className="ai-chat-header">
        <div className="ai-chat-menu-wrap" ref={menuRef}>
          <button className="ai-toolbar-button" onClick={() => setMenuOpen((value) => !value)} title="更多">
            <Menu size={17} />
          </button>
          {menuOpen && (
            <div className="ai-more-menu">
              <div className="ai-menu-section">
                <div className="ai-menu-caption">对话历史</div>
                {conversations.slice(0, 6).map((conversation) => (
                  <button
                    key={conversation.id}
                    className={clsx(conversation.id === activeConversationId && "active")}
                    onClick={() => {
                      onSelectConversation(conversation.id);
                      setMenuOpen(false);
                    }}
                  >
                    <MessageSquare size={14} />
                    <span>{conversation.title}</span>
                  </button>
                ))}
                <button
                  onClick={() => {
                    onCreateConversation();
                    setMenuOpen(false);
                  }}
                >
                  <Plus size={14} />
                  <span>新聊天</span>
                </button>
              </div>

              <div className="ai-menu-section">
                <div className="ai-menu-caption">这次对话</div>
                <button onClick={renameConversation}>
                  <Pencil size={14} />
                  <span>更改标题</span>
                </button>
                <button onClick={copyConversation}>
                  <Copy size={14} />
                  <span>复制整个对话</span>
                </button>
                <button className="danger-menu-item" onClick={deleteConversation}>
                  <Trash2 size={14} />
                  <span>删除对话</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="ai-chat-title" title={title}>
          {title}
        </div>

        <div className={clsx("ai-header-actions", hasConversationContent && "joined")}>
          {hasConversationContent && (
            <button className="ai-toolbar-button" onClick={onCreateConversation} title="新对话">
              <MessageCirclePlus size={16} />
            </button>
          )}
          <button className="ai-toolbar-button" onClick={onClose} title="关闭 AI 助手">
            <X size={16} />
          </button>
        </div>
      </header>

      <AssistantThread
        messages={messages}
        libraryPath={libraryPath}
        activeProject={activeProject}
        activeSheet={activeSheet}
        busy={busy}
        mountedContexts={mountedContexts}
        skills={skills}
        documents={documents}
        modelCatalog={modelCatalog}
        agentModel={agentModel}
        agentReasoningEffort={agentReasoningEffort}
        agentQuickMode={agentQuickMode}
        approvalRequests={approvalRequests}
        changeSets={changeSets}
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
        onCancel={onCancel}
        onEditUserMessage={onEditUserMessage}
        onSendText={onSendText}
      />
    </section>
  );
}
