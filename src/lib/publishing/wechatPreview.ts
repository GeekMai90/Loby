import { convertFileSrc } from "@tauri-apps/api/core";
import { parseImageReferences, renderObsidianImagesAsMarkdown, resolveSheetImageSourcePath } from "../imageAssets";
import type { WritingProject, WritingSheet } from "../../types";
import { isDesktopPublishingAvailable } from "./api";

export function sheetWechatTags(project: WritingProject, sheet: WritingSheet): string[] {
  return [...new Set([...project.tags, ...sheetPropertyTags(sheet)])];
}

export function resolveWechatPreviewImages(markdown: string, libraryPath: string, project: WritingProject, sheet: WritingSheet) {
  return resolveWechatPreviewImagesWithOverrides(markdown, libraryPath, project, sheet);
}

export interface WechatLocalImage {
  source: string;
  referencePath: string;
  alt: string;
}

export function collectWechatLocalImages(
  markdown: string,
  libraryPath: string,
  project: WritingProject,
  sheet: WritingSheet,
): WechatLocalImage[] {
  const images = new Map<string, WechatLocalImage>();
  for (const reference of parseImageReferences(renderObsidianImagesAsMarkdown(markdown))) {
    if (isPreviewReadyImageSource(reference.path)) continue;
    const source = resolveSheetImageSourcePath(libraryPath, project, sheet, reference.path);
    if (!source || images.has(source)) continue;
    images.set(source, { source, referencePath: reference.path, alt: reference.alt });
  }
  return [...images.values()];
}

export function resolveWechatPreviewImagesWithOverrides(
  markdown: string,
  libraryPath: string,
  project: WritingProject,
  sheet: WritingSheet,
  uploadedUrls: Readonly<Record<string, string>> = {},
) {
  let resolved = renderObsidianImagesAsMarkdown(markdown);
  if (!isDesktopPublishingAvailable()) return resolved;
  for (const reference of parseImageReferences(resolved)) {
    if (isPreviewReadyImageSource(reference.path)) continue;
    const source = resolveSheetImageSourcePath(libraryPath, project, sheet, reference.path);
    if (!source) continue;
    const nextSource = uploadedUrls[source] || convertFileSrc(source);
    resolved = resolved.replace(reference.raw, reference.raw.replace(reference.path, nextSource));
  }
  return resolved;
}

function isPreviewReadyImageSource(source: string): boolean {
  return /^(?:https?:\/\/|data:|blob:|asset:|tauri:|\/assets\/|\/src\/assets\/)/i.test(source);
}

export function buildWechatPreviewDocument(
  html: string,
  background: string,
  options: { safeAreaTop?: number; safeAreaBottom?: number; colorScheme?: WechatPreviewColorScheme } = {},
): string {
  const safeAreaTop = Math.max(0, Math.round(options.safeAreaTop ?? 0));
  const safeAreaBottom = Math.max(0, Math.round(options.safeAreaBottom ?? 0));
  const colorScheme = options.colorScheme ?? "light";
  const darkPreviewCss =
    colorScheme === "dark"
      ? "html{background:#111;}body{filter:invert(1) hue-rotate(180deg);}img,video,canvas{filter:invert(1) hue-rotate(180deg);}"
      : "";
  return `<!doctype html><html lang="zh-CN" data-wechat-preview-color-scheme="${colorScheme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="${colorScheme}"><style>html{color-scheme:${colorScheme};}html,body{margin:0;min-width:0;background:${background};}body{padding:${safeAreaTop}px 0 ${safeAreaBottom}px;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;}*{box-sizing:border-box;}img{max-width:100%;}${darkPreviewCss}</style></head><body>${html}</body></html>`;
}

export type WechatPreviewColorScheme = "light" | "dark";

function sheetPropertyTags(sheet: WritingSheet): string[] {
  const value = sheet.properties?.tags ?? sheet.properties?.标签;
  if (typeof value === "string")
    return value
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  if (Array.isArray(value)) return value.filter((tag): tag is string => typeof tag === "string" && Boolean(tag.trim()));
  return [];
}
