import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";

export interface FunctionSegmentedTab<TValue extends string> {
  value: TValue;
  label: string;
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
  const style = {
    "--function-segment-count": tabs.length,
    "--function-segment-offset": `calc(${activeIndex * 100}% + ${activeIndex * 2}px)`,
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
            title={tab.label}
            aria-label={tab.label}
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
