/**
 * [INPUT]: 依赖 React、共享 class 合并工具与全局 menu 语义 Token
 * [OUTPUT]: 对外提供 SuggestionMenu、SuggestionMenuLabel 与支持双行内容的 SuggestionMenuItem primitives
 * [POS]: components/ui 的输入建议浮层基础，以 listbox/option 语义复用 DropdownMenu 的实体材质、几何和交互状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import * as React from "react";

import { cn } from "@/shared/lib/utils";

function SuggestionMenu({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="suggestion-menu"
      role="listbox"
      className={cn(
        "loby-solid-menu z-50 grid origin-bottom overflow-x-hidden overflow-y-auto rounded-[var(--menu-radius)] p-[var(--menu-padding)] text-[var(--menu-foreground)] duration-100 animate-in fade-in-0 zoom-in-95",
        className,
      )}
      {...props}
    />
  );
}

function SuggestionMenuLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="suggestion-menu-label"
      className={cn("text-caption px-2 pt-1.5 pb-1 font-medium leading-4 text-[var(--menu-muted-foreground)]", className)}
      {...props}
    />
  );
}

interface SuggestionMenuItemProps extends Omit<React.ComponentProps<"button">, "title"> {
  active?: boolean;
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
}

const SuggestionMenuItem = React.forwardRef<HTMLButtonElement, SuggestionMenuItemProps>(
  ({ active = false, className, icon, title, description, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      data-slot="suggestion-menu-item"
      data-active={active}
      role="option"
      aria-selected={active}
      className={cn(
        "text-app-base grid min-h-9.5 w-full grid-cols-[18px_minmax(0,1fr)] items-center gap-x-1.5 rounded-[var(--menu-item-radius)] px-2 py-1 text-left font-normal leading-[18px] outline-none select-none",
        "hover:bg-[var(--menu-highlight)] hover:text-[var(--menu-highlight-foreground)] hover:**:text-[var(--menu-highlight-foreground)] focus-visible:bg-[var(--menu-highlight)] focus-visible:text-[var(--menu-highlight-foreground)] focus-visible:**:text-[var(--menu-highlight-foreground)]",
        "data-[active=true]:bg-[var(--menu-highlight)] data-[active=true]:text-[var(--menu-highlight-foreground)] data-[active=true]:**:text-[var(--menu-highlight-foreground)]",
        "disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <span
        data-slot="suggestion-menu-item-icon"
        className={cn(
          "flex size-[18px] justify-center text-[var(--menu-icon-subtle)] [&_svg]:size-3.5 [&_svg]:shrink-0",
          description ? "row-span-2 items-start pt-0.5" : "items-center",
        )}
      >
        {icon}
      </span>
      <span data-slot="suggestion-menu-item-title" className="min-w-0 truncate">
        {title}
      </span>
      {description ? (
        <small
          data-slot="suggestion-menu-item-description"
          className="text-caption col-start-2 min-w-0 truncate leading-4 text-[var(--menu-muted-foreground)]"
        >
          {description}
        </small>
      ) : null}
    </button>
  ),
);

SuggestionMenuItem.displayName = "SuggestionMenuItem";

export { SuggestionMenu, SuggestionMenuItem, SuggestionMenuLabel };
