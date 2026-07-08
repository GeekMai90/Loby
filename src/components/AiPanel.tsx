import { useEffect, useMemo, useRef, useState } from "react";
import {
  AssistantRuntimeProvider,
  MessagePrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
  useMessage,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import clsx from "clsx";
import { Copy, FileText, Menu, MessageSquare, Pencil, Plus, SendHorizontal, Sparkles, TextSelect, Trash2, X } from "lucide-react";
import remarkGfm from "remark-gfm";
import { copyTextToClipboard } from "../lib/export";
import type { AiMountedContext, ChatConversation, ChatMessage, CodexSkill } from "../types";

interface AiPanelProps {
  messages: ChatMessage[];
  conversations: ChatConversation[];
  activeConversationId: string;
  busy: boolean;
  mountedContexts: AiMountedContext[];
  skills: CodexSkill[];
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: () => void;
  onDeleteConversation: () => void;
  onRenameConversation: (conversationId: string, title: string) => void;
  onDetachMountedContext: (contextId: string) => void;
  onClose: () => void;
  onSendText: (text: string, skillIds?: string[]) => Promise<void> | void;
}

export function AiPanel({
  messages,
  conversations,
  activeConversationId,
  busy,
  mountedContexts,
  skills,
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
        skills={skills}
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
  skills,
  onDetachMountedContext,
  onSendText,
}: {
  messages: ChatMessage[];
  busy: boolean;
  mountedContexts: AiMountedContext[];
  skills: CodexSkill[];
  onDetachMountedContext: (contextId: string) => void;
  onSendText: (text: string, skillIds?: string[]) => Promise<void> | void;
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
    onNew: async () => {},
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

        <AssistantComposer
          busy={busy}
          mountedContexts={mountedContexts}
          skills={skills}
          onDetachMountedContext={onDetachMountedContext}
          onSendText={onSendText}
        />
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}

function AssistantComposer({
  busy,
  mountedContexts,
  skills,
  onDetachMountedContext,
  onSendText,
}: {
  busy: boolean;
  mountedContexts: AiMountedContext[];
  skills: CodexSkill[];
  onDetachMountedContext: (contextId: string) => void;
  onSendText: (text: string, skillIds?: string[]) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState("");
  const [cursor, setCursor] = useState(0);
  const [mountedSkills, setMountedSkills] = useState<CodexSkill[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const slashTrigger = getSkillSlashTrigger(draft, cursor);
  const skillSuggestions = slashTrigger
    ? filterSkillSuggestions(skills, slashTrigger.query, mountedSkills).slice(0, 8)
    : [];
  const canSend = !busy && Boolean(draft.trim() || mountedSkills.length > 0);

  function updateCursorFromInput() {
    const input = inputRef.current;
    if (input) setCursor(input.selectionStart);
  }

  function mountSkill(skill: CodexSkill) {
    setMountedSkills((current) => (current.some((item) => item.path === skill.path) ? current : [...current, skill]));
    if (slashTrigger) {
      const before = draft.slice(0, slashTrigger.from);
      const after = draft.slice(slashTrigger.to);
      const nextDraft = `${before}${after}`.replace(/[ \t]{2,}/g, " ");
      setDraft(nextDraft);
      requestAnimationFrame(() => {
        const nextCursor = before.length;
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(nextCursor, nextCursor);
        setCursor(nextCursor);
      });
    } else {
      inputRef.current?.focus();
    }
  }

  function detachSkill(skill: CodexSkill) {
    setMountedSkills((current) => current.filter((item) => item.path !== skill.path));
    inputRef.current?.focus();
  }

  async function submit() {
    if (!canSend) return;
    const skillPrefix = mountedSkills.map((skill) => `$${skill.name}`).join(" ");
    const text = [skillPrefix, draft.trim()].filter(Boolean).join(" ");
    const skillIds = mountedSkills.map((skill) => skill.id);
    setDraft("");
    setMountedSkills([]);
    setCursor(0);
    await onSendText(text, skillIds);
  }

  return (
    <form
      className="assistant-composer"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {mountedContexts.length > 0 && (
        <div className="assistant-mounted-context">
          {mountedContexts.map((context) => {
            const ContextIcon = context.type === "selection" ? TextSelect : FileText;
            return (
              <div
                key={context.id}
                className="assistant-mounted-chip"
                title={`${context.subtitle}：${context.title}`}
              >
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

      <div className="assistant-composer-field">
        {mountedSkills.map((skill) => (
          <span key={skill.path} className="assistant-skill-token" title={skill.description || skill.name}>
            <Sparkles size={12} />
            <span>{skill.name}</span>
            <button type="button" onClick={() => detachSkill(skill)} title="移除技能">
              <X size={10} />
            </button>
          </span>
        ))}
        <textarea
          ref={inputRef}
          className="assistant-composer-input"
          value={draft}
          placeholder={mountedSkills.length > 0 ? "继续补充要求..." : "输入 / 挂载 Codex 技能，或直接给 AI 助手发消息"}
          rows={Math.min(7, Math.max(2, draft.split("\n").length))}
          disabled={busy}
          onChange={(event) => {
            setDraft(event.target.value);
            setCursor(event.target.selectionStart);
          }}
          onClick={updateCursorFromInput}
          onKeyUp={updateCursorFromInput}
          onSelect={updateCursorFromInput}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && skillSuggestions.length > 0) {
              event.preventDefault();
              return;
            }
            if ((event.key === "Enter" || event.key === "Tab") && skillSuggestions.length > 0 && slashTrigger) {
              event.preventDefault();
              mountSkill(skillSuggestions[0]);
              return;
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        {skillSuggestions.length > 0 && (
          <div className="assistant-skill-menu">
            {skillSuggestions.map((skill, index) => (
              <button
                key={skill.path}
                type="button"
                className={clsx(index === 0 && "active")}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => mountSkill(skill)}
              >
                <Sparkles size={13} />
                <span>{skill.name}</span>
                {skill.description && <small>{skill.description}</small>}
              </button>
            ))}
          </div>
        )}
      </div>

      <button className="assistant-send-button" type="submit" title="发送" disabled={!canSend}>
        <SendHorizontal size={16} />
      </button>
    </form>
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

function getSkillSlashTrigger(value: string, cursor: number) {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/(?:^|\s)\/([^\s/]*)$/);
  if (!match || typeof match.index !== "number") return null;
  const slashOffset = match[0].lastIndexOf("/");
  const from = match.index + slashOffset;
  return {
    from,
    to: cursor,
    query: match[1] ?? "",
  };
}

function filterSkillSuggestions(skills: CodexSkill[], query: string, mountedSkills: CodexSkill[]) {
  const mountedPaths = new Set(mountedSkills.map((skill) => skill.path));
  const needle = query.trim().toLowerCase();
  return skills
    .filter((skill) => !mountedPaths.has(skill.path))
    .map((skill, index) => ({ skill, index, score: scoreSkillSuggestion(skill, needle) }))
    .filter((item) => item.score !== null)
    .sort((left, right) => (left.score ?? 0) - (right.score ?? 0) || left.index - right.index)
    .map((item) => item.skill);
}

function scoreSkillSuggestion(skill: CodexSkill, needle: string) {
  if (!needle) return 10;
  const name = skill.name.toLowerCase();
  const id = skill.id.toLowerCase();
  const description = skill.description.toLowerCase();
  if (name.startsWith(needle)) return 0;
  if (id.startsWith(needle)) return 1;
  if (name.includes(needle)) return 2;
  if (id.includes(needle)) return 3;
  if (description.includes(needle)) return 4;
  return null;
}
