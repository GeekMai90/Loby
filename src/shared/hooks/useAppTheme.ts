/**
 * [INPUT]: 依赖 React 运行时、shared 公共契约
 * [OUTPUT]: 对外提供 useAppTheme
 * [POS]: shared 层的跨功能复用的 React 与平台行为，不持有具体业务状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useLayoutEffect, useState } from "react";
import type { AppThemePreference, ResolvedAppTheme } from "@/shared/types";
import { APP_THEME_DARK_MODE_QUERY, resolveAppTheme, resolveCurrentAppTheme } from "@/shared/lib/themes";

interface UseAppThemeOptions {
  override?: ResolvedAppTheme | null;
  onSystemThemeChange?: () => void;
}

export function useAppTheme(
  preference: AppThemePreference,
  { override = null, onSystemThemeChange }: UseAppThemeOptions = {},
): ResolvedAppTheme {
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => resolveCurrentAppTheme("system") === "dark");
  const resolvedTheme = override ?? resolveAppTheme(preference, systemPrefersDark);

  useEffect(() => {
    const media = window.matchMedia(APP_THEME_DARK_MODE_QUERY);
    setSystemPrefersDark(media.matches);
    const updateTheme = () => {
      setSystemPrefersDark(media.matches);
      onSystemThemeChange?.();
    };
    media.addEventListener("change", updateTheme);
    return () => media.removeEventListener("change", updateTheme);
  }, [onSystemThemeChange]);

  useLayoutEffect(() => {
    document.documentElement.dataset.appTheme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  return resolvedTheme;
}
