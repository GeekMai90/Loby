import { invoke } from "@tauri-apps/api/core";
import { isDesktopPublishingAvailable } from "./api";

export interface WechatImageHostSettings {
  region: string;
  bucket: string;
  accessKeyId: string;
  customDomain: string;
  objectPrefix: string;
}

export interface WechatImageHostSettingsResult {
  settings: WechatImageHostSettings;
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
  if (!isDesktopPublishingAvailable()) throw new Error("请在 Nibva 桌面应用中使用图床功能。");
}
