/**
 * [INPUT]: 依赖 Tauri invoke 与 native 百度翻译 command
 * [OUTPUT]: 对外提供百度开放平台配置状态、凭证保存/验证/删除与搜索词翻译的 renderer 适配
 * [POS]: media feature 的百度翻译外部服务边界；不向 renderer 回传凭证明文
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { invoke } from "@tauri-apps/api/core";

export interface BaiduTranslationSettings {
  configured: boolean;
}

export interface SaveBaiduTranslationCredentialsInput {
  appId: string;
  secretKey: string;
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getBaiduTranslationSettings(): Promise<BaiduTranslationSettings> {
  if (!isTauriRuntime()) return { configured: false };
  return invoke<BaiduTranslationSettings>("get_baidu_translation_settings");
}

export async function saveBaiduTranslationCredentials(input: SaveBaiduTranslationCredentialsInput): Promise<BaiduTranslationSettings> {
  if (!isTauriRuntime()) throw new Error("浏览器开发模式不能保存百度翻译凭证。");
  return invoke<BaiduTranslationSettings>("save_baidu_translation_credentials", {
    appId: input.appId,
    secretKey: input.secretKey,
  });
}

export async function deleteBaiduTranslationCredentials(): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("delete_baidu_translation_credentials");
}

export async function validateBaiduTranslationCredentials(): Promise<void> {
  if (!isTauriRuntime()) throw new Error("浏览器开发模式不能验证百度翻译凭证。");
  return invoke<void>("validate_baidu_translation_credentials");
}

export async function translateBaiduSearchQuery(query: string): Promise<string> {
  if (!isTauriRuntime()) throw new Error("浏览器开发模式不能调用百度翻译。");
  return invoke<string>("translate_baidu_search_query", { query });
}
