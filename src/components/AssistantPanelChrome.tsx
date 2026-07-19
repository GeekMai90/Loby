import { Slot } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
        "ai-chat-header absolute top-0 right-[-8px] left-[-8px] z-20 grid min-h-14 shrink-0 grid-cols-[80px_minmax(0,1fr)_80px] items-center gap-2 px-3 isolate [-webkit-app-region:drag]",
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
        "-mr-2 flex min-h-0 flex-auto flex-col gap-2.5 overflow-x-hidden overflow-y-auto pr-2.5 pb-0.75 pl-0.75 pt-16.75 [scrollbar-gutter:stable]",
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
  quickPrompts?: AiQuickPrompt[];
  busy?: boolean;
  onSelectQuickPrompt?: (content: string) => Promise<void> | void;
}

export function AssistantEmptyState({
  title,
  description,
  icon,
  actions,
  quickPrompts = [],
  busy = false,
  onSelectQuickPrompt,
}: AssistantEmptyStateProps) {
  const visiblePrompts = quickPrompts.slice(0, 6);
  return (
    <div data-slot="assistant-empty-state" className="grid min-h-40 flex-auto place-items-center px-2 text-muted-foreground">
      <div className="w-full max-w-72 text-center">
        {icon}
        <h2 className="text-sm font-medium text-foreground">{visiblePrompts.length > 0 ? "选择一个快捷提示开始" : title}</h2>
        {description ? <p className="mx-auto mt-1.5 max-w-58 text-xs leading-5 text-muted-foreground">{description}</p> : null}
        {visiblePrompts.length > 0 ? (
          <div className="mt-3 grid gap-1.5 text-left">
            {visiblePrompts.map((prompt) => (
              <Button
                key={prompt.id}
                type="button"
                variant="outline"
                className="h-auto min-h-9 justify-start truncate px-3 py-2 text-[13px] font-normal"
                title={prompt.content}
                disabled={busy}
                onClick={() => onSelectQuickPrompt?.(prompt.content)}
              >
                <span className="truncate">{prompt.title}</span>
              </Button>
            ))}
            {quickPrompts.length > visiblePrompts.length ? (
              <p className="mt-0.5 text-center text-[11px] text-muted-foreground">输入 / 查看全部快捷提示</p>
            ) : null}
          </div>
        ) : null}
        {actions}
      </div>
    </div>
  );
}
