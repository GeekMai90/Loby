import type {
  AgentModel,
  AgentReasoningEffort,
  AppThemePreference,
  AssistantSendMode,
  CodexCliProbeSnapshot,
  EditorThemeId,
  EditorTypographySettings,
  ImageReferenceFormat,
  MarkdownFormattingSettings,
  SheetManualOrders,
  SheetSortPreference,
} from "../types";
import { DEFAULT_SHEET_RAIL_WIDTH, normalizeSheetRailWidth } from "./sheetRailResize";
import { DEFAULT_MARKDOWN_FORMATTING_SETTINGS, normalizeMarkdownFormattingSettings } from "./markdownFormattingSettings";
import { normalizeAppThemePreference, normalizeEditorThemeId } from "./themes";

const SETTINGS_STORAGE_KEY = "loby.agentSettings.v1";
const EDITOR_TYPOGRAPHY_DEFAULT_REVISION = 4;
const LEGACY_EDITOR_HEADING_FONT_SIZES = {
  h1FontSize: 25,
  h2FontSize: 22,
  h3FontSize: 19,
} as const;
const PREVIOUS_DEFAULT_EDITOR_HEADING_FONT_SIZES = {
  h1FontSize: 28,
  h2FontSize: 24,
  h3FontSize: 21,
} as const;

export interface AgentSettings {
  agentModel: AgentModel;
  agentReasoningEffort: AgentReasoningEffort;
  agentQuickMode: boolean;
  assistantSendMode: AssistantSendMode;
  codexCliPath: string;
  codexCliProbe: CodexCliProbeSnapshot | null;
  libraryPath: string;
  activeProjectId: string;
  activeSheetId: string;
  libraryRailOpen: boolean;
  sheetRailOpen: boolean;
  sheetRailWidth: number;
  inspectorOpen: boolean;
  inspectorWidth: number;
  focusMode: boolean;
  typewriterMode: boolean;
  appTheme: AppThemePreference;
  editorTheme: EditorThemeId;
  editorTypography: EditorTypographySettings;
  editorTypographyRevision: number;
  imageReferenceFormat: ImageReferenceFormat;
  markdownFormatting: MarkdownFormattingSettings;
  activeGroupIdsByProject: Record<string, string>;
  sheetSortPreferences: Record<string, SheetSortPreference>;
  sheetManualOrders: SheetManualOrders;
}

export function loadAgentSettings(): AgentSettings {
  const fallback = defaultAgentSettings();
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AgentSettings>;
    return {
      ...fallback,
      agentModel: normalizeAgentModel(parsed.agentModel),
      agentReasoningEffort: normalizeAgentReasoningEffort(parsed.agentReasoningEffort),
      agentQuickMode: parsed.agentQuickMode ?? fallback.agentQuickMode,
      assistantSendMode: normalizeAssistantSendMode(parsed.assistantSendMode),
      codexCliPath: parsed.codexCliPath ?? "",
      codexCliProbe: normalizeCodexCliProbe(parsed.codexCliProbe),
      libraryPath: parsed.libraryPath ?? "",
      activeProjectId: parsed.activeProjectId ?? "",
      activeSheetId: parsed.activeSheetId ?? "",
      libraryRailOpen: parsed.libraryRailOpen ?? fallback.libraryRailOpen,
      sheetRailOpen: parsed.sheetRailOpen ?? fallback.sheetRailOpen,
      sheetRailWidth: normalizeSheetRailWidth(parsed.sheetRailWidth, fallback.sheetRailWidth),
      inspectorOpen: parsed.inspectorOpen ?? fallback.inspectorOpen,
      inspectorWidth: normalizeInspectorWidth(parsed.inspectorWidth, fallback.inspectorWidth),
      focusMode: parsed.focusMode ?? fallback.focusMode,
      typewriterMode: parsed.typewriterMode ?? fallback.typewriterMode,
      appTheme: normalizeAppThemePreference(parsed.appTheme),
      editorTheme: normalizeEditorThemeId(parsed.editorTheme),
      editorTypography: normalizeEditorTypography(
        parsed.editorTypography,
        fallback.editorTypography,
        normalizeRevision(parsed.editorTypographyRevision),
      ),
      editorTypographyRevision: EDITOR_TYPOGRAPHY_DEFAULT_REVISION,
      imageReferenceFormat: normalizeImageReferenceFormat(parsed.imageReferenceFormat),
      markdownFormatting: normalizeMarkdownFormattingSettings(parsed.markdownFormatting),
      activeGroupIdsByProject: parsed.activeGroupIdsByProject ?? fallback.activeGroupIdsByProject,
      sheetSortPreferences: normalizeSheetSortPreferences(parsed.sheetSortPreferences),
      sheetManualOrders: normalizeSheetManualOrders(parsed.sheetManualOrders),
    };
  } catch {
    return fallback;
  }
}

