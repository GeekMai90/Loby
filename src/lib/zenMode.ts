import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type { EditorTypographySettings, WritingSheet } from "../types";

export const ZEN_MODE_SESSION_STORAGE_KEY = "nibva.zen.session.v1";
export const ZEN_MODE_PREFERENCES_STORAGE_KEY = "nibva.zen.preferences.v1";
export const ZEN_MODE_DEFAULT_BACKGROUND = "/assets/zen-mountains.png";
export const ZEN_MODE_PREFERENCES_CHANGED_EVENT = "nibva://zen-preferences-changed";
export const ZEN_MODE_EXIT_REQUESTED_EVENT = "nibva://zen-exit-requested";

export type ZenModeWindowKind = "background" | "editor" | null;

export type ZenSoundId = "rain" | "ocean" | "forest" | "fireplace";

export interface ZenModeSession {
  libraryPath: string;
  projectId: string;
  projectTitle: string;
  sheet: WritingSheet;
  typography: EditorTypographySettings;
}

export interface ZenModePreferences {
  backgroundImagePath: string;
  soundEnabled: boolean;
  soundId: ZenSoundId;
}

export const DEFAULT_ZEN_MODE_PREFERENCES: ZenModePreferences = {
  backgroundImagePath: "",
  soundEnabled: false,
  soundId: "rain",
};

export const ZEN_SOUND_OPTIONS: Array<{ id: ZenSoundId; label: string }> = [
  { id: "rain", label: "细雨" },
  { id: "ocean", label: "海浪" },
  { id: "forest", label: "林间" },
  { id: "fireplace", label: "炉火" },
];

export function saveZenModeSession(session: ZenModeSession): void {
  localStorage.setItem(ZEN_MODE_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function loadZenModeSession(): ZenModeSession | null {
  try {
    const raw = localStorage.getItem(ZEN_MODE_SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ZenModeSession) : null;
  } catch {
    return null;
  }
}

export function loadZenModePreferences(): ZenModePreferences {
  try {
    const raw = localStorage.getItem(ZEN_MODE_PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_ZEN_MODE_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<ZenModePreferences>;
    const soundId = ZEN_SOUND_OPTIONS.some((option) => option.id === parsed.soundId) ? parsed.soundId! : "rain";
    return {
      backgroundImagePath: typeof parsed.backgroundImagePath === "string" ? parsed.backgroundImagePath : "",
      soundEnabled: parsed.soundEnabled === true,
      soundId,
    };
  } catch {
    return DEFAULT_ZEN_MODE_PREFERENCES;
  }
}

export function saveZenModePreferences(preferences: ZenModePreferences): void {
  localStorage.setItem(ZEN_MODE_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
}

export function resolveZenBackgroundUrl(path: string): string {
  if (!path) return ZEN_MODE_DEFAULT_BACKGROUND;
  return isTauriRuntime() ? convertFileSrc(path) : path;
}

export async function chooseZenBackgroundImage(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const selected = await open({
    directory: false,
    multiple: false,
    title: "选择禅模式背景图像",
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "avif"] }],
  });
  return typeof selected === "string" ? selected : null;
}

export async function enterZenModeWindow(): Promise<void> {
  if (!isTauriRuntime()) {
    window.location.assign("/?window=zen-editor");
    return;
  }
  await invoke("enter_zen_mode");
}

export async function markZenModeWindowReady(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("mark_zen_window_ready");
}

export async function notifyZenModePreferencesChanged(preferences: ZenModePreferences): Promise<void> {
  if (!isTauriRuntime()) return;
  await emit(ZEN_MODE_PREFERENCES_CHANGED_EVENT, preferences);
}

export async function exitZenModeWindow(): Promise<void> {
  if (!isTauriRuntime()) {
    if (window.history.length > 1) window.history.back();
    else window.location.assign("/");
    return;
  }
  await invoke("exit_zen_mode");
}

export async function saveZenSheet(
  session: ZenModeSession,
  update: { title: string; body: string; updatedAt: string },
): Promise<WritingSheet> {
  if (!isTauriRuntime()) {
    const sheet = { ...session.sheet, ...update };
    saveZenModeSession({ ...session, sheet });
    return sheet;
  }

  return invoke<WritingSheet>("save_zen_sheet_at", {
    path: session.libraryPath,
    projectId: session.projectId,
    sheetId: session.sheet.id,
    title: update.title,
    body: update.body,
    updatedAt: update.updatedAt,
  });
}

export function isZenModeWindow(): boolean {
  return getZenModeWindowKind() !== null;
}

export function getZenModeWindowKind(): ZenModeWindowKind {
  const windowKind = new URLSearchParams(window.location.search).get("window");
  if (windowKind === "zen-background") return "background";
  if (windowKind === "zen" || windowKind === "zen-editor") return "editor";
  return null;
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
