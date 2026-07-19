import type { ResolvedAppTheme } from "../types";

interface ThemeModeSwitchProps {
  theme: ResolvedAppTheme;
  onChange: (theme: ResolvedAppTheme) => void;
}

export function ThemeModeSwitch({ theme, onChange }: ThemeModeSwitchProps) {
  const dark = theme === "dark";
  const nextThemeLabel = dark ? "浅色" : "暗色";

  return (
    <label className="theme-mode-switch" title={`切换到${nextThemeLabel}模式`}>
      <input
        className="theme-mode-switch-input"
        type="checkbox"
        checked={dark}
        onChange={(event) => onChange(event.currentTarget.checked ? "dark" : "light")}
        aria-label={`切换到${nextThemeLabel}模式`}
      />
      <span className="theme-mode-switch-slider" aria-hidden="true" />
    </label>
  );
}
