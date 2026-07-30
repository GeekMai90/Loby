/**
 * [INPUT]: 依赖 shared/types 的应用与编辑器主题 ID，以及浏览器 prefers-color-scheme 查询
 * [OUTPUT]: 对外提供 APP_THEME_DARK_MODE_QUERY、normalizeAppThemePreference、normalizeEditorThemeId、resolveAppTheme、resolveCurrentAppTheme
 * [POS]: shared 主题策略层，统一持久化值归一化和系统明暗模式解析，不拥有具体 palette
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AppThemePreference, EditorThemeId, ResolvedAppTheme } from "@/shared/types";

export const APP_THEME_DARK_MODE_QUERY = "(prefers-color-scheme: dark)";

export function normalizeAppThemePreference(value: unknown): AppThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export function normalizeEditorThemeId(value: unknown): EditorThemeId {
  return value === "graphite" || value === "vue" || value === "lapis" ? value : "loby";
}

export function resolveAppTheme(preference: AppThemePreference, systemPrefersDark: boolean): ResolvedAppTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

export function resolveCurrentAppTheme(preference: AppThemePreference): ResolvedAppTheme {
  const systemPrefersDark =
    typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(APP_THEME_DARK_MODE_QUERY).matches : false;
  return resolveAppTheme(preference, systemPrefersDark);
}
