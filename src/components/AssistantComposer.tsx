import { useEffect, useRef, useState } from "react";
import {
  buildModelOptions,
  filterDocumentSuggestions,
  filterSkillSuggestions,
  formatReasoningLevel,
  getDocumentMentionTrigger,
  getReasoningLevels,
  getSkillSlashTrigger,
  modelSupportsQuickMode,
} from "../lib/assistantComposer";
import { resizeTextareaToContent } from "../lib/textarea";
import type { AgentModel, AgentReasoningEffort, AiDocumentReference, AiMountedContext, CodexModelCatalog, CodexSkill } from "../types";
import { AssistantComposerMountedContexts, AssistantComposerMountedSkills } from "./AssistantComposerMountedItems";
import { AssistantDocumentSuggestionMenu, AssistantSkillSuggestionMenu } from "./AssistantComposerSuggestionMenus";
import { AssistantComposerToolbar } from "./AssistantComposerToolbar";

interface AssistantComposerProps {
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
  onCancel: () => Promise<void> | void;
  onSendText: (text: string, skillIds?: string[]) => Promise<void> | void;
}

export function AssistantComposer({
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
  onCancel,
  onSendText,
}: AssistantComposerProps) {
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
    slashTrigger && dismissedSkillMenuKey !== skillMenuKey ? filterSkillSuggestions(skills, slashTrigger.query, mountedSkills) : [];
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

  useEffect(() => {
    resizeTextareaToContent(inputRef.current);
  }, [draft]);

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
    void onSendText(text, skillIds);
  }

  function changeModel(nextModel: AgentModel) {
    onAgentModelChange(nextModel);
    const model = modelCatalog?.models.find((item) => item.slug === nextModel);
    if (model?.defaultReasoningLevel) onAgentReasoningEffortChange(model.defaultReasoningLevel);
  }

  return (
    <form
      className="assistant-composer"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <AssistantComposerMountedContexts mountedContexts={mountedContexts} onDetachMountedContext={onDetachMountedContext} />

      <AssistantComposerMountedSkills mountedSkills={mountedSkills} onDetachSkill={detachSkill} />

      <div className="assistant-composer-field">
        <textarea
          ref={inputRef}
          className="assistant-composer-input"
          value={draft}
          placeholder={mountedSkills.length > 0 ? "继续补充要求..." : "输入 / 挂载 Codex skill，或直接给 AI 助手发消息"}
          rows={3}
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
            if (isComposing || event.nativeEvent.isComposing) return;

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
        <AssistantSkillSuggestionMenu
          suggestions={skillSuggestions}
          activeIndex={activeSkillIndex}
          activeRef={activeSkillRef}
          onActiveIndexChange={setActiveSkillIndex}
          onSelectSkill={mountSkill}
        />
        <AssistantDocumentSuggestionMenu
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
        modelOptions={modelOptions}
        reasoningOptions={reasoningOptions}
        agentModel={agentModel}
        agentReasoningEffort={agentReasoningEffort}
        agentQuickMode={agentQuickMode}
        quickModeSupported={modelSupportsQuickMode(modelCatalog, agentModel)}
        onModelChange={changeModel}
        onReasoningEffortChange={onAgentReasoningEffortChange}
        onQuickModeChange={onAgentQuickModeChange}
        onCancel={onCancel}
      />
    </form>
  );
}
