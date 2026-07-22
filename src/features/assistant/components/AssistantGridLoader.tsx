/**
 * [INPUT]: 依赖 shared 公共契约
 * [OUTPUT]: 对外提供 AssistantGridLoader
 * [POS]: AI 助手 feature 的界面组合单元，连接 AI 助手状态与共享 UI，不持有跨功能应用状态
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
