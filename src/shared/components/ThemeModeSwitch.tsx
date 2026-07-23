/**
 * [INPUT]: 依赖 lucide-react、shadcn/ui 基础控件、全局 data-tooltip 接管能力与 shared 公共契约
 * [OUTPUT]: 对外提供带简短 Tooltip、完整状态无障碍名称的 ThemeModeSwitch
 * [POS]: shared 层的跨功能复用的界面基础，不依赖具体 feature
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ResolvedAppTheme } from "@/shared/types";

interface ThemeModeSwitchProps {
  theme: ResolvedAppTheme;
  onChange: (theme: ResolvedAppTheme) => void;
}

const THEME_SWITCH_STATES: Record<
  ResolvedAppTheme,
  {
    label: string;
    next: ResolvedAppTheme;
    nextLabel: string;
    icon: typeof Sun;
  }
> = {
  light: { label: "亮色", next: "dark", nextLabel: "暗色", icon: Sun },
  dark: { label: "暗色", next: "light", nextLabel: "亮色", icon: Moon },
};

export function ThemeModeSwitch({ theme, onChange }: ThemeModeSwitchProps) {
  const state = THEME_SWITCH_STATES[theme];
  const Icon = state.icon;
  const description = `当前为${state.label}主题，点击临时切换到${state.nextLabel}`;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={description}
      data-tooltip="主题切换"
      onClick={() => onChange(state.next)}
    >
      <Icon className="size-3.5" />
    </Button>
  );
}
