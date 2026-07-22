"use client";

/**
 * [INPUT]: 依赖 Radix Popover、React、共享 cn 与 loby glass/solid 浮层材质
 * [OUTPUT]: 对外提供 Popover、PopoverTrigger 与支持材质选择的 PopoverContent primitives
 * [POS]: components/ui 的非模态锚定浮层基础，集中管理 Portal、定位偏移与实体/玻璃表面
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { cn } from "@/shared/lib/utils";

function Popover(props: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger(props: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 6,
  variant = "glass",
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & { variant?: "glass" | "solid" }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-72 rounded-xl p-4 text-popover-foreground outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          variant === "solid" ? "loby-solid-menu" : "loby-glass-menu",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverContent, PopoverTrigger };
