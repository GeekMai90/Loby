/**
 * [INPUT]: 依赖 Tauri API
 * [OUTPUT]: 对外提供 WordPressPublishInput、WordPressPublishResult、MowenPublishInput、MowenVisibility、MowenPublishProgress、PublishImageInput、isDesktopPublishingAvailable、savePublishingSecret 等公开能力
 * [POS]: 发布 feature 的领域模型边界，集中 发布 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Channel, invoke } from "@tauri-apps/api/core";

export interface WordPressPublishInput {
  siteUrl: string;
  username: string;
  title: string;
  content: string;
  excerpt: string;
  status: "draft" | "publish";
  images: PublishImageInput[];
}

export interface WordPressPublishResult {
  id: number;
  status: string;
  link: string;
}

export interface MowenPublishInput {
  body: Record<string, unknown>;
  tags: string[];
  visibility: MowenVisibility;
  images: PublishImageInput[];
}

export type MowenVisibility = "public" | "private";

export type MowenPublishProgress =
  | { stage: "preparing" }
  | { stage: "uploading"; completed: number; total: number }
  | { stage: "creating" }
  | { stage: "settingPrivacy" }
  | { stage: "finished" };

export interface PublishImageInput {
  source: string;
  alt: string;
  placeholder: string;
}

export function isDesktopPublishingAvailable(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function savePublishingSecret(channel: "wordpress" | "mowen", account: string, secret: string): Promise<void> {
  requireDesktopRuntime();
  await invoke("save_publishing_secret", { channel, account, secret });
}

export async function hasPublishingSecret(channel: "wordpress" | "mowen", account: string): Promise<boolean> {
  if (!isDesktopPublishingAvailable()) return false;
  return invoke<boolean>("has_publishing_secret", { channel, account });
}

export async function publishWordPressPost(request: WordPressPublishInput): Promise<WordPressPublishResult> {
  requireDesktopRuntime();
  return invoke<WordPressPublishResult>("publish_wordpress_post", { request });
}

export async function publishMowenNote(
  request: MowenPublishInput,
  onProgress?: (progress: MowenPublishProgress) => void,
): Promise<Record<string, unknown>> {
  requireDesktopRuntime();
  const progressChannel = new Channel<MowenPublishProgress>();
  progressChannel.onmessage = (progress) => onProgress?.(progress);
  return invoke<Record<string, unknown>>("publish_mowen_note", { request, onProgress: progressChannel });
}

export async function validateMowenApiKey(apiKey: string): Promise<void> {
  requireDesktopRuntime();
  await invoke("validate_mowen_api_key", { apiKey });
}

export async function validateSavedMowenApiKey(): Promise<void> {
  requireDesktopRuntime();
  await invoke("validate_saved_mowen_api_key");
}

function requireDesktopRuntime() {
  if (!isDesktopPublishingAvailable()) throw new Error("请在落笔桌面应用中使用直接发布功能。");
}
