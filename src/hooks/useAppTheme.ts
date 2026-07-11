import { useEffect, useLayoutEffect, useState } from "react";
import type { AppThemePreference, ResolvedAppTheme } from "../types";
import { resolveAppTheme } from "../lib/themes";

const DARK_MODE_QUERY = "(prefers-color-scheme: dark)";

export function useAppTheme(preference: AppThemePreference): ResolvedAppTheme {
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedAppTheme>(() => resolveCurrentTheme(preference));

  useEffect(() => {
    const media = window.matchMedia(DARK_MODE_QUERY);
    const updateTheme = () => setResolvedTheme(resolveAppTheme(preference, media.matches));
    updateTheme();
    media.addEventListener("change", updateTheme);
    return () => media.removeEventListener("change", updateTheme);
  }, [preference]);

  useLayoutEffect(() => {
    document.documentElement.dataset.appTheme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  return resolvedTheme;
}

function resolveCurrentTheme(preference: AppThemePreference): ResolvedAppTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return resolveAppTheme(preference, false);
  return resolveAppTheme(preference, window.matchMedia(DARK_MODE_QUERY).matches);
}
