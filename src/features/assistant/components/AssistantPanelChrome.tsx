/**
 * [INPUT]: 依赖 Radix Slot、React、lucide-react、shadcn Button、ShinyText、AI orb/quick prompt 契约与 foreground/primary Token
 * [OUTPUT]: 对外提供沿 26px 顶部中心线布局的 AssistantPanelHeaderFrame、匹配其高度的 AssistantThreadViewport、AssistantPromptEmptyState、ASSISTANT_PROMPT_ACTION_CLASS_NAME、AssistantQuickPromptEmptyState
 * [POS]: AI 助手 feature 的界面组合单元，连接 AI 助手状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Slot } from "radix-ui";
import { useState, type ComponentProps, type ReactNode } from "react";
import { CheckCheck, ChevronDown, ChevronUp, ListTree, Logs, Plus, WandSparkles } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/components/ui/button";
import { AiAssistantOrb } from "@/features/assistant/components/AiAssistantOrb";
import { ShinyText } from "@/shared/components/ShinyText";
import type { AiQuickPrompt } from "@/shared/types";

interface AssistantPanelHeaderFrameProps {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function AssistantPanelHeaderFrame({ title, left, right, className }: AssistantPanelHeaderFrameProps) {
  return (
    <header
      data-slot="assistant-panel-header"
      className={cn(
        "ai-chat-header absolute inset-x-0 top-0 z-20 grid min-h-[50px] shrink-0 grid-cols-[80px_minmax(0,1fr)_80px] items-center gap-2 bg-background px-[var(--assistant-panel-gutter)] isolate [-webkit-app-region:drag]",
        className,
      )}
    >
      <div className="relative justify-self-start [-webkit-app-region:no-drag]">{left}</div>
      <div className="block w-full max-w-37.5 min-w-0 justify-self-center truncate text-center text-sm leading-[1.4] font-medium">
        {title}
      </div>
      <div className="inline-flex w-20 items-center justify-end justify-self-end [-webkit-app-region:no-drag]">{right}</div>
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
        "flex min-h-0 flex-auto flex-col gap-2.5 overflow-x-hidden overflow-y-auto pb-5 pt-15.25 [scrollbar-gutter:stable]",
        className,
      )}
      {...props}
    />
  );
}

interface AssistantPromptEmptyStateProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function AssistantPromptEmptyState({ title, description, children }: AssistantPromptEmptyStateProps) {
  return (
    <div data-slot="assistant-empty-state" className="flex min-h-40 flex-auto items-end justify-start px-2 pb-3 text-muted-foreground">
      <div className="w-full text-left">
        <span className="assistant-launcher mb-4 grid size-10 place-items-center" aria-hidden="true">
          <AiAssistantOrb />
        </span>
        <h2 className="text-lg leading-7 font-semibold">
          <ShinyText text={title} speed={2.8} delay={1.2} color="var(--foreground)" shineColor="var(--primary)" spread={105} />
        </h2>
        {description ? <p className="mt-1.5 max-w-70 text-xs leading-5 text-muted-foreground">{description}</p> : null}
        {children}
      </div>
    </div>
  );
}

const BUILT_IN_ASSISTANT_PROMPTS = [
  { id: "check-typos", title: "检查错别字", content: "检查当前文章中的错别字和明显标点问题。", Icon: CheckCheck },
  { id: "light-polish", title: "简单润色", content: "在不改变原意的前提下，简单润色当前文章。", Icon: WandSparkles },
  { id: "review-structure", title: "梳理文章结构", content: "梳理当前文章的结构，并给出简短建议。", Icon: ListTree },
] as const;

export const ASSISTANT_PROMPT_ACTION_CLASS_NAME =
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
    <AssistantPromptEmptyState title="✨ AI 无法代替你思考">
      {quickPromptsReady && hasCustomPrompts ? (
        <div className="mt-4">
          <div className="grid gap-0">
            {visibleCustomPrompts.map((prompt) => (
              <Button
                key={prompt.id}
                type="button"
                variant="ghost"
                className={ASSISTANT_PROMPT_ACTION_CLASS_NAME}
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
                className={ASSISTANT_PROMPT_ACTION_CLASS_NAME}
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
                className={ASSISTANT_PROMPT_ACTION_CLASS_NAME}
                disabled={busy}
                onClick={() => onSelectPrompt(content)}
              >
                <Icon />
                {title}
              </Button>
            ))}
          </div>

          <Button type="button" variant="ghost" className={ASSISTANT_PROMPT_ACTION_CLASS_NAME} onClick={onOpenQuickPromptSettings}>
            <Plus />
            设置快捷提示
          </Button>
        </div>
      ) : null}
    </AssistantPromptEmptyState>
  );
}
