/**
 * [INPUT]: 依赖 clsx、React 运行时与 styles 的字体、圆角、spacing 语义尺度
 * [OUTPUT]: 对外提供统一 14px 文字、16px 图标和 32px 几何的 NavigationItem
 * [POS]: shared 层的跨功能导航基础；集中持有导航项尺寸与选择/焦点视觉，不依赖具体 feature
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
        "text-body flex h-8 w-full cursor-pointer items-center justify-start gap-1.5 rounded-lg border border-transparent px-2 font-medium outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4",
        selected && active && "bg-[var(--navigation-selection-active-bg)] text-primary-foreground",
        selected && !active && "bg-[var(--navigation-selection-inactive-bg)] text-[var(--navigation-selection-inactive-foreground)]",
        !selected && "bg-transparent text-foreground",
        className,
      )}
    />
  );
}
