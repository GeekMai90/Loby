/**
 * [INPUT]: 依赖 shared 公共契约、lucide-react
 * [OUTPUT]: 对外提供 MenuSegmentedTab、MenuSegmentedTabs
 * [POS]: shared 层的跨功能复用的界面基础，不依赖具体 feature
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { cn } from "@/shared/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface MenuSegmentedTab<TValue extends string> {
  value: TValue;
  label: string;
  ariaLabel?: string;
  icon: LucideIcon;
}

interface MenuSegmentedTabsProps<TValue extends string> {
  value: TValue;
  tabs: Array<MenuSegmentedTab<TValue>>;
  ariaLabel: string;
  className?: string;
  showLabels?: boolean;
  disabled?: boolean;
  onValueChange: (value: TValue) => void;
}

export function MenuSegmentedTabs<TValue extends string>({
  value,
  tabs,
  ariaLabel,
  className,
  showLabels = false,
  disabled = false,
  onValueChange,
}: MenuSegmentedTabsProps<TValue>) {
  return (
    <div
      className={cn("grid rounded-lg bg-[var(--menu-switch-background)] p-0.5", className)}
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = value === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            disabled={disabled}
            data-state={active ? "on" : "off"}
            aria-selected={active}
            aria-label={tab.ariaLabel ?? tab.label}
            title={tab.ariaLabel ?? tab.label}
            className={cn(
              "flex h-7 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-1 focus-visible:ring-foreground/20 disabled:pointer-events-none disabled:opacity-50",
              showLabels && "gap-1.5 px-3 text-xs font-medium whitespace-nowrap",
              active
                ? "bg-[var(--menu-switch-selected-background)] text-[var(--menu-body-foreground)] shadow-sm ring-1 ring-border/80"
                : "text-[var(--menu-muted-foreground)] hover:text-[var(--menu-body-foreground)]",
            )}
            onClick={() => onValueChange(tab.value)}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden="true" />
            <span className={showLabels ? "" : "sr-only"}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
