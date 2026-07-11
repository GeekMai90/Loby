import type { AppThemePreference, EditorThemeId, ResolvedAppTheme } from "../types";

export function normalizeAppThemePreference(value: unknown): AppThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export function normalizeEditorThemeId(value: unknown): EditorThemeId {
  return value === "graphite" || value === "vue" || value === "lapis" ? value : "nibva";
}

export function resolveAppTheme(preference: AppThemePreference, systemPrefersDark: boolean): ResolvedAppTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}
