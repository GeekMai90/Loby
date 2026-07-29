/**
 * [INPUT]: 依赖 Tauri API、发布模块
 * [OUTPUT]: 对外提供含用户已保存 Secret 回填值的图床设置契约、保存接口与图片上传接口
 * [POS]: publishing feature 的阿里云 OSS renderer 边界；回填值只供设置表单内存态使用，不负责持久化
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { invoke } from "@tauri-apps/api/core";
import { isDesktopPublishingAvailable } from "@/features/publishing/model/api";

export interface WechatImageHostSettings {
  region: string;
  bucket: string;
  accessKeyId: string;
  customDomain: string;
  objectPrefix: string;
}

export interface WechatImageHostSettingsResult {
  settings: WechatImageHostSettings;
  accessKeySecret: string | null;
  hasAccessKeySecret: boolean;
  configured: boolean;
}

export interface WechatImageUploadInput {
  source: string;
}

export interface WechatImageUploadResult {
  source: string;
  url: string;
}

export const DEFAULT_WECHAT_IMAGE_HOST_SETTINGS: WechatImageHostSettings = {
  region: "",
  bucket: "",
  accessKeyId: "",
  customDomain: "",
  objectPrefix: "wechat",
};

export async function loadWechatImageHostSettings(): Promise<WechatImageHostSettingsResult> {
  requireDesktopRuntime();
  return invoke<WechatImageHostSettingsResult>("load_wechat_image_host_settings");
}

export async function saveWechatImageHostSettings(
  settings: WechatImageHostSettings,
  accessKeySecret?: string,
): Promise<WechatImageHostSettingsResult> {
  requireDesktopRuntime();
  return invoke<WechatImageHostSettingsResult>("save_wechat_image_host_settings", {
    request: {
      settings,
      accessKeySecret: accessKeySecret?.trim() || null,
    },
  });
}

export async function uploadWechatImages(images: WechatImageUploadInput[]): Promise<WechatImageUploadResult[]> {
  requireDesktopRuntime();
  return invoke<WechatImageUploadResult[]>("upload_wechat_images", { request: { images } });
}

function requireDesktopRuntime() {
  if (!isDesktopPublishingAvailable()) throw new Error("请在落笔桌面应用中使用图床功能。");
}
