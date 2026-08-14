/**
 * [INPUT]: 依赖 React 运行时、lucide-react、当前对话连接目录、AI 助手模块与 shared 公共契约，并使用附件模块处理长文本粘贴
 * [OUTPUT]: 对外提供 AssistantComposer
 * [POS]: AI 助手 feature 的界面组合单元，连接 AI 助手状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  ASSISTANT_COMPOSER_PLACEHOLDERS,
  ASSISTANT_COMPOSER_PLACEHOLDER_INTERVAL_MS,
} from "@/features/assistant/constants/assistantComposer";
import {
  filterDocumentSuggestions,
  filterSkillSuggestions,
  getDocumentMentionTrigger,
  getSkillSlashTrigger,
  insertQuickPromptAtTrigger,
  isImeCompositionKey,
  shouldSubmitAssistantComposer,
} from "@/features/assistant/model/assistantComposer";
import { createSlashKeyTracker, normalizeSlashKeyInput, type SlashKeyTracker } from "@/shared/lib/imeSlashKey";
import { resizeTextareaToContent } from "@/shared/lib/textarea";
import { filterQuickPromptSuggestions } from "@/features/assistant/model/quickPrompts";
import type {
  AgentModel,
  AgentConversationSelection,
  AgentProvider,
  AgentReasoningEffort,
  AiAttachment,
  AiDocumentReference,
  AiMountedContext,
  AiQuickPrompt,
  AssistantSendMode,
  AgentSkill,
} from "@/shared/types";
import type { AgentConnectionDirectoryItem } from "@/features/assistant/model/agentConnectionDirectory";
import {
  AssistantComposerMountedContexts,
  AssistantComposerMountedSkills,
} from "@/features/assistant/components/AssistantComposerMountedItems";
import {
  AssistantDocumentSuggestionMenu,
  AssistantSlashSuggestionMenu,
} from "@/features/assistant/components/AssistantComposerSuggestionMenus";
import { AssistantComposerToolbar } from "@/features/assistant/components/AssistantComposerToolbar";
import {
  ASSISTANT_ATTACHMENT_ACCEPT,
  createAssistantPastedTextFile,
  getAssistantFilesFromClipboard,
  getAssistantFilesFromDataTransfer,
  getAssistantTextFromClipboard,
  shouldMountAssistantPastedText,
} from "@/features/assistant/model/assistantAttachments";
import { useAssistantAttachments } from "@/features/assistant/hooks/useAssistantAttachments";
import { AssistantAttachments } from "@/features/assistant/components/AssistantAttachments";
import { AssistantComposerShell } from "@/features/assistant/components/AssistantComposerShell";
import { AssistantComposerTextarea } from "@/features/assistant/components/AssistantComposerTextarea";

interface AssistantComposerProps {
  draftRequest?: { id: number; content: string } | null;
  busy: boolean;
  mountedContexts: AiMountedContext[];
  skills: AgentSkill[];
  quickPrompts: AiQuickPrompt[];
  documents: AiDocumentReference[];
  connections: AgentConnectionDirectoryItem[];
  connectionsLoading?: boolean;
  agentProvider: AgentProvider;
  agentModel: AgentModel;
  agentReasoningEffort: AgentReasoningEffort;
  assistantSendMode: AssistantSendMode;
  onDetachMountedContext: (contextId: string) => void;
  onAttachDocument: (sheetId: string) => void;
  onAgentSelectionChange: (selection: AgentConversationSelection) => void;
  onCancel: () => Promise<void> | void;
  onSendText: (text: string, skillIds?: string[], attachments?: AiAttachment[]) => Promise<void> | void;
  onSteerText: (text: string) => Promise<void> | void;
}

export function AssistantComposer({
  draftRequest,
  busy,
  mountedContexts,
  skills,
  quickPrompts,
  documents,
  connections,
  connectionsLoading,
  agentProvider,
  agentModel,
  agentReasoningEffort,
  assistantSendMode,
  onDetachMountedContext,
  onAttachDocument,
  onAgentSelectionChange,
  onCancel,
  onSendText,
  onSteerText,
}: AssistantComposerProps) {
  const slashSuggestionMenuId = useId();
  const documentSuggestionMenuId = useId();
  const [draft, setDraft] = useState("");
  const [cursor, setCursor] = useState(0);
  const [activeSlashIndex, setActiveSlashIndex] = useState(0);
  const [activeDocumentIndex, setActiveDocumentIndex] = useState(0);
  const [mountedSkills, setMountedSkills] = useState<AgentSkill[]>([]);
  const [dismissedSlashMenuKey, setDismissedSlashMenuKey] = useState("");
  const [dismissedDocumentMenuKey, setDismissedDocumentMenuKey] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [steering, setSteering] = useState(false);
  const [steeringError, setSteeringError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);
  const slashKeyTrackerRef = useRef<SlashKeyTracker | null>(null);
  slashKeyTrackerRef.current ??= createSlashKeyTracker();
  const slashKeyTracker = slashKeyTrackerRef.current;
  const pendingSelectionRef = useRef<number | null>(null);
  const activeSlashRef = useRef<HTMLButtonElement>(null);
  const activeDocumentRef = useRef<HTMLButtonElement>(null);
  const slashTrigger = getSkillSlashTrigger(draft, cursor);
  const documentTrigger = getDocumentMentionTrigger(draft, cursor);
  const slashMenuKey = slashTrigger ? `${slashTrigger.from}:${slashTrigger.to}:${slashTrigger.query}` : "";
  const documentMenuKey = documentTrigger ? `${documentTrigger.from}:${documentTrigger.to}:${documentTrigger.query}` : "";
  const slashMenuOpen = !busy && Boolean(slashTrigger && dismissedSlashMenuKey !== slashMenuKey);
  const quickPromptSuggestions = slashMenuOpen && slashTrigger ? filterQuickPromptSuggestions(quickPrompts, slashTrigger.query) : [];
  const skillSuggestions = slashMenuOpen && slashTrigger ? filterSkillSuggestions(skills, slashTrigger.query, mountedSkills) : [];
  const slashSuggestionCount = quickPromptSuggestions.length + skillSuggestions.length;
  const documentSuggestions =
    !busy && documentTrigger && dismissedDocumentMenuKey !== documentMenuKey
      ? filterDocumentSuggestions(documents, documentTrigger.query, mountedContexts).slice(0, 30)
      : [];
  const activeSuggestionMenuId =
    documentSuggestions.length > 0 ? documentSuggestionMenuId : slashSuggestionCount > 0 ? slashSuggestionMenuId : undefined;
  const activeSuggestionOptionId =
    documentSuggestions.length > 0
      ? `${documentSuggestionMenuId}-option-${activeDocumentIndex}`
      : slashSuggestionCount > 0
        ? `${slashSuggestionMenuId}-option-${activeSlashIndex}`
        : undefined;
  const {
    attachments,
    saving: attachmentSaving,
    error: attachmentError,
    addFiles,
    removeAttachment,
    clearAttachments,
  } = useAssistantAttachments();
  const canSend = busy
    ? !steering && Boolean(draft.trim())
    : !attachmentSaving && Boolean(draft.trim() || mountedSkills.length > 0 || attachments.length > 0);
  const composerPlaceholder = busy
    ? "继续输入，引导 AI..."
    : mountedSkills.length > 0
      ? "继续补充要求..."
      : (ASSISTANT_COMPOSER_PLACEHOLDERS[placeholderIndex] ?? ASSISTANT_COMPOSER_PLACEHOLDERS[0]);

  useEffect(() => {
    if (draft || busy || mountedSkills.length > 0) return;
    const interval = window.setInterval(() => {
      setPlaceholderIndex((current) => (current + 1) % ASSISTANT_COMPOSER_PLACEHOLDERS.length);
    }, ASSISTANT_COMPOSER_PLACEHOLDER_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [busy, draft, mountedSkills.length]);

  useEffect(() => {
    setActiveSlashIndex(0);
  }, [slashMenuKey, quickPromptSuggestions.length, skillSuggestions.length]);

  useEffect(() => {
    activeSlashRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeSlashIndex]);

  useEffect(() => {
    setActiveDocumentIndex(0);
  }, [documentMenuKey, documentSuggestions.length]);

  useEffect(() => {
    activeDocumentRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeDocumentIndex]);

  useEffect(() => {
    resizeTextareaToContent(inputRef.current);
  }, [draft]);

  // 输入热路径上的光标回位必须与 DOM 提交同帧，否则会看见光标先跳到末尾再弹回。
  useLayoutEffect(() => {
    const target = pendingSelectionRef.current;
    if (target === null) return;
    pendingSelectionRef.current = null;
    inputRef.current?.setSelectionRange(target, target);
  });

  useEffect(() => {
    if (!draftRequest) return;
    const nextCursor = draftRequest.content.length;
    setDraft(draftRequest.content);
    setCursor(nextCursor);
    setDismissedSlashMenuKey("");
    setDismissedDocumentMenuKey("");
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }, [draftRequest]);

  function updateCursorFromInput() {
    const input = inputRef.current;
    if (input) setCursor(input.selectionStart);
  }

  // 中文输入法把物理 `/` 键上屏成顿号时改写回 `/`；受控 textarea 的值被外部改写后
  // 浏览器会把光标甩到末尾，替身与 `/` 等长，所以只需在提交后原位放回。
  function acceptInputValue(input: HTMLTextAreaElement) {
    const nextCursor = input.selectionStart;
    const nextDraft = normalizeSlashKeyInput(input.value, nextCursor, slashKeyTracker);
    if (nextDraft !== input.value) pendingSelectionRef.current = nextCursor;
    setDraft(nextDraft);
    setCursor(nextCursor);
  }

  function mountSkill(skill: AgentSkill) {
    setMountedSkills((current) => (current.some((item) => item.path === skill.path) ? current : [...current, skill]));
    setDismissedSlashMenuKey("");
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

  function insertQuickPrompt(prompt: AiQuickPrompt) {
    setDismissedSlashMenuKey("");
    if (!slashTrigger) return;
    const insertion = insertQuickPromptAtTrigger(draft, slashTrigger, prompt.content);
    setDraft(insertion.value);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(insertion.cursor, insertion.cursor);
      setCursor(insertion.cursor);
    });
  }

  function selectSlashSuggestion(index: number) {
    if (index < quickPromptSuggestions.length) {
      const prompt = quickPromptSuggestions[index];
      if (prompt) insertQuickPrompt(prompt);
      return;
    }
    const skill = skillSuggestions[index - quickPromptSuggestions.length];
    if (skill) mountSkill(skill);
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

  function detachSkill(skill: AgentSkill) {
    setMountedSkills((current) => current.filter((item) => item.path !== skill.path));
    inputRef.current?.focus();
  }

  function moveActiveSlashSuggestion(direction: 1 | -1) {
    if (slashSuggestionCount === 0) return;
    setActiveSlashIndex((current) => (current + direction + slashSuggestionCount) % slashSuggestionCount);
  }

  function moveActiveDocument(direction: 1 | -1) {
    if (documentSuggestions.length === 0) return;
    setActiveDocumentIndex((current) => (current + direction + documentSuggestions.length) % documentSuggestions.length);
  }

  async function submit() {
    if (!canSend) return;
    if (busy) {
      const text = draft.trim();
      setSteering(true);
      setSteeringError("");
      try {
        await onSteerText(text);
        setDraft("");
        setCursor(0);
      } catch (error) {
        setSteeringError(error instanceof Error ? error.message : String(error));
      } finally {
        setSteering(false);
      }
      return;
    }
    const skillPrefix = mountedSkills.map((skill) => `$${skill.name}`).join(" ");
    const text = [skillPrefix, draft.trim()].filter(Boolean).join(" ");
    const skillIds = mountedSkills.map((skill) => skill.id);
    setDraft("");
    setMountedSkills([]);
    setCursor(0);
    clearAttachments();
    void onSendText(text, skillIds, attachments);
  }

  return (
    <AssistantComposerShell
      glowActive={busy}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        accept={ASSISTANT_ATTACHMENT_ACCEPT}
        multiple
        tabIndex={-1}
        onChange={(event) => {
          void addFiles(Array.from(event.target.files ?? []));
          event.currentTarget.value = "";
        }}
      />
      <AssistantComposerMountedContexts mountedContexts={mountedContexts} onDetachMountedContext={onDetachMountedContext} />

      <AssistantComposerMountedSkills mountedSkills={mountedSkills} onDetachSkill={detachSkill} />

      <AssistantAttachments attachments={attachments} onRemove={attachmentSaving ? undefined : removeAttachment} />

      {attachmentError && <p className="text-xs leading-4 text-destructive">{attachmentError}</p>}
      {attachmentSaving && <p className="text-xs leading-4 text-muted-foreground">正在保存附件…</p>}
      {steeringError && <p className="text-xs leading-4 text-destructive">{steeringError}</p>}

      <div data-slot="assistant-composer-input-group" className="grid gap-0">
        <div className="block min-w-0">
          <AssistantComposerTextarea
            ref={inputRef}
            value={draft}
            placeholder={composerPlaceholder}
            aria-label="给 AI 助手发送消息"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={Boolean(activeSuggestionMenuId)}
            aria-controls={activeSuggestionMenuId}
            aria-activedescendant={activeSuggestionOptionId}
            disabled={attachmentSaving}
            onChange={(event) => {
              acceptInputValue(event.target);
              setSteeringError("");
              setDismissedSlashMenuKey("");
              setDismissedDocumentMenuKey("");
            }}
            onPaste={(event) => {
              if (busy) return;
              const files = getAssistantFilesFromClipboard(event.clipboardData);
              if (files.length > 0) {
                event.preventDefault();
                void addFiles(files);
                return;
              }
              const pastedText = getAssistantTextFromClipboard(event.clipboardData);
              if (!shouldMountAssistantPastedText(pastedText)) return;
              event.preventDefault();
              void addFiles([createAssistantPastedTextFile(pastedText)]);
            }}
            onDragOver={(event) => {
              if (!busy && event.dataTransfer.types.includes("Files")) event.preventDefault();
            }}
            onDrop={(event) => {
              if (busy) return;
              const files = getAssistantFilesFromDataTransfer(event.dataTransfer);
              if (files.length === 0) return;
              event.preventDefault();
              void addFiles(files);
            }}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={(event) => {
              isComposingRef.current = false;
              acceptInputValue(event.currentTarget);
            }}
            onClick={updateCursorFromInput}
            onKeyUp={updateCursorFromInput}
            onSelect={updateCursorFromInput}
            onKeyDown={(event) => {
              // 必须先于 IME 短路记录：顿号正是在 IME 接管按键时上屏的。
              slashKeyTracker.observeKeyDown(event);
              if (isImeCompositionKey(event.nativeEvent, isComposingRef.current)) return;

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
              if (slashSuggestionCount > 0 && event.key === "ArrowDown") {
                event.preventDefault();
                moveActiveSlashSuggestion(1);
                return;
              }
              if (slashSuggestionCount > 0 && event.key === "ArrowUp") {
                event.preventDefault();
                moveActiveSlashSuggestion(-1);
                return;
              }
              if (slashSuggestionCount > 0 && event.key === "Home") {
                event.preventDefault();
                setActiveSlashIndex(0);
                return;
              }
              if (slashSuggestionCount > 0 && event.key === "End") {
                event.preventDefault();
                setActiveSlashIndex(slashSuggestionCount - 1);
                return;
              }
              if (slashSuggestionCount > 0 && event.key === "Escape") {
                event.preventDefault();
                setDismissedSlashMenuKey(slashMenuKey);
                return;
              }
              if ((event.key === "Enter" || event.key === "Tab") && slashSuggestionCount > 0 && slashTrigger) {
                event.preventDefault();
                selectSlashSuggestion(activeSlashIndex);
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
              if (shouldSubmitAssistantComposer(event, assistantSendMode)) {
                event.preventDefault();
                void submit();
              }
            }}
          />
          <AssistantSlashSuggestionMenu
            menuId={slashSuggestionMenuId}
            quickPrompts={quickPromptSuggestions}
            skills={skillSuggestions}
            activeIndex={activeSlashIndex}
            activeRef={activeSlashRef}
            onActiveIndexChange={setActiveSlashIndex}
            onSelectQuickPrompt={insertQuickPrompt}
            onSelectSkill={mountSkill}
          />
          <AssistantDocumentSuggestionMenu
            menuId={documentSuggestionMenuId}
            suggestions={documentSuggestions}
            activeIndex={activeDocumentIndex}
            activeRef={activeDocumentRef}
            onActiveIndexChange={setActiveDocumentIndex}
            onSelectDocument={mountDocument}
          />
        </div>

        <AssistantComposerToolbar
          busy={busy}
          canSend={canSend}
          connections={connections}
          connectionsLoading={connectionsLoading}
          agentProvider={agentProvider}
          agentModel={agentModel}
          agentReasoningEffort={agentReasoningEffort}
          onAgentSelectionChange={onAgentSelectionChange}
          onCancel={onCancel}
          onAttachAttachments={() => fileInputRef.current?.click()}
          attachmentDisabled={busy || attachmentSaving}
        />
      </div>
    </AssistantComposerShell>
  );
}
