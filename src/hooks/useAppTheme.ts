import { useEffect, useLayoutEffect, useState } from "react";
import type { AppThemePreference, ResolvedAppTheme } from "../types";
import { APP_THEME_DARK_MODE_QUERY, resolveAppTheme, resolveCurrentAppTheme } from "../lib/themes";

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
