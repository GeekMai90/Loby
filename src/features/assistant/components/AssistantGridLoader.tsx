/**
 * [INPUT]: 依赖 shared/lib/utils 的 class 合并能力与 AI loader 语义样式
 * [OUTPUT]: 对外提供 AssistantGridLoader
 * [POS]: AI 助手的无状态九宫格加载指示器，只表达等待反馈，不解释 runtime 阶段
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { cn } from "@/shared/lib/utils";

interface AssistantGridLoaderProps {
  className?: string;
}

export function AssistantGridLoader({ className }: AssistantGridLoaderProps) {
  return (
    <span data-slot="assistant-grid-loader" className={cn("assistant-grid-loader", className)} aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} />
      ))}
    </span>
  );
}
