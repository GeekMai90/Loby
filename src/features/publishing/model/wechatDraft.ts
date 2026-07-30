/**
 * [INPUT]: 依赖写作库图片解析、公众号草稿 API 契约、主题渲染输入与 shared 写作模型
 * [OUTPUT]: 对外提供 WECHAT_OFFICIAL_ACCOUNT_TARGET_ID、prepareWechatDraftRenderInput、wechatDraftPublication
 * [POS]: publishing feature 的纯转换边界，把本地 Markdown 图片替换为微信上传占位符并恢复可更新的远端草稿身份
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { parseImageReferences, renderObsidianImagesAsMarkdown, resolveSheetImageSourcePath } from "@/features/library/model/imageAssets";
import type { PublishImageInput, WechatDraftPublishInput, WechatDraftPublishResult } from "@/features/publishing/model/api";
import type { WechatThemeManifest } from "@/features/publishing/model/wechatThemes";
import { nowTimestamp } from "@/shared/lib/dates";
import type { WechatDraftPublication, WritingProject, WritingSheet } from "@/shared/types";

export const WECHAT_OFFICIAL_ACCOUNT_TARGET_ID = "wechat-official-account";

export interface WechatDraftRenderInput {
  title: string;
  markdown: string;
  tags: string[];
  themeId: string;
  theme: WechatThemeManifest;
  requestBase: Omit<WechatDraftPublishInput, "html">;
}

export function prepareWechatDraftRenderInput(
  libraryPath: string,
  project: WritingProject,
  sheet: WritingSheet,
  appId: string,
  theme: WechatThemeManifest,
  tags: string[],
): WechatDraftRenderInput {
  let markdown = renderObsidianImagesAsMarkdown(sheet.body);
  const imagesBySource = new Map<string, PublishImageInput>();
  for (const reference of parseImageReferences(markdown)) {
    if (/^(?:https?:|data:|blob:|asset:|tauri:|\/assets\/|\/src\/assets\/)/i.test(reference.path)) continue;
    const source = resolveSheetImageSourcePath(libraryPath, project, sheet, reference.path);
    if (!source) throw new Error(`找不到本地图片：${reference.path}`);
    let image = imagesBySource.get(source);
    if (!image) {
      image = {
        source,
        alt: reference.alt || `图片 ${imagesBySource.size + 1}`,
        placeholder: `https://loby.invalid/wechat-image-${imagesBySource.size}`,
      };
      imagesBySource.set(source, image);
    }
    markdown = markdown.replace(reference.raw, reference.raw.replace(reference.path, image.placeholder));
  }
  const images = [...imagesBySource.values()];
  if (images.length === 0) {
    throw new Error("请先在正文中添加一张本地 PNG、JPG 或 GIF 图片作为公众号封面。");
  }
  const saved = sheet.publications?.[WECHAT_OFFICIAL_ACCOUNT_TARGET_ID];
  const previous = saved?.targetKind === "wechatOfficialAccount" && saved.appId === appId ? saved : undefined;
  return {
    title: sheet.title.trim() || project.title,
    markdown,
    tags,
    themeId: theme.id,
    theme,
    requestBase: {
      libraryPath,
      sourceId: previous?.sourceId || sheet.id,
      title: sheet.title.trim() || project.title,
      author: typeof sheet.properties.author === "string" ? sheet.properties.author.trim() : "",
      digest: sheet.description.trim(),
      images,
      coverSource: images[0]!.source,
      existingMediaId: previous?.mediaId || "",
    },
  };
}

export function wechatDraftPublication(sourceId: string, result: WechatDraftPublishResult): WechatDraftPublication {
  return {
    targetKind: "wechatOfficialAccount",
    sourceId,
    appId: result.appId,
    mediaId: result.mediaId,
    lastPublishedAt: nowTimestamp(),
    sourceHash: result.sourceHash,
    draft: true,
  };
}
