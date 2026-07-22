/**
 * [INPUT]: 依赖 shadcn/ui 基础控件、shared 公共契约、lucide-react、React 运行时
 * [OUTPUT]: 对外提供 AssistantSlashSuggestionMenu、AssistantDocumentSuggestionMenu
 * [POS]: AI 助手 feature 的界面组合单元，连接 AI 助手状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { FileText, MessageSquareText, Sparkles } from "lucide-react";
import type { RefObject } from "react";
import type { AiDocumentReference, AiQuickPrompt, CodexSkill } from "@/shared/types";

interface AssistantSlashSuggestionMenuProps {
  quickPrompts: AiQuickPrompt[];
  skills: CodexSkill[];
  activeIndex: number;
  activeRef: RefObject<HTMLButtonElement | null>;
  onActiveIndexChange: (index: number) => void;
  onSelectQuickPrompt: (prompt: AiQuickPrompt) => void;
  onSelectSkill: (skill: CodexSkill) => void;
}

interface AssistantDocumentSuggestionMenuProps {
  suggestions: AiDocumentReference[];
  activeIndex: number;
  activeRef: RefObject<HTMLButtonElement | null>;
  onActiveIndexChange: (index: number) => void;
  onSelectDocument: (document: AiDocumentReference) => void;
}

const suggestionMenuClass =
  "loby-glass-menu absolute right-2 bottom-[calc(100%+8px)] left-2 z-20 grid max-h-[min(340px,calc(100vh-180px))] gap-0.5 overflow-y-auto rounded-lg p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10";

const suggestionButtonClass =
  "grid min-h-9.5 w-full grid-cols-[18px_minmax(0,1fr)] items-center gap-2 px-2 py-1.5 text-left text-[13px] font-normal";

export function AssistantSlashSuggestionMenu({
  quickPrompts,
  skills,
  activeIndex,
  activeRef,
  onActiveIndexChange,
  onSelectQuickPrompt,
  onSelectSkill,
}: AssistantSlashSuggestionMenuProps) {
  if (quickPrompts.length === 0 && skills.length === 0) return null;

  return (
    <div className={suggestionMenuClass} role="listbox" aria-label="快捷提示和 Codex skills">
      {quickPrompts.length > 0 ? <p className="px-2 pt-1 pb-0.5 text-[11px] font-medium text-muted-foreground">快捷提示</p> : null}
      {quickPrompts.map((prompt, index) => (
        <Button
          key={prompt.id}
          ref={index === activeIndex ? activeRef : undefined}
          type="button"
          variant="ghost"
          className={cn(suggestionButtonClass, index === activeIndex && "bg-accent text-accent-foreground")}
          role="option"
          aria-selected={index === activeIndex}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => onActiveIndexChange(index)}
          onClick={() => onSelectQuickPrompt(prompt)}
        >
          <MessageSquareText />
          <span className="truncate">{prompt.title}</span>
          <small className="col-start-2 truncate text-xs text-muted-foreground">{prompt.content}</small>
        </Button>
      ))}
      {skills.length > 0 ? <p className="px-2 pt-1 pb-0.5 text-[11px] font-medium text-muted-foreground">Codex Skills</p> : null}
      {skills.map((skill, skillIndex) => {
        const index = quickPrompts.length + skillIndex;
        return (
          <Button
            key={skill.path}
            ref={index === activeIndex ? activeRef : undefined}
            type="button"
            variant="ghost"
            className={cn(suggestionButtonClass, index === activeIndex && "bg-accent text-accent-foreground")}
            role="option"
            aria-selected={index === activeIndex}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => onActiveIndexChange(index)}
            onClick={() => onSelectSkill(skill)}
          >
            <Sparkles />
            <span className="truncate">{skill.name}</span>
            {skill.description && <small className="col-start-2 truncate text-xs text-muted-foreground">{skill.description}</small>}
          </Button>
        );
      })}
    </div>
  );
}

export function AssistantDocumentSuggestionMenu({
  suggestions,
  activeIndex,
  activeRef,
  onActiveIndexChange,
  onSelectDocument,
}: AssistantDocumentSuggestionMenuProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className={suggestionMenuClass} role="listbox" aria-label="文稿建议">
      {suggestions.map((document, index) => (
        <Button
          key={document.id}
          ref={index === activeIndex ? activeRef : undefined}
          type="button"
          variant="ghost"
          className={cn(suggestionButtonClass, index === activeIndex && "bg-accent text-accent-foreground")}
          role="option"
          aria-selected={index === activeIndex}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => onActiveIndexChange(index)}
          onClick={() => onSelectDocument(document)}
        >
          <FileText />
          <span className="truncate">{document.title}</span>
          <small className="col-start-2 truncate text-xs text-muted-foreground">{document.subtitle}</small>
        </Button>
      ))}
    </div>
  );
}
