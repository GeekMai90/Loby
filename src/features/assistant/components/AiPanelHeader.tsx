/**
 * [INPUT]: 依赖 shadcn/ui 菜单、React 运行时、会话操作、展示形态与应用级固定侧边偏好
 * [OUTPUT]: 对外提供 AiPanelHeader，并在更多菜单底部提供带侧边栏图标的“固定到侧边”勾选项
 * [POS]: AI 助手 feature 的标题与会话菜单边界，区分持久化默认形态和当前打开周期的临时切换
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Copy, Menu, MessageCirclePlus, MessageSquare, PanelRight, Pencil, PictureInPicture2, Plus, Trash2, X } from "lucide-react";
import { copyTextToClipboard } from "@/features/publishing/model/exportBrowser";
import type { AssistantPresentation } from "@/shared/types";
import { AssistantPanelHeaderFrame } from "@/features/assistant/components/AssistantPanelChrome";

interface AiPanelHeaderProps {
  messages: Array<{ role: string; content: string }>;
  conversations: Array<{ id: string; title: string }>;
  activeConversationId: string;
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: () => void;
  onDeleteConversation: () => void;
  onRenameConversation: (conversationId: string, title: string) => void;
  onClose?: () => void;
  presentation?: AssistantPresentation;
  onTogglePresentation?: () => void;
  dockedByDefault?: boolean;
  onDockedByDefaultChange?: (enabled: boolean) => void;
  conversationActionsDisabled?: boolean;
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
  presentation,
  onTogglePresentation,
  dockedByDefault,
  onDockedByDefaultChange,
  conversationActionsDisabled = false,
}: AiPanelHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);
  const title = activeConversation?.title || "新聊天";
  const displayTitle = truncateAiHeaderTitle(title);

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

  const createButton = (
    <Button variant="ghost" size="icon-sm" disabled={conversationActionsDisabled} onClick={onCreateConversation} title="新对话">
      <MessageCirclePlus className="size-3.5" />
    </Button>
  );
  const closeButton = onClose ? (
    <Button variant="ghost" size="icon-sm" onClick={onClose} title="关闭 AI 助手">
      <X className="size-3.5" />
    </Button>
  ) : null;
  const presentationButton =
    presentation && onTogglePresentation ? (
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onTogglePresentation}
        title={presentation === "floating" ? "切换到右侧边栏" : "切换到小窗"}
        aria-label={presentation === "floating" ? "切换到右侧边栏" : "切换到小窗"}
      >
        <PictureInPicture2 className="size-3.5" />
      </Button>
    ) : null;
  const rightActions =
    presentationButton || closeButton ? (
      <div className="inline-flex items-center gap-1.5" aria-label="AI 助手操作">
        {presentationButton}
        {closeButton}
      </div>
    ) : null;

  return (
    <AssistantPanelHeaderFrame
      title={displayTitle}
      left={
        <div className="inline-flex items-center gap-1.5" aria-label="AI 助手对话操作">
          <DropdownMenu modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" title="更多">
                <Menu className="size-3.5" />
              </Button>
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
              {onDockedByDefaultChange ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={dockedByDefault}
                    onCheckedChange={(checked) => onDockedByDefaultChange(checked === true)}
                  >
                    <PanelRight />
                    <span>固定到侧边</span>
                  </DropdownMenuCheckboxItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          {createButton}
        </div>
      }
      right={rightActions}
    />
  );
}
