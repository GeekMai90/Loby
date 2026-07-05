import type { AgentProvider, SheetManualOrders, SheetSortPreference } from "../types";

const SETTINGS_STORAGE_KEY = "nibva.agentSettings.v1";

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
    activeGroupIdsByProject: {},
    sheetSortPreferences: {},
    sheetManualOrders: {},
  };
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