export function saveAgentSettings(next: Partial<AgentSettings>) {
  const current = loadAgentSettings();
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...current, ...next }));
}

function defaultAgentSettings(): AgentSettings {
  return {
    agentModel: "auto",
    agentReasoningEffort: "medium",
    agentQuickMode: false,
    assistantSendMode: "enter",
    codexCliPath: "",
    codexCliProbe: null,
    libraryPath: "",
    activeProjectId: "",
    activeSheetId: "",
    libraryRailOpen: true,
    sheetRailOpen: true,
    sheetRailWidth: DEFAULT_SHEET_RAIL_WIDTH,
    inspectorOpen: true,
    inspectorWidth: 400,
    focusMode: false,
    typewriterMode: false,
    appTheme: "system",
    editorTheme: "loby",
    editorTypography: {
      fontPreset: "system",
      customFontFamily: "",
      lineHeight: 1.76,
      paragraphSpacing: 0,
      bodyFontSize: 18,
      h1FontSize: 30,
      h2FontSize: 26,
      h3FontSize: 22,
      tableFontSize: 15,
    },
    editorTypographyRevision: EDITOR_TYPOGRAPHY_DEFAULT_REVISION,
    imageReferenceFormat: "markdown",
    markdownFormatting: { ...DEFAULT_MARKDOWN_FORMATTING_SETTINGS },
    activeGroupIdsByProject: {},
    sheetSortPreferences: {},
    sheetManualOrders: {},
  };
}

function normalizeImageReferenceFormat(value: unknown): ImageReferenceFormat {
  return value === "obsidian" ? "obsidian" : "markdown";
}

function normalizeEditorTypography(value: unknown, fallback: EditorTypographySettings, savedRevision: number): EditorTypographySettings {
  if (!value || typeof value !== "object") return fallback;
  const typography = value as Partial<EditorTypographySettings>;
  let normalized = {
    fontPreset: normalizeFontPreset(typography.fontPreset, fallback.fontPreset),
    customFontFamily: normalizeString(typography.customFontFamily, fallback.customFontFamily),
    lineHeight: clampNumber(typography.lineHeight, 1.1, 2.4, fallback.lineHeight, 0.01),
    paragraphSpacing: clampNumber(typography.paragraphSpacing, 0, 32, fallback.paragraphSpacing, 1),
    bodyFontSize: clampNumber(typography.bodyFontSize, 12, 28, fallback.bodyFontSize, 1),
    h1FontSize: clampNumber(typography.h1FontSize, 16, 44, fallback.h1FontSize, 1),
    h2FontSize: clampNumber(typography.h2FontSize, 15, 40, fallback.h2FontSize, 1),
    h3FontSize: clampNumber(typography.h3FontSize, 14, 36, fallback.h3FontSize, 1),
    tableFontSize: clampNumber(typography.tableFontSize, 12, 28, fallback.tableFontSize, 1),
  };
  if (savedRevision < 2 && normalized.bodyFontSize === 17) {
    normalized = { ...normalized, bodyFontSize: fallback.bodyFontSize };
  }
  if (savedRevision < 3) {
    normalized = {
      ...normalized,
      h1FontSize: normalized.h1FontSize === LEGACY_EDITOR_HEADING_FONT_SIZES.h1FontSize ? fallback.h1FontSize : normalized.h1FontSize,
      h2FontSize: normalized.h2FontSize === LEGACY_EDITOR_HEADING_FONT_SIZES.h2FontSize ? fallback.h2FontSize : normalized.h2FontSize,
      h3FontSize: normalized.h3FontSize === LEGACY_EDITOR_HEADING_FONT_SIZES.h3FontSize ? fallback.h3FontSize : normalized.h3FontSize,
    };
  }
  if (savedRevision < 4) {
    normalized = {
      ...normalized,
      h1FontSize:
        normalized.h1FontSize === PREVIOUS_DEFAULT_EDITOR_HEADING_FONT_SIZES.h1FontSize ? fallback.h1FontSize : normalized.h1FontSize,
      h2FontSize:
        normalized.h2FontSize === PREVIOUS_DEFAULT_EDITOR_HEADING_FONT_SIZES.h2FontSize ? fallback.h2FontSize : normalized.h2FontSize,
      h3FontSize:
        normalized.h3FontSize === PREVIOUS_DEFAULT_EDITOR_HEADING_FONT_SIZES.h3FontSize ? fallback.h3FontSize : normalized.h3FontSize,
    };
  }
  return normalized;
}

