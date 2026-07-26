/**
 * [INPUT]: 依赖通用 SuggestionMenu primitives、shared 公共契约、lucide-react、React 运行时
 * [OUTPUT]: 对外提供 AssistantSlashSuggestionMenu、AssistantDocumentSuggestionMenu
 * [POS]: AI 助手 feature 的界面组合单元，连接 AI 助手状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { SuggestionMenu, SuggestionMenuItem, SuggestionMenuLabel } from "@/components/ui/suggestion-menu";
import { FileText, MessageSquareText, Sparkles } from "lucide-react";
import type { RefObject } from "react";
import type { AiDocumentReference, AiQuickPrompt, AgentSkill } from "@/shared/types";

interface AssistantSlashSuggestionMenuProps {
  quickPrompts: AiQuickPrompt[];
  skills: AgentSkill[];
  activeIndex: number;
  activeRef: RefObject<HTMLButtonElement | null>;
  menuId: string;
  onActiveIndexChange: (index: number) => void;
  onSelectQuickPrompt: (prompt: AiQuickPrompt) => void;
  onSelectSkill: (skill: AgentSkill) => void;
}

interface AssistantDocumentSuggestionMenuProps {
  suggestions: AiDocumentReference[];
  activeIndex: number;
  activeRef: RefObject<HTMLButtonElement | null>;
  menuId: string;
  onActiveIndexChange: (index: number) => void;
  onSelectDocument: (document: AiDocumentReference) => void;
}

const suggestionMenuClass = "absolute right-2 bottom-[calc(100%+8px)] left-2 z-20 max-h-[min(340px,calc(100vh-180px))]";

export function AssistantSlashSuggestionMenu({
  quickPrompts,
  skills,
  activeIndex,
  activeRef,
  menuId,
  onActiveIndexChange,
  onSelectQuickPrompt,
  onSelectSkill,
}: AssistantSlashSuggestionMenuProps) {
  if (quickPrompts.length === 0 && skills.length === 0) return null;

  return (
    <SuggestionMenu id={menuId} className={suggestionMenuClass} aria-label="快捷提示和 Agent Skills">
      {quickPrompts.length > 0 ? <SuggestionMenuLabel>快捷提示</SuggestionMenuLabel> : null}
      {quickPrompts.map((prompt, index) => (
        <SuggestionMenuItem
          key={prompt.id}
          id={`${menuId}-option-${index}`}
          ref={index === activeIndex ? activeRef : undefined}
          active={index === activeIndex}
          icon={<MessageSquareText />}
          title={prompt.title}
          description={prompt.content}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => onActiveIndexChange(index)}
          onClick={() => onSelectQuickPrompt(prompt)}
        />
      ))}
      {skills.length > 0 ? <SuggestionMenuLabel>Agent Skills</SuggestionMenuLabel> : null}
      {skills.map((skill, skillIndex) => {
        const index = quickPrompts.length + skillIndex;
        return (
          <SuggestionMenuItem
            key={skill.path}
            id={`${menuId}-option-${index}`}
            ref={index === activeIndex ? activeRef : undefined}
            active={index === activeIndex}
            icon={<Sparkles />}
            title={skill.name}
            description={skill.description}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => onActiveIndexChange(index)}
            onClick={() => onSelectSkill(skill)}
          />
        );
      })}
    </SuggestionMenu>
  );
}

export function AssistantDocumentSuggestionMenu({
  suggestions,
  activeIndex,
  activeRef,
  menuId,
  onActiveIndexChange,
  onSelectDocument,
}: AssistantDocumentSuggestionMenuProps) {
  if (suggestions.length === 0) return null;

  return (
    <SuggestionMenu id={menuId} className={suggestionMenuClass} aria-label="文稿建议">
      {suggestions.map((document, index) => (
        <SuggestionMenuItem
          key={document.id}
          id={`${menuId}-option-${index}`}
          ref={index === activeIndex ? activeRef : undefined}
          active={index === activeIndex}
          icon={<FileText />}
          title={document.title}
          description={document.subtitle}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => onActiveIndexChange(index)}
          onClick={() => onSelectDocument(document)}
        />
      ))}
    </SuggestionMenu>
  );
}
