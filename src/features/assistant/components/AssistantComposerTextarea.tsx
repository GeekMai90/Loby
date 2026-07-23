/**
 * [INPUT]: 依赖 React 运行时、shadcn/ui 基础控件、shared 公共契约
 * [OUTPUT]: 对外提供 AssistantComposerTextarea
 * [POS]: AI 助手 feature 的界面组合单元，连接 AI 助手状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { forwardRef, type ComponentProps } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/shared/lib/utils";

export const AssistantComposerTextarea = forwardRef<HTMLTextAreaElement, ComponentProps<typeof Textarea>>(
  ({ className, rows = 2, ...props }, ref) => (
    <Textarea
      ref={ref}
      rows={rows}
      className={cn(
        "min-h-[2lh] resize-none rounded-none border-0 px-0 py-0 shadow-none placeholder:text-muted-foreground/65 focus-visible:border-transparent focus-visible:ring-0",
        className,
      )}
      {...props}
    />
  ),
);

AssistantComposerTextarea.displayName = "AssistantComposerTextarea";
