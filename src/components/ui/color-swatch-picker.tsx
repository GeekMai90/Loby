/**
 * [INPUT]: 依赖 React 交互状态、shared class 合并工具与调用方提供的颜色选项
 * [OUTPUT]: 对外提供 ColorSwatchPicker 与 ColorSwatchOption，以紧凑 Dock 动效完成单选颜色输入
 * [POS]: components/ui 的通用颜色选择控件，负责悬停邻近放大、选中反馈与无障碍按钮语义
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { type CSSProperties, useState } from "react";

import { cn } from "@/shared/lib/utils";

export interface ColorSwatchOption {
  label: string;
  value: string;
}

interface ColorSwatchPickerProps {
  options: readonly ColorSwatchOption[];
  value: string;
  ariaLabel: string;
  className?: string;
  onValueChange: (value: string) => void;
}

const SWATCH_SCALE_BY_DISTANCE = [1.45, 1.25, 1.1] as const;

export function ColorSwatchPicker({ options, value, ariaLabel, className, onValueChange }: ColorSwatchPickerProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <div className={cn("flex h-8 min-w-0 items-center pr-2 [perspective:1000px]", className)} role="group" aria-label={ariaLabel}>
      {options.map((option, index) => {
        const distance = activeIndex === null ? -1 : Math.abs(activeIndex - index);
        const scale = distance >= 0 && distance < SWATCH_SCALE_BY_DISTANCE.length ? SWATCH_SCALE_BY_DISTANCE[distance] : 1;
        const isActive = activeIndex === index;
        const isSelected = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            className="relative h-8 w-[19px] shrink-0 border-0 bg-transparent p-0 outline-none transition-transform duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.1)] focus-visible:z-30 motion-reduce:transition-none"
            style={{ transform: `scale(${scale})`, zIndex: isActive ? 30 : Math.max(0, 20 - distance) } as CSSProperties}
            aria-label={`${option.label}，${option.value}`}
            aria-pressed={isSelected}
            onClick={() => onValueChange(option.value)}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
            onFocus={() => setActiveIndex(index)}
            onBlur={() => setActiveIndex(null)}
          >
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 size-8 rounded-md transition-transform duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.1)] motion-reduce:transition-none"
              style={{ backgroundColor: option.value }}
            />
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-40 -translate-x-1/2 rounded-md bg-popover px-1.5 py-0.5 text-[9px] leading-3 whitespace-nowrap text-popover-foreground shadow-md transition-[opacity,transform] duration-200",
                isActive ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
              )}
            >
              {option.label} · {option.value}
            </span>
          </button>
        );
      })}
    </div>
  );
}
