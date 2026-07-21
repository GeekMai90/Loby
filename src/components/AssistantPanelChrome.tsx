import { Slot } from "radix-ui";
import { useState, type ComponentProps, type ReactNode } from "react";
import { CheckCheck, ChevronDown, ChevronUp, ListTree, Logs, Plus, WandSparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AiAssistantOrb } from "./AiAssistantOrb";
import { ShinyText } from "./ShinyText";
import type { AiQuickPrompt } from "../types";

interface AssistantPanelHeaderFrameProps {
  title: string;
  titleTooltip?: string;
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function AssistantPanelHeaderFrame({ title, titleTooltip = title, left, right, className }: AssistantPanelHeaderFrameProps) {
  return (
    <header
      data-slot="assistant-panel-header"
      className={cn(
        "ai-chat-header absolute inset-x-0 top-0 z-20 grid min-h-14 shrink-0 grid-cols-[80px_minmax(0,1fr)_132px] items-center gap-2 px-[var(--assistant-panel-gutter)] isolate [-webkit-app-region:drag]",
        className,
      )}
    >
      <div className="relative justify-self-start [-webkit-app-region:no-drag]">{left}</div>
      <div
        className="block w-full max-w-37.5 min-w-0 justify-self-center truncate text-center text-sm leading-[1.4] font-medium"
        title={titleTooltip}
      >
        {title}
      </div>
      <div className="inline-flex w-33 items-center justify-end justify-self-end [-webkit-app-region:no-drag]">{right}</div>
    </header>
  );
}

interface AssistantThreadViewportProps extends ComponentProps<"div"> {
  asChild?: boolean;
}

export function AssistantThreadViewport({ asChild = false, className, ...props }: AssistantThreadViewportProps) {
  const Comp = asChild ? Slot.Root : "div";
  return (
    <Comp
      data-slot="assistant-thread-viewport"
      className={cn(
        "flex min-h-0 flex-auto flex-col gap-2.5 overflow-x-hidden overflow-y-auto pb-0.75 pt-16.75 [scrollbar-gutter:stable]",
        className,
      )}
      {...props}
    />
  );
}

interface AssistantEmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

export function AssistantEmptyState({ title, description, icon, actions }: AssistantEmptyStateProps) {
  return (
    <div data-slot="assistant-empty-state" className="grid min-h-40 flex-auto place-items-center px-2 text-muted-foreground">
      <div className="w-full max-w-72 text-center">
        {icon}
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {description ? <p className="mx-auto mt-1.5 max-w-58 text-xs leading-5 text-muted-foreground">{description}</p> : null}
        {actions}
      </div>
    </div>
  );
}

const BUILT_IN_ASSISTANT_PROMPTS = [
  { id: "check-typos", title: "检查错别字", content: "检查当前文章中的错别字和明显标点问题。", Icon: CheckCheck },
  { id: "light-polish", title: "简单润色", content: "在不改变原意的前提下，简单润色当前文章。", Icon: WandSparkles },
  { id: "review-structure", title: "梳理文章结构", content: "梳理当前文章的结构，并给出简短建议。", Icon: ListTree },
] as const;

const assistantPromptActionClass =
  "-ml-2 h-7 justify-start gap-2 px-2 text-[13px] font-normal text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground";

interface AssistantQuickPromptEmptyStateProps {
  quickPrompts: AiQuickPrompt[];
  quickPromptsReady: boolean;
  busy: boolean;
  onSelectPrompt: (content: string) => void;
  onOpenQuickPromptSettings: () => void;
}

export function AssistantQuickPromptEmptyState({
  quickPrompts,
  quickPromptsReady,
  busy,
  onSelectPrompt,
  onOpenQuickPromptSettings,
}: AssistantQuickPromptEmptyStateProps) {
  const [expanded, setExpanded] = useState(false);
  const hasCustomPrompts = quickPrompts.length > 0;
  const visibleCustomPrompts = expanded ? quickPrompts : quickPrompts.slice(0, 3);
  const hiddenPromptCount = quickPrompts.length - visibleCustomPrompts.length;

  return (
    <div data-slot="assistant-empty-state" className="flex min-h-40 flex-auto items-end justify-start px-2 pb-3 text-muted-foreground">
      <div className="w-full text-left">
        <span className="assistant-launcher mb-4 grid size-10 place-items-center" aria-hidden="true">
          <AiAssistantOrb />
        </span>
        <h2 className="text-lg leading-7 font-semibold">
          <ShinyText
            text="✨ AI 无法代替你思考"
            speed={2.8}
            delay={1.2}
            color="var(--text-primary)"
            shineColor="var(--primary)"
            spread={105}
          />
        </h2>

        {quickPromptsReady && hasCustomPrompts ? (
          <div className="mt-4">
            <div className="grid gap-0">
              {visibleCustomPrompts.map((prompt) => (
                <Button
                  key={prompt.id}
                  type="button"
                  variant="ghost"
                  className={assistantPromptActionClass}
                  disabled={busy}
                  onClick={() => onSelectPrompt(prompt.content)}
                >
                  <Logs />
                  <span className="truncate">{prompt.title}</span>
                </Button>
              ))}
              {quickPrompts.length > 3 ? (
                <Button
                  type="button"
                  variant="ghost"
                  className={assistantPromptActionClass}
                  onClick={() => setExpanded((current) => !current)}
                >
                  {expanded ? <ChevronUp /> : <ChevronDown />}
                  {expanded ? "收起" : `再显示 ${hiddenPromptCount} 个`}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {quickPromptsReady && !hasCustomPrompts ? (
          <div className="mt-4">
            <div className="grid gap-0">
              {BUILT_IN_ASSISTANT_PROMPTS.map(({ id, title, content, Icon }) => (
                <Button
                  key={id}
                  type="button"
                  variant="ghost"
                  className={assistantPromptActionClass}
                  disabled={busy}
                  onClick={() => onSelectPrompt(content)}
                >
                  <Icon />
                  {title}
                </Button>
              ))}
            </div>

            <Button type="button" variant="ghost" className={assistantPromptActionClass} onClick={onOpenQuickPromptSettings}>
              <Plus />
              设置快捷提示
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
