import { FileText, Sparkles, TextSelect, X } from "lucide-react";
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
    <div className="assistant-mounted-context">
      {mountedContexts.map((context) => {
        const ContextIcon = context.type === "selection" ? TextSelect : FileText;
        return (
          <div key={context.id} className="assistant-mounted-chip" title={`${context.subtitle}：${context.title}`}>
            <ContextIcon size={13} />
            <span>{context.title}</span>
            <button type="button" onClick={() => onDetachMountedContext(context.id)} title="移除引用">
              <X size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function AssistantComposerMountedSkills({ mountedSkills, onDetachSkill }: AssistantComposerMountedSkillsProps) {
  if (mountedSkills.length === 0) return null;

  return (
    <div className="assistant-mounted-skills">
      {mountedSkills.map((skill) => (
        <span key={skill.path} className="assistant-skill-token" title={skill.description || skill.name}>
          <Sparkles size={12} />
          <span>{skill.name}</span>
          <button type="button" onClick={() => onDetachSkill(skill)} title="移除技能">
            <X size={10} />
          </button>
        </span>
      ))}
    </div>
  );
}
