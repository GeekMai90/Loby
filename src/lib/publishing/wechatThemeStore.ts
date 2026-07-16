import { invoke } from "@tauri-apps/api/core";
import { isDesktopPublishingAvailable } from "./api";
import { cloneWechatThemeManifest, isWechatThemeManifest } from "./wechatThemeModel";
import type { WechatThemeManifest } from "./wechatThemes";

const BROWSER_STORE_KEY = "nibva.publish.wechat.personal-themes.v1";
export const WECHAT_SELECTED_THEME_STORAGE_KEY = "nibva.publish.wechat.theme";

export interface WechatThemeStoreSnapshot {
  schemaVersion: 1;
  themes: WechatThemeManifest[];
  revisions: Record<string, WechatThemeManifest[]>;
}

export interface WechatThemeStudioSession {
  libraryPath: string;
  activeProjectId: string;
  activeSheetId: string;
  selectedThemeId: string;
}

export async function loadWechatThemeStore(): Promise<WechatThemeStoreSnapshot> {
  const raw = isDesktopPublishingAvailable() ? await invoke<unknown>("load_wechat_theme_store") : readBrowserStore();
  return normalizeWechatThemeStore(raw);
}

export async function savePersonalWechatTheme(theme: WechatThemeManifest): Promise<WechatThemeStoreSnapshot> {
  assertPersonalTheme(theme);
  if (isDesktopPublishingAvailable()) {
    return normalizeWechatThemeStore(await invoke<unknown>("save_wechat_theme", { theme }));
  }
  const store = normalizeWechatThemeStore(readBrowserStore());
  const index = store.themes.findIndex((saved) => saved.id === theme.id);
  if (index >= 0 && JSON.stringify(store.themes[index]) !== JSON.stringify(theme)) {
    store.revisions[theme.id] = [...(store.revisions[theme.id] ?? []), store.themes[index]].slice(-20);
    store.themes[index] = cloneWechatThemeManifest(theme);
  } else if (index < 0) {
    store.themes.push(cloneWechatThemeManifest(theme));
  }
  writeBrowserStore(store);
  return store;
}

export async function undoPersonalWechatTheme(themeId: string): Promise<WechatThemeStoreSnapshot> {
  if (isDesktopPublishingAvailable()) {
    return normalizeWechatThemeStore(await invoke<unknown>("undo_wechat_theme", { themeId }));
  }
  const store = normalizeWechatThemeStore(readBrowserStore());
  const previous = store.revisions[themeId]?.pop();
  if (!previous) throw new Error("这个主题还没有可撤销的修改。");
  const index = store.themes.findIndex((theme) => theme.id === themeId);
  if (index < 0) throw new Error("找不到要撤销的个人主题。");
  store.themes[index] = previous;
  writeBrowserStore(store);
  return store;
}

export async function deletePersonalWechatTheme(themeId: string): Promise<WechatThemeStoreSnapshot> {
  if (isDesktopPublishingAvailable()) {
    return normalizeWechatThemeStore(await invoke<unknown>("delete_wechat_theme", { themeId }));
  }
  const store = normalizeWechatThemeStore(readBrowserStore());
  const nextThemes = store.themes.filter((theme) => theme.id !== themeId);
  if (nextThemes.length === store.themes.length) throw new Error("找不到要删除的个人主题。");
  store.themes = nextThemes;
  delete store.revisions[themeId];
  writeBrowserStore(store);
  return store;
}

export async function openWechatThemeStudio(session: WechatThemeStudioSession): Promise<void> {
  if (!isDesktopPublishingAvailable()) throw new Error("请在 Nibva 桌面应用中打开公众号主题工作室。");
  await invoke("open_wechat_theme_studio", { session });
}

export async function getWechatThemeStudioSession(): Promise<WechatThemeStudioSession> {
  if (!isDesktopPublishingAvailable()) {
    throw new Error("浏览器开发模式没有公众号主题工作室会话。");
  }
  return invoke<WechatThemeStudioSession>("get_wechat_theme_studio_session");
}

export function createPersonalWechatTheme(base: WechatThemeManifest, name = `${base.name}副本`): WechatThemeManifest {
  const now = new Date().toISOString();
  const copy = cloneWechatThemeManifest(base);
  return {
    ...copy,
    id: `theme-${createThemeIdSuffix()}`,
    kind: "personal",
    name,
    baseThemeId: base.id,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeWechatThemeStore(value: unknown): WechatThemeStoreSnapshot {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.themes) || !isRecord(value.revisions)) {
    throw new Error("个人主题数据格式无效。");
  }
  const themes = value.themes.map((theme) => {
    if (!isWechatThemeManifest(theme) || theme.kind !== "personal") throw new Error("个人主题数据包含无效主题。");
    return cloneWechatThemeManifest(theme);
  });
  const revisions: Record<string, WechatThemeManifest[]> = {};
  for (const [themeId, history] of Object.entries(value.revisions)) {
    if (!Array.isArray(history)) throw new Error("个人主题修订记录无效。");
    revisions[themeId] = history.map((theme) => {
      if (!isWechatThemeManifest(theme) || theme.kind !== "personal") throw new Error("个人主题修订记录包含无效主题。");
      return cloneWechatThemeManifest(theme);
    });
  }
  return { schemaVersion: 1, themes, revisions };
}

function assertPersonalTheme(theme: WechatThemeManifest) {
  if (!isWechatThemeManifest(theme)) throw new Error("个人主题未通过格式校验。");
  if (theme.kind !== "personal") throw new Error("内置主题不能被覆盖。");
}

function emptyStore(): WechatThemeStoreSnapshot {
  return { schemaVersion: 1, themes: [], revisions: {} };
}

function readBrowserStore(): unknown {
  try {
    const raw = localStorage.getItem(BROWSER_STORE_KEY);
    return raw ? JSON.parse(raw) : emptyStore();
  } catch {
    return emptyStore();
  }
}

function writeBrowserStore(store: WechatThemeStoreSnapshot) {
  localStorage.setItem(BROWSER_STORE_KEY, JSON.stringify(store));
}

function createThemeIdSuffix(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().toLowerCase();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
