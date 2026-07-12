import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Copy, Menu, MessageCirclePlus, MessageSquare, Pencil, Plus, Trash2, X } from "lucide-react";
import { copyTextToClipboard } from "../lib/export";
import type { ChatConversation, ChatMessage } from "../types";
import { LiquidGlassButton, LiquidGlassButtonGroup } from "./LiquidGlassButton";

interface AiPanelHeaderProps {
  messages: ChatMessage[];
  conversations: ChatConversation[];
  activeConversationId: string;
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: () => void;
  onDeleteConversation: () => void;
  onRenameConversation: (conversationId: string, title: string) => void;
  onClose: () => void;
}

const AI_HEADER_TITLE_MAX_LENGTH = 8;

function truncateAiHeaderTitle(title: string): string {
  const characters = Array.from(title);
  if (characters.length <= AI_HEADER_TITLE_MAX_LENGTH) return title;
  return `${characters.slice(0, AI_HEADER_TITLE_MAX_LENGTH).join("")}…`;
}

export function AiPanelHeader({
  messages,
  conversations,
  activeConversationId,
  onSelectConversation,
  onCreateConversation,
  onDeleteConversation,
  onRenameConversation,
  onClose,
}: AiPanelHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);
  const title = activeConversation?.title || "新聊天";
  const displayTitle = truncateAiHeaderTitle(title);
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
    <header className="ai-chat-header">
      <div className="ai-chat-menu-wrap" ref={menuRef}>
        <LiquidGlassButton active={menuOpen} onClick={() => setMenuOpen((value) => !value)} title="更多">
          <Menu size={17} />
        </LiquidGlassButton>
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
        {displayTitle}
      </div>

      <div className="ai-header-actions">
        {hasConversationContent ? (
          <LiquidGlassButtonGroup aria-label="AI 助手操作">
            <LiquidGlassButton joined onClick={onCreateConversation} title="新对话">
              <MessageCirclePlus size={16} />
            </LiquidGlassButton>
            <LiquidGlassButton joined onClick={onClose} title="关闭 AI 助手">
              <X size={16} />
            </LiquidGlassButton>
          </LiquidGlassButtonGroup>
        ) : (
          <LiquidGlassButton onClick={onClose} title="关闭 AI 助手">
            <X size={16} />
          </LiquidGlassButton>
        )}
      </div>
    </header>
  );
}
