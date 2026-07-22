/**
 * [INPUT]: 依赖 AI 助手模块、编辑器模块、shared 公共契约
 * [OUTPUT]: 对外提供 LIBRARY_PREFERENCES_VERSION、libraryPreferencesFromAgentSettings、normalizeLibraryPreferences、cloneLibraryPreferences
 * [POS]: 写作库 feature 的领域模型边界，集中 写作库 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AgentSettings } from "@/features/assistant/model/agentSettings";
import {
  normalizeEditorTypography,
  normalizeImageReferenceFormat,
  normalizeSheetManualOrders,
  normalizeSheetSortPreferences,
} from "@/features/assistant/model/agentSettings";
import { normalizeMarkdownFormattingSettings } from "@/features/editor/model/markdownFormattingSettings";
import { normalizeAppThemePreference, normalizeEditorThemeId } from "@/shared/lib/themes";
import type { LibraryPreferences } from "@/shared/types";

export const LIBRARY_PREFERENCES_VERSION = 1 as const;

export function libraryPreferencesFromAgentSettings(
  settings: AgentSettings,
  selection: { lastProjectId?: string; lastSheetId?: string } = {},
): LibraryPreferences {
  return {
    version: LIBRARY_PREFERENCES_VERSION,
    lastProjectId: selection.lastProjectId ?? settings.activeProjectId,
    lastSheetId: selection.lastSheetId ?? settings.activeSheetId,
    focusMode: settings.focusMode,
    typewriterMode: settings.typewriterMode,
    sheetPreviewMode: settings.sheetPreviewMode,
    goalCelebrationEnabled: settings.goalCelebrationEnabled,
    appTheme: settings.appTheme,
    editorTheme: settings.editorTheme,
    editorTypography: { ...settings.editorTypography },
    imageReferenceFormat: settings.imageReferenceFormat,
    markdownFormatting: { ...settings.markdownFormatting },
    activeGroupIdsByProject: { ...settings.activeGroupIdsByProject },
    sheetSortPreferences: { ...settings.sheetSortPreferences },
    sheetManualOrders: cloneOrders(settings.sheetManualOrders),
  };
}

export function normalizeLibraryPreferences(value: unknown, fallback: LibraryPreferences): LibraryPreferences {
  if (!isRecord(value) || value.version !== LIBRARY_PREFERENCES_VERSION) return cloneLibraryPreferences(fallback);
  return {
    version: LIBRARY_PREFERENCES_VERSION,
    lastProjectId: normalizeId(value.lastProjectId, fallback.lastProjectId),
    lastSheetId: normalizeId(value.lastSheetId, fallback.lastSheetId),
    focusMode: normalizeBoolean(value.focusMode, fallback.focusMode),
    typewriterMode: normalizeBoolean(value.typewriterMode, fallback.typewriterMode),
    sheetPreviewMode: normalizeBoolean(value.sheetPreviewMode, fallback.sheetPreviewMode),
    goalCelebrationEnabled: normalizeBoolean(value.goalCelebrationEnabled, fallback.goalCelebrationEnabled),
    appTheme: normalizeAppThemePreference(value.appTheme ?? fallback.appTheme),
    editorTheme: normalizeEditorThemeId(value.editorTheme ?? fallback.editorTheme),
    editorTypography: normalizeEditorTypography(value.editorTypography, fallback.editorTypography, 4),
    imageReferenceFormat: normalizeImageReferenceFormat(value.imageReferenceFormat ?? fallback.imageReferenceFormat),
    markdownFormatting:
      value.markdownFormatting === undefined
        ? { ...fallback.markdownFormatting }
        : normalizeMarkdownFormattingSettings(value.markdownFormatting),
    activeGroupIdsByProject:
      value.activeGroupIdsByProject === undefined ? { ...fallback.activeGroupIdsByProject } : normalizeIdMap(value.activeGroupIdsByProject),
    sheetSortPreferences:
      value.sheetSortPreferences === undefined
        ? { ...fallback.sheetSortPreferences }
        : normalizeSheetSortPreferences(value.sheetSortPreferences),
    sheetManualOrders:
      value.sheetManualOrders === undefined ? cloneOrders(fallback.sheetManualOrders) : normalizeSheetManualOrders(value.sheetManualOrders),
  };
}

export function cloneLibraryPreferences(preferences: LibraryPreferences): LibraryPreferences {
  return {
    ...preferences,
    editorTypography: { ...preferences.editorTypography },
    markdownFormatting: { ...preferences.markdownFormatting },
    activeGroupIdsByProject: { ...preferences.activeGroupIdsByProject },
    sheetSortPreferences: { ...preferences.sheetSortPreferences },
    sheetManualOrders: cloneOrders(preferences.sheetManualOrders),
  };
}

function normalizeIdMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = normalizeId(key);
    const normalizedValue = normalizeId(item);
    if (normalizedKey && normalizedValue) result[normalizedKey] = normalizedValue;
  }
  return result;
}

function cloneOrders(orders: LibraryPreferences["sheetManualOrders"]): LibraryPreferences["sheetManualOrders"] {
  return Object.fromEntries(Object.entries(orders).map(([key, ids]) => [key, [...ids]]));
}

function normalizeId(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length <= 240 ? value : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
