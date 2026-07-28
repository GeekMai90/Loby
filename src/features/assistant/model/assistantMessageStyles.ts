/**
 * [INPUT]: 依赖 clsx 与 shared AgentRunInfo 契约
 * [OUTPUT]: 对外提供消息表面角色、运行错误正文去重判断与根容器样式
 * [POS]: AI 助手消息视觉语义边界，使运行失败和普通系统通知共享透明助手表面与竖线语言
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import clsx from "clsx";
import type { AgentRunInfo } from "@/shared/types";

export type AssistantMessageSurfaceRole = "user" | "assistant" | "system";

export function resolveAssistantMessageSurfaceRole(
  role: AssistantMessageSurfaceRole,
  run: AgentRunInfo | undefined,
): AssistantMessageSurfaceRole {
  return run && role === "system" ? "assistant" : role;
}

export function isAgentRunErrorEcho(content: string, run: AgentRunInfo | undefined): boolean {
  const error = run?.error?.trim();
  return Boolean(error && content.trim() === error);
}

export function assistantMessageRootClassName(role: AssistantMessageSurfaceRole, error = false): string {
  return clsx(
    "max-w-full leading-[1.55]",
    role === "user" && "group ml-auto grid w-full min-w-0 justify-items-end gap-0 text-foreground",
    role === "assistant" && "bg-transparent px-1.25 py-0.5 text-foreground",
    role === "system" && "bg-transparent px-1.25 py-0.5 text-muted-foreground",
    error && "text-destructive",
  );
}
