import { Moon, Sun, SunMoon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AppThemePreference } from "../types";

interface ThemeModeSwitchProps {
  theme: AppThemePreference;
  onChange: (theme: AppThemePreference) => void;
}

const THEME_SWITCH_STATES: Record<
  AppThemePreference,
  {
    label: string;
    next: AppThemePreference;
    nextLabel: string;
    icon: typeof Sun;
  }
> = {
  light: { label: "亮色", next: "dark", nextLabel: "暗色", icon: Sun },
  dark: { label: "暗色", next: "system", nextLabel: "自动", icon: Moon },
  system: { label: "自动", next: "light", nextLabel: "亮色", icon: SunMoon },
};

export function ThemeModeSwitch({ theme, onChange }: ThemeModeSwitchProps) {
  const state = THEME_SWITCH_STATES[theme];
  const Icon = state.icon;
  const description = `当前为${state.label}主题，点击切换到${state.nextLabel}`;

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
