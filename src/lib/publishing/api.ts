import { invoke } from "@tauri-apps/api/core";

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
  autoPublish: boolean;
  images: PublishImageInput[];
}

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

export async function publishMowenNote(request: MowenPublishInput): Promise<Record<string, unknown>> {
  requireDesktopRuntime();
  return invoke<Record<string, unknown>>("publish_mowen_note", { request });
}

function requireDesktopRuntime() {
  if (!isDesktopPublishingAvailable()) throw new Error("请在 Nibva 桌面应用中使用直接发布功能。");
}
