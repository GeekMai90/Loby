/**
 * [INPUT]: 依赖 Radix Progress、React、共享 cn 与 primary/muted 语义 Token
 * [OUTPUT]: 对外提供 Progress primitive
 * [POS]: components/ui 的确定性进度基础，将数值映射为语义轨道上的水平位移
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import * as React from "react";
import { Progress as ProgressPrimitive } from "radix-ui";

import { cn } from "@/shared/lib/utils";

function Progress({ className, value, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn("relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="size-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
