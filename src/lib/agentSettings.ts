import type { AgentProvider, EditorTypographySettings, ImageReferenceFormat, SheetManualOrders, SheetSortPreference } from "../types";

const SETTINGS_STORAGE_KEY = "nibva.agentSettings.v1";
const EDITOR_TYPOGRAPHY_DEFAULT_REVISION = 2;

export interface AgentSettings {
  planMode: boolean;
  agentProvider: AgentProvider;
  codexCliPath: string;
  claudeCliPath: string;
  libraryPath: string;
  activeProjectId: string;
  activeSheetId: string;
  libraryRailOpen: boolean;
  sheetRailOpen: boolean;
  inspectorOpen: boolean;
  inspectorWidth: number;
  focusMode: boolean;
  typewriterMode: boolean;
  editorTypography: EditorTypographySettings;
  editorTypographyRevision: number;
  imageReferenceFormat: ImageReferenceFormat;
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
      agentProvider: normalizeAgentProvider(parsed.agentProvider),
      codexCliPath: parsed.codexCliPath ?? "",
      claudeCliPath: parsed.claudeCliPath ?? "",
      libraryPath: parsed.libraryPath ?? "",
      activeProjectId: parsed.activeProjectId ?? "",
      activeSheetId: parsed.activeSheetId ?? "",
      planMode: parsed.planMode ?? fallback.planMode,
      libraryRailOpen: parsed.libraryRailOpen ?? fallback.libraryRailOpen,
      sheetRailOpen: parsed.sheetRailOpen ?? fallback.sheetRailOpen,
      inspectorOpen: parsed.inspectorOpen ?? fallback.inspectorOpen,
      inspectorWidth: normalizeInspectorWidth(parsed.inspectorWidth, fallback.inspectorWidth),
      focusMode: parsed.focusMode ?? fallback.focusMode,
      typewriterMode: parsed.typewriterMode ?? fallback.typewriterMode,
      editorTypography: normalizeEditorTypography(
        parsed.editorTypography,
        fallback.editorTypography,
        normalizeRevision(parsed.editorTypographyRevision),
      ),
      editorTypographyRevision: EDITOR_TYPOGRAPHY_DEFAULT_REVISION,
      imageReferenceFormat: normalizeImageReferenceFormat(parsed.imageReferenceFormat),
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
    planMode: false,
    agentProvider: "codex",
    codexCliPath: "",
    claudeCliPath: "",
    libraryPath: "",
    activeProjectId: "",
    activeSheetId: "",
    libraryRailOpen: true,
    sheetRailOpen: true,
    inspectorOpen: true,
    inspectorWidth: 400,
    focusMode: false,
    typewriterMode: false,
    editorTypography: {
      fontPreset: "system",
      customFontFamily: "",
      lineHeight: 1.76,
      paragraphSpacing: 0,
      bodyFontSize: 18,
      h1FontSize: 25,
      h2FontSize: 22,
      h3FontSize: 19,
      tableFontSize: 15,
    },
    editorTypographyRevision: EDITOR_TYPOGRAPHY_DEFAULT_REVISION,
    imageReferenceFormat: "markdown",
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
  const normalized = {
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
    return { ...normalized, bodyFontSize: fallback.bodyFontSize };
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

function normalizeAgentProvider(value: unknown): AgentProvider {
  return value === "claude" ? "claude" : "codex";
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
