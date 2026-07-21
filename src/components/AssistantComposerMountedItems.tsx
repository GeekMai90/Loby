import { FileText, Sparkles, TextSelect, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AiMountedContext, CodexSkill } from "../types";

interface AssistantComposerMountedContextsProps {
  mountedContexts: AiMountedContext[];
  onDetachMountedContext: (contextId: string) => void;
}

interface AssistantComposerMountedSkillsProps {
  mountedSkills: CodexSkill[];
  onDetachSkill: (skill: CodexSkill) => void;
}

export function AssistantComposerMountedContexts({ mountedContexts, onDetachMountedContext }: AssistantComposerMountedContextsProps) {
  if (mountedContexts.length === 0) return null;

  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {mountedContexts.map((context) => {
        const ContextIcon = context.type === "selection" ? TextSelect : FileText;
        return (
          <div
            key={context.id}
            className="group relative inline-grid min-h-6.5 w-fit max-w-39.5 grid-cols-[14px_minmax(0,auto)] items-center gap-1.5 rounded-lg border border-border bg-card/70 px-2.25 text-foreground"
            title={`${context.subtitle}：${context.title}`}
          >
            <ContextIcon className="text-muted-foreground" size={13} />
            <span className="max-w-29.5 truncate text-xs font-medium text-muted-foreground group-hover:pr-4">{context.title}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="pointer-events-none absolute top-1/2 right-0.75 -translate-y-1/2 opacity-0 transition-opacity duration-120 group-hover:pointer-events-auto group-hover:opacity-100"
              onClick={() => onDetachMountedContext(context.id)}
              title="移除引用"
            >
              <X size={11} />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

export function AssistantComposerMountedSkills({ mountedSkills, onDetachSkill }: AssistantComposerMountedSkillsProps) {
  if (mountedSkills.length === 0) return null;

  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {mountedSkills.map((skill) => (
        <span
          key={skill.path}
          className="inline-flex min-h-6.5 max-w-55 select-none items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 text-xs leading-[1.45] font-semibold text-primary"
          title={skill.description || skill.name}
        >
          <Sparkles className="shrink-0" size={12} />
          <span className="truncate">{skill.name}</span>
          <Button type="button" variant="ghost" size="icon-xs" onClick={() => onDetachSkill(skill)} title="移除技能">
            <X size={10} />
          </Button>
        </span>
      ))}
    </div>
  );
}
