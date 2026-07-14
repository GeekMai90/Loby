import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileText, Sparkles } from "lucide-react";
import type { RefObject } from "react";
import type { AiDocumentReference, CodexSkill } from "../types";

interface AssistantSkillSuggestionMenuProps {
  suggestions: CodexSkill[];
  activeIndex: number;
  activeRef: RefObject<HTMLButtonElement | null>;
  onActiveIndexChange: (index: number) => void;
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
  "nibva-glass-menu absolute right-2 bottom-[calc(100%+8px)] left-2 z-20 grid max-h-[min(340px,calc(100vh-180px))] gap-0.5 overflow-y-auto rounded-lg p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10";

const suggestionButtonClass =
  "grid min-h-9.5 w-full grid-cols-[18px_minmax(0,1fr)] items-center gap-2 px-2 py-1.5 text-left text-[13px] font-normal";

export function AssistantSkillSuggestionMenu({
  suggestions,
  activeIndex,
  activeRef,
  onActiveIndexChange,
  onSelectSkill,
}: AssistantSkillSuggestionMenuProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className={suggestionMenuClass} role="listbox" aria-label="Codex skills">
      {suggestions.map((skill, index) => (
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
      ))}
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