function normalizeRevision(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 1;
}

function normalizeFontPreset(value: unknown, fallback: EditorTypographySettings["fontPreset"]): EditorTypographySettings["fontPreset"] {
  if (
    value === "system" ||
    value === "pingfang" ||
    value === "songti" ||
    value === "kaiti" ||
    value === "lxgw-wenkai" ||
    value === "huiwen-mincho" ||
    value === "mono" ||
    value === "custom"
  ) {
    return value;
  }
  return fallback;
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number, precision: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const multiplier = 1 / precision;
  return Math.min(max, Math.max(min, Math.round(value * multiplier) / multiplier));
}

function normalizeInspectorWidth(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(520, Math.max(360, Math.round(value)));
}

function normalizeAgentModel(value: unknown): AgentModel {
  return typeof value === "string" && value.trim() ? value : "auto";
}

function normalizeCodexCliProbe(value: unknown): CodexCliProbeSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const probe = value as Partial<CodexCliProbeSnapshot>;
  if (typeof probe.ok !== "boolean" || typeof probe.resolvedPath !== "string") return null;
  return { ok: probe.ok, resolvedPath: probe.resolvedPath.trim() };
}

function normalizeAgentReasoningEffort(value: unknown): AgentReasoningEffort {
  return typeof value === "string" && value.trim() ? value : "medium";
}

function normalizeAssistantSendMode(value: unknown): AssistantSendMode {
  return value === "mod-enter" ? "mod-enter" : "enter";
}

function normalizeSheetSortPreferences(value: unknown): Record<string, SheetSortPreference> {
  if (!value || typeof value !== "object") return {};
  const preferences: Record<string, SheetSortPreference> = {};
  for (const [key, preference] of Object.entries(value)) {
    if (!preference || typeof preference !== "object") continue;
    const mode = "mode" in preference ? preference.mode : undefined;
    const direction = "direction" in preference ? preference.direction : undefined;
    if (
      (mode === "manual" || mode === "title" || mode === "updated" || mode === "created") &&
      (direction === "asc" || direction === "desc")
    ) {
      preferences[key] = { mode, direction };
    }
  }
  return preferences;
}

function normalizeSheetManualOrders(value: unknown): SheetManualOrders {
  if (!value || typeof value !== "object") return {};
  const orders: SheetManualOrders = {};
  for (const [key, order] of Object.entries(value)) {
    if (!Array.isArray(order)) continue;
    const ids = order.filter((item): item is string => typeof item === "string" && item.length > 0);
    if (ids.length > 0) orders[key] = Array.from(new Set(ids));
  }
  return orders;
}
