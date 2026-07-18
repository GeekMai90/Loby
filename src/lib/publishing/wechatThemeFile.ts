import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { cloneWechatThemeManifest, normalizeWechatThemeManifest } from "./wechatThemeModel";
import { createPersonalWechatTheme } from "./wechatThemeStore";
import type { WechatThemeManifest } from "./wechatThemes";

export const WECHAT_THEME_FILE_EXTENSION = "lobytheme";
export const WECHAT_THEME_FILE_FORMAT = "loby-wechat-theme";
export const WECHAT_THEME_FILE_FORMAT_VERSION = 1 as const;

interface WechatThemeFileEnvelope {
  format: typeof WECHAT_THEME_FILE_FORMAT;
  formatVersion: typeof WECHAT_THEME_FILE_FORMAT_VERSION;
  theme: WechatThemeManifest;
}

export function serializeWechatThemeFile(theme: WechatThemeManifest): string {
  const payload: WechatThemeFileEnvelope = {
    format: WECHAT_THEME_FILE_FORMAT,
    formatVersion: WECHAT_THEME_FILE_FORMAT_VERSION,
    theme: cloneWechatThemeManifest(theme),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function parseWechatThemeFile(content: string): WechatThemeManifest {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    throw new Error("主题文件不是有效的 JSON。");
  }
  if (!isRecord(value) || value.format !== WECHAT_THEME_FILE_FORMAT) {
    throw new Error("这不是落笔公众号主题文件。");
  }
  if (value.formatVersion !== WECHAT_THEME_FILE_FORMAT_VERSION) {
    throw new Error("主题文件版本不受支持。");
  }
  const theme = normalizeWechatThemeManifest(value.theme);
  if (!theme) throw new Error("主题文件中的样式数据无效。");
  return theme;
}

export function createImportedWechatTheme(source: WechatThemeManifest): WechatThemeManifest {
  return createPersonalWechatTheme(source, source.name);
}

export async function chooseWechatThemeFileToImport(): Promise<WechatThemeManifest | null> {
  const path = await open({
    directory: false,
    multiple: false,
    title: "导入公众号主题",
    filters: [{ name: "落笔公众号主题", extensions: [WECHAT_THEME_FILE_EXTENSION] }],
  });
  if (!path || Array.isArray(path)) return null;
  const content = await invoke<string>("read_wechat_theme_file", { path });
  return createImportedWechatTheme(parseWechatThemeFile(content));
}

export async function chooseWechatThemeExportPath(theme: WechatThemeManifest): Promise<string | null> {
  const selectedPath = await save({
    title: "导出公众号主题",
    defaultPath: `${safeThemeFilename(theme.name)}.${WECHAT_THEME_FILE_EXTENSION}`,
    filters: [{ name: "落笔公众号主题", extensions: [WECHAT_THEME_FILE_EXTENSION] }],
  });
  if (!selectedPath) return null;
  const path = selectedPath.toLowerCase().endsWith(`.${WECHAT_THEME_FILE_EXTENSION}`)
    ? selectedPath
    : `${selectedPath}.${WECHAT_THEME_FILE_EXTENSION}`;
  await invoke("write_wechat_theme_file", { path, content: serializeWechatThemeFile(theme) });
  return path;
}

export function safeThemeFilename(name: string): string {
  const sanitized = [...name.trim()]
    .map((character) => (character.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(character) ? "-" : character))
    .join("");
  return (
    sanitized
      .replace(/\s+/g, " ")
      .replace(/[. ]+$/g, "")
      .slice(0, 80) || "公众号主题"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
