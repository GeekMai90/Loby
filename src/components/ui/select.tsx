/**
 * [INPUT]: 依赖 React、Radix Select、lucide-react、Tailwind 语义字号 Token 与共享 cn 工具
 * [OUTPUT]: 对外提供 Select 根节点、五档语义宽度触发器、可独立选择等宽/内容自适应/固定宽度的弹出内容、分组、条目、标签、分隔线与滚动控件
 * [POS]: ui 组件层的标准选择菜单，Trigger 与 Content 可分别声明布局宽度，弹出层复用实体菜单材质与紧凑条目几何
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "radix-ui";

import { cn } from "@/shared/lib/utils";
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react";

const SELECT_TRIGGER_WIDTHS = {
  compact: "w-28",
  default: "w-44",
  wide: "w-64",
  full: "w-full",
  fit: "w-fit",
} as const;

const SELECT_CONTENT_WIDTHS = {
  trigger: "w-(--radix-select-trigger-width)",
  content: "w-max min-w-36",
  fit: "w-max min-w-(--radix-select-trigger-width)",
  compact: "w-36",
  default: "w-44",
  wide: "w-64",
} as const;

type SelectTriggerWidth = keyof typeof SELECT_TRIGGER_WIDTHS;
type SelectContentWidth = keyof typeof SELECT_CONTENT_WIDTHS;

function Select({ ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" className={cn("scroll-my-1", className)} {...props} />;
}

function SelectValue({ ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
  className,
  size = "default",
  width = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default";
  width?: SelectTriggerWidth;
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      data-width={width}
      className={cn(
        "text-app-base flex max-w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-left whitespace-nowrap transition-colors outline-none select-none focus-visible:border-input focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1 *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        SELECT_TRIGGER_WIDTHS[width],
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  position = "popper",
  align = "start",
  sideOffset = 0,
  collisionPadding = 8,
  width = "trigger",
  onPointerDownOutside,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content> & {
  width?: SelectContentWidth;
}) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        data-align-trigger={position === "item-aligned"}
        data-width={width}
        className={cn(
          "loby-solid-menu relative z-50 max-h-(--radix-select-content-available-height) max-w-(--radix-select-content-available-width) origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-[var(--menu-radius)] text-[var(--menu-foreground)] duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          SELECT_CONTENT_WIDTHS[width],
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className,
        )}
        position={position}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        onPointerDownOutside={(event) => {
          onPointerDownOutside?.(event);
          // Keep the dismissing press from becoming a native text selection when the portal unmounts over the editor.
          event.detail.originalEvent.preventDefault();
        }}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          data-position={position}
          className={cn(
            "p-[var(--menu-padding)]",
            position === "popper" && (width === "content" || width === "fit") ? "w-max" : "w-full",
            position === "popper" && width === "trigger" && "min-w-(--radix-select-trigger-width)",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label data-slot="select-label" className={cn("text-caption px-2 py-1 text-muted-foreground", className)} {...props} />
  );
}

function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "text-app-base relative flex h-[26px] w-full min-w-0 cursor-default items-center gap-1.5 overflow-hidden rounded-[var(--menu-item-radius)] py-0.5 pr-7 pl-2 leading-[18px] whitespace-nowrap outline-hidden select-none hover:bg-[var(--menu-highlight)] hover:text-[var(--menu-highlight-foreground)] hover:**:text-[var(--menu-highlight-foreground)] focus:bg-[var(--menu-highlight)] focus:text-[var(--menu-highlight-foreground)] focus:**:text-[var(--menu-highlight-foreground)] data-disabled:pointer-events-none data-disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="pointer-events-none" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText asChild>
        <span className="min-w-0 flex-1 truncate">{children}</span>
      </SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("loby-menu-separator pointer-events-none my-1 h-px bg-[var(--menu-separator)]", className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        "z-10 flex cursor-default items-center justify-center bg-[var(--menu-background)] py-1 [&_svg:not([class*='size-'])]:size-3.5",
        className,
      )}
      {...props}
    >
      <ChevronUpIcon />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        "z-10 flex cursor-default items-center justify-center bg-[var(--menu-background)] py-1 [&_svg:not([class*='size-'])]:size-3.5",
        className,
      )}
      {...props}
    >
      <ChevronDownIcon />
    </SelectPrimitive.ScrollDownButton>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};

export type { SelectContentWidth, SelectTriggerWidth };
