/**
 * [INPUT]: 依赖 clsx、React 运行时
 * [OUTPUT]: 对外提供 NavigationItem
 * [POS]: shared 层的跨功能复用的界面基础，不依赖具体 feature
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import clsx from "clsx";
import type { ComponentPropsWithoutRef } from "react";

interface NavigationItemProps extends ComponentPropsWithoutRef<"button"> {
  selected?: boolean;
  active?: boolean;
}

export function NavigationItem({ selected = false, active = false, className, type = "button", ...props }: NavigationItemProps) {
  return (
    <button
      {...props}
      data-slot="navigation-item"
      type={type}
      aria-current={selected ? "page" : props["aria-current"]}
      className={clsx(
        "flex h-8 w-full cursor-pointer items-center justify-start gap-1.5 rounded-lg border border-transparent px-2.5 text-sm font-medium outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        selected && active && "bg-[var(--navigation-selection-active-bg)] text-primary-foreground",
        selected && !active && "bg-[var(--navigation-selection-inactive-bg)] text-[var(--navigation-selection-inactive-foreground)]",
        !selected && "bg-transparent text-foreground",
        className,
      )}
    />
  );
}
