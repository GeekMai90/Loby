import { useEffect, useMemo, useRef, useState } from "react";
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  useExternalStoreRuntime,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import clsx from "clsx";
import {
  Check,
  Copy,
  Menu,
  MessageCirclePlus,
  MessageSquare,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { copyTextToClipboard } from "../lib/export";
import { AiChangeReviewPanel } from "./AiChangeReviewPanel";
import { AssistantComposer } from "./AssistantComposer";
import {
  ASSISTANT_MESSAGE_COMPONENTS,
  AssistantContextPreviewMapContext,
  AssistantMessageMapContext,
  AssistantRunMapContext,
  AssistantUserMessageActionsContext,
} from "./AssistantMessage";
import type {
  AiChangeSet,
  AgentModel,
  AgentApprovalDecision,
  AgentApprovalRequest,
  AgentRunInfo,
  AgentReasoningEffort,
  AiDocumentReference,
  AiMountedContext,
  ChatContextPreview,
  ChatConversation,
  ChatMessage,
  CodexModelCatalog,
  CodexSkill,
} from "../types";

interface AiPanelProps {
  messages: ChatMessage[];
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
  onClose: () => void;
  onCancel: () => Promise<void> | void;
  onEditUserMessage: (messageId: string, content: string, contexts?: ChatContextPreview[]) => Promise<void> | void;
  onSendText: (text: string, skillIds?: string[]) => Promise<void> | void;
}

export function AiPanel({
  messages,
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
        onCancel={onCancel}
        onEditUserMessage={onEditUserMessage}
        onSendText={onSendText}
      />
    </section>
  );
}

function AssistantThread({
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
}: {
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
}) {
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
                  <ThreadPrimitive.Messages components={ASSISTANT_MESSAGE_COMPONENTS} />
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

function AssistantApprovalDock({
  approvals,
  onRespondApproval,
}: {
  approvals: AgentApprovalRequest[];
  onRespondApproval: (approvalId: string, decision: AgentApprovalDecision) => Promise<void> | void;
}) {
  const visibleApprovals = approvals.filter((approval) => approval.status === "pending").slice(-3);
  if (visibleApprovals.length === 0) return null;

  return (
    <div className="assistant-approval-dock">
      {visibleApprovals.map((approval) => (
        <section key={approval.id} className="assistant-approval-card">
          <div className="assistant-approval-icon">
            <ShieldCheck size={15} />
          </div>
          <div className="assistant-approval-main">
            <div className="assistant-approval-title">
              <span>{approval.title || "Codex 请求确认"}</span>
              <small>{formatApprovalStatus(approval.status)}</small>
            </div>
            {approval.command && <code>{approval.command}</code>}
            {approval.reason && <p>{approval.reason}</p>}
          </div>
          <div className="assistant-approval-actions">
            <button type="button" onClick={() => onRespondApproval(approval.id, "accept")} title="允许">
              <Check size={13} />
              <span>允许</span>
            </button>
            <button type="button" onClick={() => onRespondApproval(approval.id, "acceptForSession")} title="本次会话允许">
              <ShieldCheck size={13} />
              <span>本次允许</span>
            </button>
            <button type="button" className="secondary" onClick={() => onRespondApproval(approval.id, "decline")} title="拒绝">
              <X size={13} />
              <span>拒绝</span>
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}

function formatApprovalStatus(status: string) {
  const labels: Record<string, string> = {
    pending: "待确认",
    accept: "已允许",
    acceptForSession: "本次会话允许",
    decline: "已拒绝",
    cancel: "已取消",
  };
  return labels[status] ?? status;
}
