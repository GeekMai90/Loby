import { convertFileSrc } from "@tauri-apps/api/core";
import { parseImageReferences, renderObsidianImagesAsMarkdown, resolveSheetImageSourcePath } from "../imageAssets";
import type { WritingProject, WritingSheet } from "../../types";
import { isDesktopPublishingAvailable } from "./api";

export function sheetWechatTags(project: WritingProject, sheet: WritingSheet): string[] {
  return [...new Set([...project.tags, ...sheetPropertyTags(sheet)])];
}

export function resolveWechatPreviewImages(markdown: string, libraryPath: string, project: WritingProject, sheet: WritingSheet) {
  let resolved = renderObsidianImagesAsMarkdown(markdown);
  if (!isDesktopPublishingAvailable()) return resolved;
  for (const reference of parseImageReferences(resolved)) {
    if (isPreviewReadyImageSource(reference.path)) continue;
    const source = resolveSheetImageSourcePath(libraryPath, project, sheet, reference.path);
    if (!source) continue;
    resolved = resolved.replace(reference.raw, reference.raw.replace(reference.path, convertFileSrc(source)));
  }
  return resolved;
}

function isPreviewReadyImageSource(source: string): boolean {
  return /^(?:https?:\/\/|data:|blob:|asset:|tauri:|\/assets\/|\/src\/assets\/)/i.test(source);
}

export function buildWechatPreviewDocument(html: string, background: string): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;min-width:0;background:${background};}body{padding:0;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;}*{box-sizing:border-box;}img{max-width:100%;}</style></head><body>${html}</body></html>`;
}

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
