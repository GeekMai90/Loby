import { useEffect, useMemo, useRef, useState } from "react";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
  useMessage,
  type AppendMessage,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import clsx from "clsx";
import { Copy, FileText, Menu, MessageSquare, Pencil, Plus, SendHorizontal, TextSelect, Trash2, X } from "lucide-react";
import remarkGfm from "remark-gfm";
import { copyTextToClipboard } from "../lib/export";
import type { AiMountedContext, ChatConversation, ChatMessage } from "../types";

interface AiPanelProps {
  messages: ChatMessage[];
  conversations: ChatConversation[];
  activeConversationId: string;
  busy: boolean;
  mountedContexts: AiMountedContext[];
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: () => void;
  onDeleteConversation: () => void;
  onRenameConversation: (conversationId: string, title: string) => void;
  onDetachMountedContext: (contextId: string) => void;
  onClose: () => void;
  onSendText: (text: string) => Promise<void> | void;
}

export function AiPanel({
  messages,
  conversations,
  activeConversationId,
  busy,
  mountedContexts,
  onSelectConversation,
  onCreateConversation,
  onDeleteConversation,
  onRenameConversation,
  onDetachMountedContext,
  onClose,
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
              <Plus size={16} />
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
        onDetachMountedContext={onDetachMountedContext}
        onSendText={onSendText}
      />
    </section>
  );
}

function AssistantThread({
  messages,
  busy,
  mountedContexts,
  onDetachMountedContext,
  onSendText,
}: {
  messages: ChatMessage[];
  busy: boolean;
  mountedContexts: AiMountedContext[];
  onDetachMountedContext: (contextId: string) => void;
  onSendText: (text: string) => Promise<void> | void;
}) {
  const runningMessageId = useMemo(
    () => (busy ? [...messages].reverse().find((message) => message.role === "assistant")?.id : undefined),
    [busy, messages],
  );

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
    onNew: async (message) => {
      const text = getAppendMessageText(message).trim();
      if (!text) return;
      await onSendText(text);
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="assistant-thread">
        <ThreadPrimitive.Viewport className="assistant-thread-viewport">
          <ThreadPrimitive.Empty>
            <div className="assistant-empty">开始一段新对话。</div>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages components={{ Message: AssistantMessage }} />
        </ThreadPrimitive.Viewport>

        <ComposerPrimitive.Root className="assistant-composer">
          {mountedContexts.length > 0 && (
            <div className="assistant-mounted-context">
              {mountedContexts.map((context) => {
                const ContextIcon = context.type === "selection" ? TextSelect : FileText;
                return (
                  <div key={context.id} className="assistant-mounted-chip" title={`${context.subtitle}：${context.title}`}>
                    <ContextIcon size={13} />
                    <span>{context.title}</span>
                    <button type="button" onClick={() => onDetachMountedContext(context.id)} title="移除引用">
                      <X size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <ComposerPrimitive.Input
            className="assistant-composer-input"
            placeholder="给 AI 助手发消息"
            submitMode="enter"
            minRows={2}
            maxRows={7}
          />
          <ComposerPrimitive.Send asChild>
            <button className="assistant-send-button" type="button" title="发送">
              <SendHorizontal size={16} />
            </button>
          </ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}

function AssistantMessage() {
  const role = useMessage((message) => message.role);

  return (
    <MessagePrimitive.Root className={clsx("assistant-message", `assistant-message-${role}`)}>
      <div className="assistant-message-body">
        <MessagePrimitive.Parts components={{ Text: AssistantMarkdownText, Empty: AssistantPendingPart }} />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMarkdownText() {
  return <MarkdownTextPrimitive className="assistant-markdown" remarkPlugins={[remarkGfm]} smooth defer />;
}

function AssistantPendingPart() {
  return (
    <span className="assistant-thinking">
      <span />
      <span />
      <span />
    </span>
  );
}

function getAppendMessageText(message: AppendMessage): string {
  const content = message.content;
  if (typeof content === "string") return content;

  return content
    .map((part) => {
      if (part.type === "text") return part.text;
      return "";
    })
    .join("");
}
