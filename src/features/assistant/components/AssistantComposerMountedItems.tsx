/**
 * [INPUT]: 依赖 lucide-react、shadcn/ui 基础控件、shared 公共契约
 * [OUTPUT]: 对外提供 AssistantComposerMountedItem、AssistantComposerMountedContexts、AssistantComposerMountedSkills
 * [POS]: AI 助手 feature 的界面组合单元，连接 AI 助手状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { FileText, Sparkles, TextSelect, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AiMountedContext, AgentSkill } from "@/shared/types";

interface AssistantComposerMountedItemProps {
  icon: LucideIcon;
  label: string;
  title: string;
  onRemove?: () => void;
  removeTitle: string;
}

interface AssistantComposerMountedContextsProps {
  mountedContexts: AiMountedContext[];
  onDetachMountedContext: (contextId: string) => void;
}

interface AssistantComposerMountedSkillsProps {
  mountedSkills: AgentSkill[];
  onDetachSkill: (skill: AgentSkill) => void;
}

export function AssistantComposerMountedItem({ icon: Icon, label, title, onRemove, removeTitle }: AssistantComposerMountedItemProps) {
  return (
    <div
      className="group relative inline-grid min-h-6.5 w-fit max-w-39.5 grid-cols-[14px_minmax(0,auto)] items-center gap-1.5 rounded-lg border border-border bg-card/70 px-2.25 text-foreground"
      title={title}
    >
      <Icon className="text-muted-foreground" size={13} />
      <span className="max-w-29.5 truncate text-xs font-medium text-muted-foreground group-hover:pr-4">{label}</span>
      {onRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="pointer-events-none absolute top-1/2 right-0.75 -translate-y-1/2 opacity-0 transition-opacity duration-120 group-hover:pointer-events-auto group-hover:opacity-100"
          onClick={onRemove}
          title={removeTitle}
        >
          <X size={11} />
        </Button>
      ) : null}
    </div>
  );
}

export function AssistantComposerMountedContexts({ mountedContexts, onDetachMountedContext }: AssistantComposerMountedContextsProps) {
  if (mountedContexts.length === 0) return null;

  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {mountedContexts.map((context) => {
        const ContextIcon = context.type === "selection" ? TextSelect : FileText;
        return (
          <AssistantComposerMountedItem
            key={context.id}
            icon={ContextIcon}
            label={context.title}
            title={`${context.subtitle}：${context.title}`}
            onRemove={() => onDetachMountedContext(context.id)}
            removeTitle="移除引用"
          />
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
