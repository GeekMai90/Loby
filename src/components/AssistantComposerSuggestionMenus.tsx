import clsx from "clsx";
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

export function AssistantSkillSuggestionMenu({
  suggestions,
  activeIndex,
  activeRef,
  onActiveIndexChange,
  onSelectSkill,
}: AssistantSkillSuggestionMenuProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="assistant-skill-menu">
      {suggestions.map((skill, index) => (
        <button
          key={skill.path}
          ref={index === activeIndex ? activeRef : undefined}
          type="button"
          className={clsx(index === activeIndex && "active")}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => onActiveIndexChange(index)}
          onClick={() => onSelectSkill(skill)}
        >
          <Sparkles size={13} />
          <span>{skill.name}</span>
          {skill.description && <small>{skill.description}</small>}
        </button>
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
    <div className="assistant-document-menu">
      {suggestions.map((document, index) => (
        <button
          key={document.id}
          ref={index === activeIndex ? activeRef : undefined}
          type="button"
          className={clsx(index === activeIndex && "active")}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => onActiveIndexChange(index)}
          onClick={() => onSelectDocument(document)}
        >
          <FileText size={13} />
          <span>{document.title}</span>
          <small>{document.subtitle}</small>
        </button>
      ))}
    </div>
  );
}
