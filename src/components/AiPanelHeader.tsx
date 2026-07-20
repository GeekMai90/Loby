import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { Copy, Menu, MessageCirclePlus, MessageSquare, Pencil, Plus, Trash2, X } from "lucide-react";
import { copyTextToClipboard } from "../lib/exportBrowser";
import { LiquidGlassButton } from "./LiquidGlassButton";
import { AssistantPanelHeaderFrame } from "./AssistantPanelChrome";

interface AiPanelHeaderProps {
  messages: Array<{ role: string; content: string }>;
  conversations: Array<{ id: string; title: string }>;
  activeConversationId: string;
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: () => void;
  onDeleteConversation: () => void;
  onRenameConversation: (conversationId: string, title: string) => void;
  onClose?: () => void;
  conversationActionsDisabled?: boolean;
  headerClassName?: string;
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
  conversationActionsDisabled = false,
  headerClassName,
}: AiPanelHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);
  const title = activeConversation?.title || "新聊天";
  const displayTitle = truncateAiHeaderTitle(title);
  const hasConversationContent = messages.length > 0;

  async function copyConversation() {
    const content = messages
      .map((message) => {
        const role = message.role === "user" ? "你" : message.role === "assistant" ? "AI" : "系统";
        return `## ${role}\n\n${message.content}`;
      })
      .join("\n\n");
    await copyTextToClipboard(content);
  }

  function renameConversation() {
    const nextTitle = window.prompt("更改本次对话标题", title);
    if (nextTitle) onRenameConversation(activeConversationId, nextTitle);
  }

  function deleteConversation() {
    onDeleteConversation();
  }

  const createButton = hasConversationContent ? (
    <LiquidGlassButton disabled={conversationActionsDisabled} onClick={onCreateConversation} title="新对话">
      <MessageCirclePlus size={17} />
    </LiquidGlassButton>
  ) : null;
  const closeButton = onClose ? (
    <LiquidGlassButton onClick={onClose} title="关闭 AI 助手">
      <X size={17} />
    </LiquidGlassButton>
  ) : null;
  const rightActions =
    createButton && closeButton ? (
      <div className="inline-flex items-center gap-1.5" aria-label="AI 助手操作">
        {createButton}
        {closeButton}
      </div>
    ) : (
      (createButton ?? closeButton)
    );

  return (
    <AssistantPanelHeaderFrame
      title={displayTitle}
      titleTooltip={title}
      className={headerClassName}
      left={
        <DropdownMenu modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <LiquidGlassButton active={menuOpen} title="更多">
              <Menu size={17} />
            </LiquidGlassButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={6} className="w-60">
            <DropdownMenuLabel>对话历史</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={activeConversationId} onValueChange={onSelectConversation}>
              {conversations.slice(0, 6).map((conversation) => (
                <DropdownMenuRadioItem
                  key={conversation.id}
                  value={conversation.id}
                  selectionStyle="highlight"
                  disabled={conversationActionsDisabled}
                >
                  <MessageSquare />
                  <span className="truncate">{conversation.title}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuItem disabled={conversationActionsDisabled} onSelect={onCreateConversation}>
              <Plus />
              <span>新聊天</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>这次对话</DropdownMenuLabel>
            <DropdownMenuItem disabled={conversationActionsDisabled} onSelect={renameConversation}>
              <Pencil />
              <span>更改标题</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void copyConversation()}>
              <Copy />
              <span>复制整个对话</span>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={conversationActionsDisabled} variant="destructive" onSelect={deleteConversation}>
              <Trash2 />
              <span>删除对话</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      right={rightActions}
    />
  );
}
