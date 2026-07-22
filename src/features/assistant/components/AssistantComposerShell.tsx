/**
 * [INPUT]: 依赖 React form props、shared cn/BorderGlow 与 assistant composer 表面/阴影 Token
 * [OUTPUT]: 对外提供 AssistantComposerShell
 * [POS]: AI 助手 feature 的界面组合单元，连接 AI 助手状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/utils";
import { BorderGlow } from "@/shared/components/BorderGlow";

interface AssistantComposerShellProps extends ComponentProps<"form"> {
  glowActive?: boolean;
}

export function AssistantComposerShell({ className, glowActive = false, children, ...props }: AssistantComposerShellProps) {
  return (
    <form
      data-slot="assistant-composer-shell"
      data-glow-active={glowActive ? "true" : "false"}
      className={cn(
        "relative mx-[var(--assistant-panel-gutter)] mb-1 flex shrink-0 flex-col gap-1.5 rounded-2xl border border-[var(--separator)] bg-[var(--surface)] p-2.75 pr-2.5 pb-2.5 shadow-[var(--assistant-composer-shadow)] focus-within:border-[var(--separator)] focus-within:ring-0",
        className,
      )}
      {...props}
    >
      <BorderGlow active={glowActive} />
      {children}
    </form>
  );
}
