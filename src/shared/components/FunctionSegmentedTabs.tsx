/**
 * [INPUT]: 依赖 React 运行时、lucide-react、clsx
 * [OUTPUT]: 对外提供 FunctionSegmentedTab、FunctionSegmentedTabs
 * [POS]: shared 层的跨功能复用的界面基础，不依赖具体 feature
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";

export interface FunctionSegmentedTab<TValue extends string> {
  value: TValue;
  label: string;
  ariaLabel?: string;
  icon: LucideIcon;
}

interface FunctionSegmentedTabsProps<TValue extends string> {
  value: TValue;
  tabs: Array<FunctionSegmentedTab<TValue>>;
  ariaLabel: string;
  showLabels?: boolean;
  onValueChange: (value: TValue) => void;
}

export function FunctionSegmentedTabs<TValue extends string>({
  value,
  tabs,
  ariaLabel,
  showLabels = false,
  onValueChange,
}: FunctionSegmentedTabsProps<TValue>) {
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.value === value),
  );
  const segmentPercentage = 100 / tabs.length;
  const style = {
    "--function-segment-count": tabs.length,
    "--function-segment-left": `calc(${activeIndex * segmentPercentage}% + ${3 - (activeIndex * 4) / tabs.length}px)`,
    "--function-segment-width": `calc(${segmentPercentage}% - ${2 + 4 / tabs.length}px)`,
  } as CSSProperties;

  return (
    <div
      className={clsx("function-segmented-tabs", showLabels && "function-segmented-tabs-with-labels")}
      role="tablist"
      aria-label={ariaLabel}
      style={style}
    >
      <span className="function-segmented-tab-indicator" aria-hidden="true" />
      {tabs.map((tab, index) => {
        const Icon = tab.icon;
        const active = value === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            className={clsx(active && "active")}
            style={{ gridColumn: index + 1 }}
            title={tab.ariaLabel ?? tab.label}
            aria-label={tab.ariaLabel ?? tab.label}
            aria-selected={active}
            onClick={() => onValueChange(tab.value)}
          >
            <Icon aria-hidden="true" />
            {showLabels && <span>{tab.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
