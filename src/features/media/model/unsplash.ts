/**
 * [INPUT]: 依赖 Tauri invoke 与 shared ProjectResourceFile 契约
 * [OUTPUT]: 对外提供 Unsplash 搜索与横版随机图片结果、图片裁剪输入、Key 状态/保存/验证/删除与本地图片保存的 renderer 适配
 * [POS]: media feature 的外部服务边界；不把 API Key 返回 renderer，搜索和最终图片下载均由 native command 执行
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { invoke } from "@tauri-apps/api/core";
import type { ProjectResourceFile } from "@/shared/types";

export interface UnsplashSettings {
  configured: boolean;
}

export interface UnsplashPhoto {
  id: string;
  width: number;
  height: number;
  altDescription: string;
  description: string;
  user: {
    name: string;
    username: string;
  };
  urls: {
    thumb: string;
    small: string;
    regular: string;
    raw: string;
  };
  links: {
    downloadLocation: string;
    html: string;
  };
}

export interface UnsplashSearchResult {
  total: number;
  totalPages: number;
  results: UnsplashPhoto[];
}

export const UNSPLASH_RANDOM_BATCH_SIZE = 24;

export interface UnsplashCrop {
  x: number;
  y: number;
  width: number;
  height: number;
  aspectWidth: number;
  aspectHeight: number;
}

export interface SaveUnsplashImageInput {
  path: string;
  projectId: string;
  projectTitle: string;
  photoId: string;
  imageUrl: string;
  downloadLocation: string;
  crop: UnsplashCrop;
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getUnsplashSettings(): Promise<UnsplashSettings> {
  if (!isTauriRuntime()) return { configured: false };
  return invoke<UnsplashSettings>("get_unsplash_settings");
}

export async function saveUnsplashApiKey(apiKey: string): Promise<UnsplashSettings> {
  if (!isTauriRuntime()) throw new Error("浏览器开发模式不能保存 Unsplash API Key。");
  return invoke<UnsplashSettings>("save_unsplash_api_key", { apiKey });
}

export async function deleteUnsplashApiKey(): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("delete_unsplash_api_key");
}

export async function validateUnsplashApiKey(): Promise<void> {
  if (!isTauriRuntime()) throw new Error("浏览器开发模式不能验证 Unsplash API Key。");
  return invoke<void>("validate_unsplash_api_key");
}

export async function searchUnsplashPhotos(query: string, page = 1): Promise<UnsplashSearchResult> {
  if (!isTauriRuntime()) throw new Error("浏览器开发模式不能搜索 Unsplash 图片。");
  return invoke<UnsplashSearchResult>("search_unsplash_photos", { query, page });
}

export async function getRandomUnsplashPhotos(count = UNSPLASH_RANDOM_BATCH_SIZE): Promise<UnsplashPhoto[]> {
  if (!isTauriRuntime()) throw new Error("浏览器开发模式不能加载 Unsplash 随机图片。");
  return invoke<UnsplashPhoto[]>("get_random_unsplash_photos", { count });
}

export async function saveUnsplashImage(input: SaveUnsplashImageInput): Promise<ProjectResourceFile> {
  if (!isTauriRuntime()) throw new Error("浏览器开发模式不能保存 Unsplash 图片。");
  return invoke<ProjectResourceFile>("save_unsplash_image", { request: input });
}
