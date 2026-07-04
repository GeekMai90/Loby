const SETTINGS_STORAGE_KEY = "nibva.agentSettings.v1";

export interface AgentSettings {
  planMode: boolean;
  codexCliPath: string;
  libraryPath: string;
  activeProjectId: string;
  activeSheetId: string;
  libraryRailOpen: boolean;
  sheetRailOpen: boolean;
  inspectorOpen: boolean;
  focusMode: boolean;
  typewriterMode: boolean;
}

export function loadAgentSettings(): AgentSettings {
  const fallback = defaultAgentSettings();
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AgentSettings>;
    return {
      ...fallback,
      codexCliPath: parsed.codexCliPath ?? "",
      libraryPath: parsed.libraryPath ?? "",
      activeProjectId: parsed.activeProjectId ?? "",
      activeSheetId: parsed.activeSheetId ?? "",
      planMode: parsed.planMode ?? fallback.planMode,
      libraryRailOpen: parsed.libraryRailOpen ?? fallback.libraryRailOpen,
      sheetRailOpen: parsed.sheetRailOpen ?? fallback.sheetRailOpen,
      inspectorOpen: parsed.inspectorOpen ?? fallback.inspectorOpen,
      focusMode: parsed.focusMode ?? fallback.focusMode,
      typewriterMode: parsed.typewriterMode ?? fallback.typewriterMode,
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
    codexCliPath: "",
    libraryPath: "",
    activeProjectId: "",
    activeSheetId: "",
    libraryRailOpen: true,
    sheetRailOpen: true,
    inspectorOpen: true,
    focusMode: false,
    typewriterMode: false,
  };
}
