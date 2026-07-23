/**
 * [INPUT]: 依赖 React 节点、shared class 合并工具与调用方提供的语义内容
 * [OUTPUT]: 对外提供 AssistantStructuredCard，统一标题、说明、补充信息和操作区布局
 * [POS]: AI 助手卡片的共享视觉骨架，被写入确认和正文修改结果复用，避免两套卡片样式漂移
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

interface AssistantStructuredCardProps extends Omit<ComponentPropsWithoutRef<"section">, "title"> {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  details?: ReactNode;
  actions: ReactNode;
}

export function AssistantStructuredCard({ icon, title, description, details, actions, className, ...props }: AssistantStructuredCardProps) {
  return (
    <section
      className={cn("w-full max-w-full min-w-0 overflow-hidden rounded-xl border border-border bg-card/90 p-3", className)}
      data-slot="assistant-structured-card"
      {...props}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {icon}
        <strong className="min-w-0 truncate text-[13px] font-bold">{title}</strong>
      </div>
      <div className="mt-1 min-w-0 pl-[21px] text-[13px] leading-[1.4] text-muted-foreground">
        <p>{description}</p>
        {details}
      </div>
      <div className="mt-2.5 flex flex-wrap justify-end gap-1.5">{actions}</div>
    </section>
  );
}
