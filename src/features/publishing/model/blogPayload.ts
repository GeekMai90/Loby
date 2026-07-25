/**
 * [INPUT]: 依赖应用级 GitHub 博客目标、shared 写作契约、写作库图片解析与日期工具
 * [OUTPUT]: 对外提供 createBlogSlug、prepareBlogPublishInput，只把文稿自身摘要映射为可选 Hugo description
 * [POS]: publishing model 的纯转换边界，不读取凭证、不执行网络请求，也不以项目描述冒充文章摘要
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { parseImageReferences, renderObsidianImagesAsMarkdown, resolveSheetImageSourcePath } from "@/features/library/model/imageAssets";
import type { BlogPublishInput, PublishImageInput } from "@/features/publishing/model/api";
import type { GitHubBlogPublishingTarget } from "@/features/publishing/model/publishingTargets";
import { today } from "@/shared/lib/dates";
import type { WritingProject, WritingSheet } from "@/shared/types";
import { sheetPublicId } from "@/features/library/model/documentId";

export function prepareBlogPublishInput(
  libraryPath: string,
  project: WritingProject,
  sheet: WritingSheet,
  target: GitHubBlogPublishingTarget,
  options: { slug: string; draft: boolean },
): BlogPublishInput {
  if (!target.enabled) throw new Error("当前 GitHub 发布目标尚未启用。");
  let body = renderObsidianImagesAsMarkdown(sheet.body);
  const images: PublishImageInput[] = [];
  for (const reference of parseImageReferences(body)) {
    if (/^(?:https?:|data:|\/)/i.test(reference.path)) continue;
    const source = resolveSheetImageSourcePath(libraryPath, project, sheet, reference.path);
    if (!source) throw new Error(`找不到本地图片：${reference.path}`);
    const placeholder = `@@LOBY_BLOG_IMAGE:${images.length}@@`;
    body = body.replace(reference.raw, reference.raw.replace(reference.path, placeholder));
    images.push({ source, alt: reference.alt || `图片 ${images.length + 1}`, placeholder });
  }
  return {
    repository: target.repository,
    branch: target.branch || "main",
    contentRoot: target.contentRoot || "content/posts",
    siteUrl: target.siteUrl,
    libraryPath,
    sourceId: sheet.publications?.[target.id]?.sourceId || sheet.id,
    title: sheet.title.trim() || project.title,
    body,
    summary: sheet.summary.trim(),
    date: publicationDate(sheet),
    tags: publicationTags(sheet),
    draft: options.draft,
    slug: options.slug.trim(),
    images,
  };
}

export function createBlogSlug(_title: string, sourceId: string): string {
  return sheetPublicId(sourceId) ?? "";
}

function publicationDate(sheet: WritingSheet): string {
  for (const value of [sheet.createdAt, sheet.updatedAt]) {
    const match = value?.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  return today();
}

function publicationTags(sheet: WritingSheet): string[] {
  return sheet.tags.map((tag) => tag.trim()).filter(Boolean);
}
