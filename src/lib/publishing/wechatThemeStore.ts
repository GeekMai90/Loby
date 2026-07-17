import { invoke } from "@tauri-apps/api/core";
import { isDesktopPublishingAvailable } from "./api";
import { cloneWechatThemeManifest, isWechatThemeManifest, normalizeWechatThemeManifest } from "./wechatThemeModel";
import type { WechatThemeManifest } from "./wechatThemes";

const BROWSER_STORE_KEY = "nibva.publish.wechat.personal-themes.v1";
export const WECHAT_SELECTED_THEME_STORAGE_KEY = "nibva.publish.wechat.theme";

export interface WechatThemeStoreSnapshot {
  schemaVersion: 1;
  themes: WechatThemeManifest[];
  revisions: Record<string, WechatThemeManifest[]>;
  redos: Record<string, WechatThemeManifest[]>;
  conversations: Record<string, WechatThemeConversationMessage[]>;
}

export interface WechatThemeConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: boolean;
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
    delete store.redos[theme.id];
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
  store.redos[themeId] = [...(store.redos[themeId] ?? []), store.themes[index]];
  store.themes[index] = previous;
  writeBrowserStore(store);
  return store;
}

export async function redoPersonalWechatTheme(themeId: string): Promise<WechatThemeStoreSnapshot> {
  if (isDesktopPublishingAvailable()) {
    return normalizeWechatThemeStore(await invoke<unknown>("redo_wechat_theme", { themeId }));
  }
  const store = normalizeWechatThemeStore(readBrowserStore());
  const next = store.redos[themeId]?.pop();
  if (!next) throw new Error("这个主题还没有可重做的修改。");
  const index = store.themes.findIndex((theme) => theme.id === themeId);
  if (index < 0) throw new Error("找不到要重做的个人主题。");
  store.revisions[themeId] = [...(store.revisions[themeId] ?? []), store.themes[index]].slice(-20);
  store.themes[index] = next;
  writeBrowserStore(store);
  return store;
}

export async function saveWechatThemeConversation(
  themeId: string,
  messages: WechatThemeConversationMessage[],
): Promise<WechatThemeStoreSnapshot> {
  const normalizedMessages = messages.slice(-50).map((message) => ({ ...message }));
  if (isDesktopPublishingAvailable()) {
    return normalizeWechatThemeStore(await invoke<unknown>("save_wechat_theme_conversation", { themeId, messages: normalizedMessages }));
  }
  const store = normalizeWechatThemeStore(readBrowserStore());
  if (!store.themes.some((theme) => theme.id === themeId)) throw new Error("找不到对应的个人主题。");
  store.conversations[themeId] = normalizedMessages;
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
  delete store.redos[themeId];
  delete store.conversations[themeId];
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
    const normalized = normalizeWechatThemeManifest(theme);
    if (!normalized || normalized.kind !== "personal") throw new Error("个人主题数据包含无效主题。");
    return normalized;
  });
  const revisions: Record<string, WechatThemeManifest[]> = {};
  for (const [themeId, history] of Object.entries(value.revisions)) {
    if (!Array.isArray(history)) throw new Error("个人主题修订记录无效。");
    revisions[themeId] = history.map((theme) => {
      const normalized = normalizeWechatThemeManifest(theme);
      if (!normalized || normalized.kind !== "personal") throw new Error("个人主题修订记录包含无效主题。");
      return normalized;
    });
  }
  const redos = normalizeThemeHistory(value.redos);
  const conversations = normalizeConversations(value.conversations);
  return { schemaVersion: 1, themes, revisions, redos, conversations };
}

function assertPersonalTheme(theme: WechatThemeManifest) {
  if (!isWechatThemeManifest(theme)) throw new Error("个人主题未通过格式校验。");
  if (theme.kind !== "personal") throw new Error("内置主题不能被覆盖。");
}

function emptyStore(): WechatThemeStoreSnapshot {
  return { schemaVersion: 1, themes: [], revisions: {}, redos: {}, conversations: {} };
}

function normalizeThemeHistory(value: unknown): Record<string, WechatThemeManifest[]> {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new Error("个人主题重做记录无效。");
  const result: Record<string, WechatThemeManifest[]> = {};
  for (const [themeId, history] of Object.entries(value)) {
    if (!Array.isArray(history)) throw new Error("个人主题重做记录无效。");
    result[themeId] = history.map((theme) => {
      const normalized = normalizeWechatThemeManifest(theme);
      if (!normalized || normalized.kind !== "personal") throw new Error("个人主题重做记录包含无效主题。");
      return normalized;
    });
  }
  return result;
}

function normalizeConversations(value: unknown): Record<string, WechatThemeConversationMessage[]> {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new Error("个人主题对话记录无效。");
  const result: Record<string, WechatThemeConversationMessage[]> = {};
  for (const [themeId, messages] of Object.entries(value)) {
    if (!Array.isArray(messages) || !messages.every(isConversationMessage)) throw new Error("个人主题对话记录包含无效消息。");
    result[themeId] = messages.map((message) => ({ ...message }));
  }
  return result;
}

function isConversationMessage(value: unknown): value is WechatThemeConversationMessage {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.role === "user" || value.role === "assistant") &&
    typeof value.content === "string" &&
    (value.error === undefined || typeof value.error === "boolean")
  );
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
