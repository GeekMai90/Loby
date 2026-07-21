import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ResolvedAppTheme } from "../types";

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
      className="hover:bg-transparent dark:hover:bg-transparent"
      aria-label={description}
      title={description}
      onClick={() => onChange(state.next)}
    >
      <Icon />
    </Button>
  );
}
