/**
 * [INPUT]: 依赖 clsx
 * [OUTPUT]: 对外提供 AssistantMessageSurfaceRole、assistantMessageRootClassName
 * [POS]: AI 助手 feature 的领域模型边界，集中 AI 助手 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import clsx from "clsx";

export type AssistantMessageSurfaceRole = "user" | "assistant" | "system";

export function assistantMessageRootClassName(role: AssistantMessageSurfaceRole, error = false): string {
  return clsx(
    "max-w-full leading-[1.55]",
    role === "user" && "group ml-auto grid w-full min-w-0 justify-items-end gap-0 text-foreground",
    role === "assistant" && "bg-transparent px-1.25 py-0.5 text-foreground",
    role === "system" && "rounded-lg border border-border bg-muted/40 p-2.5",
    error && "border-destructive/25 bg-destructive/6 text-destructive",
  );
}
