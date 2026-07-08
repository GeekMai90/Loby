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
import { Copy, FileText, Gauge, Menu, MessageSquare, Pencil, Plus, SendHorizontal, Sparkles, TextSelect, Trash2, X } from "lucide-react";
import remarkGfm from "remark-gfm";
import { copyTextToClipboard } from "../lib/export";
import type {
  AgentModel,
  AgentReasoningEffort,
  AiDocumentReference,
  AiMountedContext,
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
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: () => void;
  onDeleteConversation: () => void;
  onRenameConversation: (conversationId: string, title: string) => void;
  onDetachMountedContext: (contextId: string) => void;
  onAttachDocument: (sheetId: string) => void;
  onAgentModelChange: (model: AgentModel) => void;
  onAgentReasoningEffortChange: (effort: AgentReasoningEffort) => void;
  onAgentQuickModeChange: (enabled: boolean) => void;
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
  documents,
  modelCatalog,
  agentModel,
  agentReasoningEffort,
  agentQuickMode,
  onSelectConversation,
  onCreateConversation,
  onDeleteConversation,
  onRenameConversation,
  onDetachMountedContext,
  onAttachDocument,
  onAgentModelChange,
  onAgentReasoningEffortChange,
  onAgentQuickModeChange,
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
  onDetachMountedContext,
  onAttachDocument,
  onAgentModelChange,
  onAgentReasoningEffortChange,
  onAgentQuickModeChange,
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
  onDetachMountedContext: (contextId: string) => void;
  onAttachDocument: (sheetId: string) => void;
  onAgentModelChange: (model: AgentModel) => void;
  onAgentReasoningEffortChange: (effort: AgentReasoningEffort) => void;
  onAgentQuickModeChange: (enabled: boolean) => void;
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
  documents,
  modelCatalog,
  agentModel,
  agentReasoningEffort,
  agentQuickMode,
  onDetachMountedContext,
  onAttachDocument,
  onAgentModelChange,
  onAgentReasoningEffortChange,
  onAgentQuickModeChange,
  onSendText,
}: {
  busy: boolean;
  mountedContexts: AiMountedContext[];
  skills: CodexSkill[];
  documents: AiDocumentReference[];
  modelCatalog: CodexModelCatalog | null;
  agentModel: AgentModel;
  agentReasoningEffort: AgentReasoningEffort;
  agentQuickMode: boolean;
  onDetachMountedContext: (contextId: string) => void;
  onAttachDocument: (sheetId: string) => void;
  onAgentModelChange: (model: AgentModel) => void;
  onAgentReasoningEffortChange: (effort: AgentReasoningEffort) => void;
  onAgentQuickModeChange: (enabled: boolean) => void;
  onSendText: (text: string, skillIds?: string[]) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState("");
  const [cursor, setCursor] = useState(0);
  const [activeSkillIndex, setActiveSkillIndex] = useState(0);
  const [activeDocumentIndex, setActiveDocumentIndex] = useState(0);
  const [mountedSkills, setMountedSkills] = useState<CodexSkill[]>([]);
  const [dismissedSkillMenuKey, setDismissedSkillMenuKey] = useState("");
  const [dismissedDocumentMenuKey, setDismissedDocumentMenuKey] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeSkillRef = useRef<HTMLButtonElement>(null);
  const activeDocumentRef = useRef<HTMLButtonElement>(null);
  const slashTrigger = getSkillSlashTrigger(draft, cursor);
  const documentTrigger = getDocumentMentionTrigger(draft, cursor);
  const skillMenuKey = slashTrigger ? `${slashTrigger.from}:${slashTrigger.to}:${slashTrigger.query}` : "";
  const documentMenuKey = documentTrigger ? `${documentTrigger.from}:${documentTrigger.to}:${documentTrigger.query}` : "";
  const skillSuggestions =
    slashTrigger && dismissedSkillMenuKey !== skillMenuKey
      ? filterSkillSuggestions(skills, slashTrigger.query, mountedSkills)
      : [];
  const documentSuggestions =
    documentTrigger && dismissedDocumentMenuKey !== documentMenuKey
      ? filterDocumentSuggestions(documents, documentTrigger.query, mountedContexts).slice(0, 30)
      : [];
  const modelOptions = buildModelOptions(modelCatalog, agentModel);
  const reasoningOptions = getReasoningLevels(modelCatalog, agentModel, agentReasoningEffort).map((level) => ({
    value: level,
    label: formatReasoningLevel(level),
  }));
  const canSend = !busy && Boolean(draft.trim() || mountedSkills.length > 0);

  useEffect(() => {
    setActiveSkillIndex(0);
  }, [skillMenuKey, skillSuggestions.length]);

  useEffect(() => {
    activeSkillRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeSkillIndex]);

  useEffect(() => {
    setActiveDocumentIndex(0);
  }, [documentMenuKey, documentSuggestions.length]);

  useEffect(() => {
    activeDocumentRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeDocumentIndex]);

  function updateCursorFromInput() {
    const input = inputRef.current;
    if (input) setCursor(input.selectionStart);
  }

  function mountSkill(skill: CodexSkill) {
    setMountedSkills((current) => (current.some((item) => item.path === skill.path) ? current : [...current, skill]));
    setDismissedSkillMenuKey("");
    if (slashTrigger) {
      const before = draft.slice(0, slashTrigger.from);
      const after = draft.slice(slashTrigger.to);
      const nextDraft = `${before}${after}`.replace(/[ \t]{2,}/g, " ").trimStart();
      setDraft(nextDraft);
      requestAnimationFrame(() => {
        const nextCursor = Math.max(0, before.trimEnd().length);
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(nextCursor, nextCursor);
        setCursor(nextCursor);
      });
    } else {
      inputRef.current?.focus();
    }
  }

  function mountDocument(document: AiDocumentReference) {
    onAttachDocument(document.sheetId);
    setDismissedDocumentMenuKey("");
    if (documentTrigger) {
      const before = draft.slice(0, documentTrigger.from);
      const after = draft.slice(documentTrigger.to);
      const nextDraft = `${before}${after}`.replace(/[ \t]{2,}/g, " ").trimStart();
      setDraft(nextDraft);
      requestAnimationFrame(() => {
        const nextCursor = Math.max(0, before.trimEnd().length);
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(nextCursor, nextCursor);
        setCursor(nextCursor);
      });
    } else {
      inputRef.current?.focus();
    }
  }

  function removeLastMountedSkill() {
    setMountedSkills((current) => current.slice(0, -1));
  }

  function detachSkill(skill: CodexSkill) {
    setMountedSkills((current) => current.filter((item) => item.path !== skill.path));
    inputRef.current?.focus();
  }

  function moveActiveSkill(direction: 1 | -1) {
    if (skillSuggestions.length === 0) return;
    setActiveSkillIndex((current) => (current + direction + skillSuggestions.length) % skillSuggestions.length);
  }

  function moveActiveDocument(direction: 1 | -1) {
    if (documentSuggestions.length === 0) return;
    setActiveDocumentIndex((current) => (current + direction + documentSuggestions.length) % documentSuggestions.length);
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

      {mountedSkills.length > 0 && (
        <div className="assistant-mounted-skills">
          {mountedSkills.map((skill) => (
            <span key={skill.path} className="assistant-skill-token" title={skill.description || skill.name}>
              <Sparkles size={12} />
              <span>{skill.name}</span>
              <button type="button" onClick={() => detachSkill(skill)} title="移除技能">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="assistant-composer-field">
        <textarea
          ref={inputRef}
          className="assistant-composer-input"
          value={draft}
          placeholder={mountedSkills.length > 0 ? "继续补充要求..." : "输入 / 挂载 Codex skill，或直接给 AI 助手发消息"}
          rows={Math.min(8, Math.max(1, draft.split("\n").length))}
          disabled={busy}
          onChange={(event) => {
            setDraft(event.target.value);
            setCursor(event.target.selectionStart);
            setDismissedSkillMenuKey("");
            setDismissedDocumentMenuKey("");
          }}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={(event) => {
            setIsComposing(false);
            setDraft(event.currentTarget.value);
            setCursor(event.currentTarget.selectionStart);
          }}
          onClick={updateCursorFromInput}
          onKeyUp={updateCursorFromInput}
          onSelect={updateCursorFromInput}
          onKeyDown={(event) => {
            if (isComposing || event.nativeEvent.isComposing) {
              return;
            }
            if (documentSuggestions.length > 0 && event.key === "ArrowDown") {
              event.preventDefault();
              moveActiveDocument(1);
              return;
            }
            if (documentSuggestions.length > 0 && event.key === "ArrowUp") {
              event.preventDefault();
              moveActiveDocument(-1);
              return;
            }
            if (documentSuggestions.length > 0 && event.key === "Home") {
              event.preventDefault();
              setActiveDocumentIndex(0);
              return;
            }
            if (documentSuggestions.length > 0 && event.key === "End") {
              event.preventDefault();
              setActiveDocumentIndex(documentSuggestions.length - 1);
              return;
            }
            if (documentSuggestions.length > 0 && event.key === "Escape") {
              event.preventDefault();
              setDismissedDocumentMenuKey(documentMenuKey);
              return;
            }
            if ((event.key === "Enter" || event.key === "Tab") && documentSuggestions.length > 0 && documentTrigger) {
              event.preventDefault();
              mountDocument(documentSuggestions[activeDocumentIndex] ?? documentSuggestions[0]);
              return;
            }
            if (skillSuggestions.length > 0 && event.key === "ArrowDown") {
              event.preventDefault();
              moveActiveSkill(1);
              return;
            }
            if (skillSuggestions.length > 0 && event.key === "ArrowUp") {
              event.preventDefault();
              moveActiveSkill(-1);
              return;
            }
            if (skillSuggestions.length > 0 && event.key === "Home") {
              event.preventDefault();
              setActiveSkillIndex(0);
              return;
            }
            if (skillSuggestions.length > 0 && event.key === "End") {
              event.preventDefault();
              setActiveSkillIndex(skillSuggestions.length - 1);
              return;
            }
            if (skillSuggestions.length > 0 && event.key === "Escape") {
              event.preventDefault();
              setDismissedSkillMenuKey(skillMenuKey);
              return;
            }
            if ((event.key === "Enter" || event.key === "Tab") && skillSuggestions.length > 0 && slashTrigger) {
              event.preventDefault();
              mountSkill(skillSuggestions[activeSkillIndex] ?? skillSuggestions[0]);
              return;
            }
            if (
              (event.key === "Backspace" || event.key === "Delete") &&
              mountedSkills.length > 0 &&
              inputRef.current?.selectionStart === 0 &&
              inputRef.current.selectionEnd === 0
            ) {
              event.preventDefault();
              removeLastMountedSkill();
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
                ref={index === activeSkillIndex ? activeSkillRef : undefined}
                type="button"
                className={clsx(index === activeSkillIndex && "active")}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveSkillIndex(index)}
                onClick={() => mountSkill(skill)}
              >
                <Sparkles size={13} />
                <span>{skill.name}</span>
                {skill.description && <small>{skill.description}</small>}
              </button>
            ))}
          </div>
        )}
        {documentSuggestions.length > 0 && (
          <div className="assistant-document-menu">
            {documentSuggestions.map((document, index) => (
              <button
                key={document.id}
                ref={index === activeDocumentIndex ? activeDocumentRef : undefined}
                type="button"
                className={clsx(index === activeDocumentIndex && "active")}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveDocumentIndex(index)}
                onClick={() => mountDocument(document)}
              >
                <FileText size={13} />
                <span>{document.title}</span>
                <small>{document.subtitle}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="assistant-composer-toolbar">
        <div className="assistant-composer-tools">
          <AssistantToolbarSelect
            label="模型"
            value={agentModel}
            options={modelOptions}
            onChange={(nextModel) => {
              onAgentModelChange(nextModel);
              const model = modelCatalog?.models.find((item) => item.slug === nextModel);
              if (model?.defaultReasoningLevel) onAgentReasoningEffortChange(model.defaultReasoningLevel);
            }}
          />
          <AssistantToolbarSelect
            label="思考程度"
            value={agentReasoningEffort}
            options={reasoningOptions}
            onChange={onAgentReasoningEffortChange}
          />
          <button
            type="button"
            className={clsx("assistant-tool-toggle", agentQuickMode && "active")}
            onClick={() => onAgentQuickModeChange(!agentQuickMode)}
            disabled={!modelSupportsQuickMode(modelCatalog, agentModel)}
            title="快速模式"
          >
            <Gauge size={13} />
            <span>快速</span>
          </button>
        </div>
        <button className="assistant-send-button" type="submit" title="发送" disabled={!canSend}>
          <SendHorizontal size={16} />
        </button>
      </div>
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

function AssistantToolbarSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0] ?? { value, label: value || label };

  useEffect(() => {
    if (!open) return;
    function close(event: PointerEvent) {
      if (wrapRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div className="assistant-toolbar-select" ref={wrapRef}>
      <button type="button" className="assistant-toolbar-select-button" onClick={() => setOpen((current) => !current)} title={label}>
        <span>{selected.label}</span>
      </button>
      {open && (
        <div className="assistant-toolbar-select-menu">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={clsx(option.value === selected.value && "active")}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
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

function getDocumentMentionTrigger(value: string, cursor: number) {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/(?:^|\s)@([^\s@/]*)$/);
  if (!match || typeof match.index !== "number") return null;
  const mentionOffset = match[0].lastIndexOf("@");
  const from = match.index + mentionOffset;
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

function filterDocumentSuggestions(documents: AiDocumentReference[], query: string, mountedContexts: AiMountedContext[]) {
  const mountedSheetIds = new Set(mountedContexts.filter((context) => context.type === "document").map((context) => context.sheetId));
  const needle = query.trim().toLowerCase();
  return documents
    .filter((document) => !mountedSheetIds.has(document.sheetId))
    .map((document, index) => ({ document, index, score: scoreDocumentSuggestion(document, needle) }))
    .filter((item) => item.score !== null)
    .sort((left, right) => (left.score ?? 0) - (right.score ?? 0) || left.index - right.index)
    .map((item) => item.document);
}

function scoreDocumentSuggestion(document: AiDocumentReference, needle: string) {
  if (!needle) return 10;
  const title = document.title.toLowerCase();
  const subtitle = document.subtitle.toLowerCase();
  const summary = document.summary.toLowerCase();
  if (title.startsWith(needle)) return 0;
  if (title.includes(needle)) return 1;
  if (subtitle.includes(needle)) return 2;
  if (summary.includes(needle)) return 3;
  return null;
}

function scoreSkillSuggestion(skill: CodexSkill, needle: string) {
  const name = skill.name.toLowerCase();
  const id = skill.id.toLowerCase();
  const description = skill.description.toLowerCase();
  if (!needle) return 10;
  if (name.startsWith(needle)) return 0;
  if (id.startsWith(needle)) return 1;
  if (name.includes(needle)) return 2;
  if (id.includes(needle)) return 3;
  if (description.includes(needle)) return 4;
  return null;
}

function getReasoningLevels(catalog: CodexModelCatalog | null, modelSlug: string, current: string) {
  const model = catalog?.models.find((item) => item.slug === modelSlug);
  const levels = model?.supportedReasoningLevels.map((level) => level.effort).filter(Boolean) ?? [];
  const withCurrent = current && !levels.includes(current) ? [...levels, current] : levels;
  return withCurrent.length > 0 ? withCurrent : ["low", "medium", "high"];
}

function buildModelOptions(catalog: CodexModelCatalog | null, current: string) {
  const options =
    catalog?.models.map((model) => ({
      value: model.slug,
      label: model.displayName || model.slug,
    })) ?? [];
  if (current && !options.some((option) => option.value === current)) {
    return [...options, { value: current, label: current }];
  }
  return options.length > 0 ? options : [{ value: current || "auto", label: current || "auto" }];
}

function formatReasoningLevel(level: string) {
  const labels: Record<string, string> = {
    low: "低",
    medium: "中",
    high: "高",
    xhigh: "极高",
  };
  return labels[level] ?? level;
}

function modelSupportsQuickMode(catalog: CodexModelCatalog | null, modelSlug: string) {
  const model = catalog?.models.find((item) => item.slug === modelSlug);
  return Boolean(model?.additionalSpeedTiers.includes("fast") || model?.serviceTiers.some((tier) => tier.id === "priority"));
}
