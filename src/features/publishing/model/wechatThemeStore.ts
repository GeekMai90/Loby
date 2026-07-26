/**
 * [INPUT]: 依赖 Tauri API、发布模块、shared 公共契约
 * [OUTPUT]: 对外提供 WECHAT_SELECTED_THEME_STORAGE_KEY、WechatThemePreferences、WechatThemeStoreSnapshot、WechatThemeConversation、WechatThemeConversationMessage、WechatThemeStudioSession、loadWechatThemeStore、saveWechatThemePreferences 等公开能力
 * [POS]: 发布 feature 的领域模型边界，集中 发布 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { invoke } from "@tauri-apps/api/core";
import { isDesktopPublishingAvailable } from "@/features/publishing/model/api";
import {
  cloneWechatThemeManifest,
  hasLegacyWechatThemeNamespace,
  isWechatThemeManifest,
  normalizeWechatThemeManifest,
} from "@/features/publishing/model/wechatThemeModel";
import { DEFAULT_WECHAT_THEME_ID, getLegacyWechatTheme, type WechatThemeManifest } from "@/features/publishing/model/wechatThemes";
import type { AgentRunActivity, AgentRunInfo, AgentUsage, AiImageAttachment } from "@/shared/types";

const BROWSER_STORE_KEY = "loby.publish.wechat.personal-themes.v1";
export const WECHAT_SELECTED_THEME_STORAGE_KEY = "loby.publish.wechat.theme";

export interface WechatThemePreferences {
  defaultThemeId: string;
  favoriteThemeIds: string[];
}

export interface WechatThemeStoreSnapshot {
  schemaVersion: 2;
  themes: WechatThemeManifest[];
  revisions: Record<string, WechatThemeManifest[]>;
  redos: Record<string, WechatThemeManifest[]>;
  conversations: Record<string, WechatThemeConversation[]>;
  activeConversationIds: Record<string, string>;
  preferences: WechatThemePreferences;
}

export interface WechatThemeConversation {
  id: string;
  title: string;
  messages: WechatThemeConversationMessage[];
  themeContextUpdatedAt?: string;
  themeContextVersion?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WechatThemeConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: AiImageAttachment[];
  run?: AgentRunInfo;
  error?: boolean;
}

export interface WechatThemeStudioSession {
  libraryPath: string;
  activeProjectId: string;
  activeSheetId: string;
  selectedThemeId: string;
}

export async function loadWechatThemeStore(libraryPath: string): Promise<WechatThemeStoreSnapshot> {
  const desktopAvailable = isDesktopPublishingAvailable();
  const raw = desktopAvailable ? await invoke<unknown>("load_wechat_theme_store", { libraryPath }) : readBrowserStore();
  let store = normalizeWechatThemeStore(raw);
  const legacyThemeIds = legacyNamespaceThemeIds(raw);
  if (legacyThemeIds.length > 0) {
    if (desktopAvailable) {
      try {
        for (const themeId of legacyThemeIds) {
          const theme = store.themes.find((item) => item.id === themeId);
          if (theme) store = normalizeWechatThemeStore(await invoke<unknown>("save_wechat_theme", { libraryPath, theme }));
        }
      } catch {
        // Keep the in-memory migration active when a read-only library cannot persist it yet.
      }
    } else {
      try {
        writeBrowserStore(store);
      } catch {
        // The normalized in-memory store is still safe to use when browser storage is unavailable.
      }
    }
  }
  return migrateLegacySelectedTheme(store, libraryPath);
}

export async function saveWechatThemePreferences(
  libraryPath: string,
  preferences: WechatThemePreferences,
): Promise<WechatThemeStoreSnapshot> {
  const normalizedPreferences = normalizeWechatThemePreferences(preferences);
  if (isDesktopPublishingAvailable()) {
    return normalizeWechatThemeStore(
      await invoke<unknown>("save_wechat_theme_preferences", { libraryPath, preferences: normalizedPreferences }),
    );
  }
  const store = normalizeWechatThemeStore(readBrowserStore());
  store.preferences = normalizedPreferences;
  writeBrowserStore(store);
  return store;
}

export async function savePersonalWechatTheme(libraryPath: string, theme: WechatThemeManifest): Promise<WechatThemeStoreSnapshot> {
  assertPersonalTheme(theme);
  if (isDesktopPublishingAvailable()) {
    return normalizeWechatThemeStore(await invoke<unknown>("save_wechat_theme", { libraryPath, theme }));
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

export async function undoPersonalWechatTheme(libraryPath: string, themeId: string): Promise<WechatThemeStoreSnapshot> {
  if (isDesktopPublishingAvailable()) {
    return normalizeWechatThemeStore(await invoke<unknown>("undo_wechat_theme", { libraryPath, themeId }));
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

export async function redoPersonalWechatTheme(libraryPath: string, themeId: string): Promise<WechatThemeStoreSnapshot> {
  if (isDesktopPublishingAvailable()) {
    return normalizeWechatThemeStore(await invoke<unknown>("redo_wechat_theme", { libraryPath, themeId }));
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

export async function saveWechatThemeConversations(
  libraryPath: string,
  themeId: string,
  conversations: WechatThemeConversation[],
  activeConversationId: string,
): Promise<WechatThemeStoreSnapshot> {
  const normalizedConversations = conversations.slice(0, 50).map(stripConversationImages);
  if (isDesktopPublishingAvailable()) {
    return normalizeWechatThemeStore(
      await invoke<unknown>("save_wechat_theme_conversations", {
        libraryPath,
        themeId,
        conversations: normalizedConversations,
        activeConversationId,
      }),
    );
  }
  const store = normalizeWechatThemeStore(readBrowserStore());
  if (!store.themes.some((theme) => theme.id === themeId)) throw new Error("找不到对应的个人主题。");
  store.conversations[themeId] = normalizedConversations;
  store.activeConversationIds[themeId] = activeConversationId;
  writeBrowserStore(store);
  return store;
}

export async function deletePersonalWechatTheme(libraryPath: string, themeId: string): Promise<WechatThemeStoreSnapshot> {
  if (isDesktopPublishingAvailable()) {
    return normalizeWechatThemeStore(await invoke<unknown>("delete_wechat_theme", { libraryPath, themeId }));
  }
  const store = normalizeWechatThemeStore(readBrowserStore());
  const nextThemes = store.themes.filter((theme) => theme.id !== themeId);
  if (nextThemes.length === store.themes.length) throw new Error("找不到要删除的个人主题。");
  store.themes = nextThemes;
  delete store.revisions[themeId];
  delete store.redos[themeId];
  delete store.conversations[themeId];
  delete store.activeConversationIds[themeId];
  store.preferences.favoriteThemeIds = store.preferences.favoriteThemeIds.filter((id) => id !== themeId);
  if (store.preferences.defaultThemeId === themeId) store.preferences.defaultThemeId = DEFAULT_WECHAT_THEME_ID;
  writeBrowserStore(store);
  return store;
}

export async function openWechatThemeStudio(session: WechatThemeStudioSession): Promise<void> {
  if (!isDesktopPublishingAvailable()) throw new Error("请在落笔桌面应用中打开公众号主题工作室。");
  await invoke("open_wechat_theme_studio", { session });
}

export async function getWechatThemeStudioSession(): Promise<WechatThemeStudioSession> {
  if (!isDesktopPublishingAvailable()) {
    throw new Error("浏览器开发模式没有公众号主题工作室会话。");
  }
  return invoke<WechatThemeStudioSession>("get_wechat_theme_studio_session");
}

export function createPersonalWechatTheme(base: WechatThemeManifest, name = `${base.name} · 副本`): WechatThemeManifest {
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
  if (
    !isRecord(value) ||
    (value.schemaVersion !== 1 && value.schemaVersion !== 2) ||
    !Array.isArray(value.themes) ||
    !isRecord(value.revisions)
  ) {
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
  const activeConversationIds = normalizeActiveConversationIds(value.activeConversationIds, conversations);
  const preferences = normalizeWechatThemePreferences(value.preferences);
  return { schemaVersion: 2, themes, revisions, redos, conversations, activeConversationIds, preferences };
}

export function normalizeWechatThemePreferences(value: unknown): WechatThemePreferences {
  if (value === undefined) return { defaultThemeId: DEFAULT_WECHAT_THEME_ID, favoriteThemeIds: [] };
  if (!isRecord(value)) throw new Error("主题偏好数据无效。");
  const defaultThemeId = normalizeThemePreferenceId(value.defaultThemeId) ?? DEFAULT_WECHAT_THEME_ID;
  if (!Array.isArray(value.favoriteThemeIds)) throw new Error("主题收藏数据无效。");
  const favoriteThemeIds = [...new Set(value.favoriteThemeIds.map(normalizeThemePreferenceId).filter((id): id is string => Boolean(id)))];
  return { defaultThemeId, favoriteThemeIds: favoriteThemeIds.slice(0, 200) };
}

function assertPersonalTheme(theme: WechatThemeManifest) {
  if (!isWechatThemeManifest(theme)) throw new Error("个人主题未通过格式校验。");
  if (theme.kind !== "personal") throw new Error("内置主题不能被覆盖。");
}

function emptyStore(): WechatThemeStoreSnapshot {
  return {
    schemaVersion: 2,
    themes: [],
    revisions: {},
    redos: {},
    conversations: {},
    activeConversationIds: {},
    preferences: { defaultThemeId: DEFAULT_WECHAT_THEME_ID, favoriteThemeIds: [] },
  };
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

function normalizeConversations(value: unknown): Record<string, WechatThemeConversation[]> {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new Error("个人主题对话记录无效。");
  const result: Record<string, WechatThemeConversation[]> = {};
  for (const [themeId, conversations] of Object.entries(value)) {
    if (!Array.isArray(conversations)) throw new Error("个人主题对话记录包含无效消息。");
    if (conversations.every(isConversationMessage)) {
      result[themeId] = conversations.length > 0 ? [createWechatThemeConversationFromLegacy(themeId, conversations)] : [];
      continue;
    }
    if (!conversations.every(isWechatThemeConversation)) throw new Error("个人主题对话记录包含无效消息。");
    result[themeId] = conversations.map(cloneConversation);
  }
  return result;
}

function normalizeActiveConversationIds(value: unknown, conversations: Record<string, WechatThemeConversation[]>): Record<string, string> {
  if (value !== undefined && !isRecord(value)) throw new Error("个人主题当前对话记录无效。");
  const result: Record<string, string> = {};
  for (const [themeId, items] of Object.entries(conversations)) {
    const preferred = isRecord(value) && typeof value[themeId] === "string" ? value[themeId] : "";
    result[themeId] = items.some((conversation) => conversation.id === preferred) ? preferred : (items[0]?.id ?? "");
  }
  return result;
}

function isWechatThemeConversation(value: unknown): value is WechatThemeConversation {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    value.id.length <= 120 &&
    typeof value.title === "string" &&
    value.title.length > 0 &&
    value.title.length <= 240 &&
    Array.isArray(value.messages) &&
    value.messages.length <= 50 &&
    value.messages.every(isConversationMessage) &&
    (value.themeContextUpdatedAt === undefined ||
      (typeof value.themeContextUpdatedAt === "string" && value.themeContextUpdatedAt.length <= 80)) &&
    (value.themeContextVersion === undefined || value.themeContextVersion === 2) &&
    typeof value.createdAt === "string" &&
    value.createdAt.length > 0 &&
    value.createdAt.length <= 80 &&
    typeof value.updatedAt === "string" &&
    value.updatedAt.length > 0 &&
    value.updatedAt.length <= 80
  );
}

function cloneConversation(conversation: WechatThemeConversation): WechatThemeConversation {
  return {
    ...conversation,
    messages: conversation.messages.slice(-50).map(cloneConversationMessage),
  };
}

function stripConversationImages(conversation: WechatThemeConversation): WechatThemeConversation {
  return {
    ...conversation,
    messages: conversation.messages.slice(-50).map(stripMessageImages),
  };
}

function createWechatThemeConversationFromLegacy(themeId: string, messages: WechatThemeConversationMessage[]): WechatThemeConversation {
  const firstPrompt = messages.find((message) => message.role === "user")?.content ?? "";
  return {
    id: `theme-chat-${themeId}-legacy`,
    title: deriveWechatThemeConversationTitle(firstPrompt),
    messages: messages.slice(-50).map(cloneConversationMessage),
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

export function createWechatThemeConversation(title = "新对话"): WechatThemeConversation {
  const now = new Date().toISOString();
  return {
    id: `theme-chat-${createThemeIdSuffix()}`,
    title,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function deriveWechatThemeConversationTitle(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return "新对话";
  return normalized.length > 18 ? `${normalized.slice(0, 18)}...` : normalized;
}

function isConversationMessage(value: unknown): value is WechatThemeConversationMessage {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    value.id.length <= 120 &&
    (value.role === "user" || value.role === "assistant") &&
    typeof value.content === "string" &&
    value.content.length <= 20_000 &&
    (value.error === undefined || typeof value.error === "boolean") &&
    (value.run === undefined || isAgentRunInfo(value.run))
  );
}

function cloneConversationMessage(message: WechatThemeConversationMessage): WechatThemeConversationMessage {
  return stripMessageImages(message);
}

function stripMessageImages(message: WechatThemeConversationMessage): WechatThemeConversationMessage {
  const { images: _transientImages, ...persistedMessage } = message;
  return _transientImages?.length && !persistedMessage.content.trim() ? { ...persistedMessage, content: "[图片附件]" } : persistedMessage;
}

function isAgentRunInfo(value: unknown): value is AgentRunInfo {
  if (!isRecord(value)) return false;
  if (!isAgentRunStatus(value.status) || !Array.isArray(value.activities) || value.activities.length > 200) return false;
  if (!value.activities.every(isAgentRunActivity)) return false;
  if (value.usage !== null && !isAgentUsage(value.usage)) return false;
  return value.error === undefined || typeof value.error === "string";
}

function isAgentRunStatus(value: unknown): value is AgentRunInfo["status"] {
  return value === "running" || value === "completed" || value === "error" || value === "cancelled";
}

function isAgentRunActivity(value: unknown): value is AgentRunActivity {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.rawType === "string" &&
    typeof value.title === "string" &&
    typeof value.status === "string" &&
    typeof value.command === "string" &&
    typeof value.output === "string" &&
    typeof value.text === "string" &&
    (value.artifactPath === undefined || typeof value.artifactPath === "string") &&
    (value.exitCode === null || typeof value.exitCode === "number")
  );
}

function isAgentUsage(value: unknown): value is AgentUsage {
  return (
    isRecord(value) &&
    typeof value.inputTokens === "number" &&
    typeof value.cachedInputTokens === "number" &&
    typeof value.outputTokens === "number" &&
    typeof value.reasoningOutputTokens === "number"
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

async function migrateLegacySelectedTheme(store: WechatThemeStoreSnapshot, libraryPath: string): Promise<WechatThemeStoreSnapshot> {
  let selectedThemeId: string;
  try {
    selectedThemeId = localStorage.getItem(WECHAT_SELECTED_THEME_STORAGE_KEY) ?? "";
  } catch {
    return store;
  }
  const legacy = getLegacyWechatTheme(selectedThemeId);
  if (!legacy) return store;

  const existing = store.themes.find((theme) => theme.baseThemeId === legacy.id && theme.name === legacy.name);
  const personal = existing ?? createPersonalWechatTheme(legacy, legacy.name);
  const withTheme = existing ? store : await savePersonalWechatTheme(libraryPath, personal);
  const preferences = {
    ...withTheme.preferences,
    defaultThemeId: personal.id,
    favoriteThemeIds: withTheme.preferences.favoriteThemeIds.filter((id) => id !== legacy.id),
  };
  const migrated = await saveWechatThemePreferences(libraryPath, preferences);
  localStorage.setItem(WECHAT_SELECTED_THEME_STORAGE_KEY, personal.id);
  return migrated;
}

function normalizeThemePreferenceId(value: unknown): string | null {
  return typeof value === "string" && /^[a-z0-9][a-z0-9._-]{0,79}$/.test(value) ? value : null;
}

function legacyNamespaceThemeIds(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.themes)) return [];
  return value.themes.flatMap((theme) => {
    if (!isRecord(theme) || typeof theme.id !== "string" || !hasLegacyWechatThemeNamespace(theme)) return [];
    return [theme.id];
  });
}

function createThemeIdSuffix(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().toLowerCase();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
