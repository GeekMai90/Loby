/**
 * [INPUT]: 依赖项目发布绑定、GitHub 文档站目标、文稿稳定 ID、写作库图片解析/路径契约与帮助中心 native API 契约
 * [OUTPUT]: 对外提供同名中文目录优先且可恢复已保存值的文档站分组映射、绑定校验、发布输入指纹状态、单篇/项目增量同步 payload 与发布记录回写能力
 * [POS]: publishing model 的 GitHub 文档站纯转换边界；目标参数归应用 registry，项目只持有 target ID 与分组投影
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import {
  parseImageReferences,
  relativeLocalPath,
  renderObsidianImagesAsMarkdown,
  resolveSheetImageSourcePath,
} from "@/features/library/model/imageAssets";
import { isAbsoluteLocalPath } from "@/features/library/model/libraryRegistry";
import { DEFAULT_USER_GROUP_ID, getVisibleProjectGroups } from "@/features/library/model/projectModel";
import { sheetPublicId } from "@/features/library/model/documentId";
import type {
  ProjectGroup,
  ProjectPublishingBinding,
  PublishingGroupMapping,
  PublishingTargetPublication,
  WritingProject,
  WritingSheet,
} from "@/shared/types";
import type {
  HelpCenterSyncDocumentResult,
  HelpCenterSyncInput,
  HelpCenterSyncResult,
  PublishImageInput,
} from "@/features/publishing/model/api";
import type { GitHubDocsPublishingTarget } from "@/features/publishing/model/publishingTargets";
import { isPublishingTargetReady } from "@/features/publishing/model/publishingTargets";

export function createProjectPublishingBinding(project: WritingProject, target: GitHubDocsPublishingTarget): ProjectPublishingBinding {
  return normalizeProjectPublishingBinding(project, target, { targetId: target.id, groupMappings: [] });
}

export function resolveProjectPublishingBinding(
  project: WritingProject,
  target: GitHubDocsPublishingTarget,
  draft?: ProjectPublishingBinding,
): ProjectPublishingBinding {
  const source =
    draft?.targetId === target.id
      ? draft
      : project.publishingBinding?.targetId === target.id
        ? project.publishingBinding
        : { targetId: target.id, groupMappings: [] };
  return normalizeProjectPublishingBinding(project, target, source);
}

export function normalizeProjectPublishingBinding(
  project: WritingProject,
  target: GitHubDocsPublishingTarget,
  source = project.publishingBinding,
): ProjectPublishingBinding {
  const occupied = new Set<string>();
  const previous = new Map((source?.groupMappings ?? []).map((mapping) => [mapping.groupId, mapping]));
  const groupMappings = getVisibleProjectGroups(project).map((group) => {
    if (group.id === DEFAULT_USER_GROUP_ID) return { groupId: group.id, directory: "", enabled: false };
    const existing = previous.get(group.id);
    const preferred = existing?.directory.trim() || groupDirectory(group);
    const directory = uniqueDirectory(preferred, occupied);
    occupied.add(directory);
    return { groupId: group.id, directory, enabled: existing?.enabled ?? true };
  });
  return { targetId: target.id, groupMappings };
}

export function validateProjectDocsBinding(binding: ProjectPublishingBinding, target: GitHubDocsPublishingTarget): string {
  if (binding.targetId !== target.id) return "项目绑定的发布目标已经变化，请重新选择。";
  if (!isPublishingTargetReady(target)) return "当前 GitHub 文档站目标尚未完成配置或已经停用。";
  const enabled = binding.groupMappings.filter((mapping) => mapping.enabled);
  if (enabled.some((mapping) => !isSafeRepositoryPath(mapping.directory))) return "同步分组的 GitHub 文件夹不能为空或包含不安全路径。";
  if (new Set(enabled.map((mapping) => mapping.directory)).size !== enabled.length) return "同步分组不能使用相同的 GitHub 文件夹。";
  return "";
}

export interface HelpCenterSyncPreparationOptions {
  sheetId?: string;
  deleteMissing?: boolean;
}

export type HelpCenterDocumentSyncState = "unpublished" | "current" | "modified";

export function helpCenterDocumentSyncState(
  libraryPath: string,
  project: WritingProject,
  sheet: WritingSheet,
  target: GitHubDocsPublishingTarget,
): HelpCenterDocumentSyncState {
  const publication = sheet.publications?.[target.id];
  if (publication?.targetKind !== target.kind) return "unpublished";
  const currentRevision = helpCenterSheetRevision(libraryPath, project, sheet, target);
  if (publication.sourceRevision) return publication.sourceRevision === currentRevision ? "current" : "modified";
  const editedAt = Date.parse(sheet.updatedAt);
  const publishedAt = Date.parse(publication.lastPublishedAt);
  return Number.isFinite(editedAt) && Number.isFinite(publishedAt) && editedAt <= publishedAt ? "current" : "modified";
}

export function prepareHelpCenterSyncInput(
  libraryPath: string,
  project: WritingProject,
  target: GitHubDocsPublishingTarget,
  options: HelpCenterSyncPreparationOptions = {},
): HelpCenterSyncInput {
  const { sheetId, deleteMissing = false } = options;
  if (!project.publishingBinding) throw new Error("当前项目尚未绑定 GitHub 文档站发布目标。");
  const binding = normalizeProjectPublishingBinding(project, target);
  const validationError = validateProjectDocsBinding(binding, target);
  if (validationError) throw new Error(validationError);
  const mappings = new Map(binding.groupMappings.map((mapping) => [mapping.groupId, mapping]));
  const groups = getVisibleProjectGroups(project).map((group, order) => {
    const mapping = mappings.get(group.id) ?? { groupId: group.id, directory: "", enabled: false };
    return { id: group.id, label: group.title, directory: mapping.directory, order, enabled: mapping.enabled };
  });
  const candidates = project.sheets.filter((sheet) => !sheet.archivedAt && (!sheetId || sheet.id === sheetId));
  if (sheetId && candidates.length === 0) throw new Error("找不到要同步的文稿，或文稿已归档。");
  const documents = candidates.flatMap((sheet) => {
    const mapping = mappings.get(sheet.groupId || DEFAULT_USER_GROUP_ID);
    if (!mapping?.enabled) {
      if (sheetId) throw new Error("这篇文稿所在分组未启用文档站同步。");
      return [];
    }
    return [prepareDocument(libraryPath, project, sheet, mapping, target.id)];
  });
  if (documents.length === 0) {
    if (sheetId) throw new Error("这篇文稿不能同步。");
    if (!deleteMissing) throw new Error("当前项目没有可发布的文稿；如需删除远端遗留内容，请开启“清理远端多余文稿”。");
  }
  return {
    repository: target.repository,
    branch: target.branch,
    contentRoot: target.contentRoot,
    manifestPath: target.manifestPath,
    assetsRoot: target.assetsRoot,
    siteUrl: target.siteUrl,
    libraryPath,
    projectId: project.id,
    projectTitle: project.title,
    mode: sheetId ? "document" : "project",
    deleteMissing: !sheetId && deleteMissing,
    groups,
    documents,
  };
}

export function applyHelpCenterSyncResult(
  libraryPath: string,
  project: WritingProject,
  target: GitHubDocsPublishingTarget,
  result: HelpCenterSyncResult,
): WritingProject {
  const sheetsById = new Map(project.sheets.map((sheet) => [sheet.id, sheet]));
  const publications = new Map(result.documents.map((document) => [document.sourceId, publicationFromDocument(result, document)]));
  const deletedSourceIds = new Set(result.deletedSourceIds);
  return {
    ...project,
    sheets: project.sheets.map((sheet) => {
      const publication = publications.get(sheet.id);
      if (publication) return { ...sheet, publications: { ...sheet.publications, [target.id]: publication } };
      if (!deletedSourceIds.has(sheet.id) || !sheet.publications?.[target.id]) return sheet;
      const nextPublications = { ...sheet.publications };
      delete nextPublications[target.id];
      return { ...sheet, publications: Object.keys(nextPublications).length > 0 ? nextPublications : undefined };
    }),
  };

  function publicationFromDocument(syncResult: HelpCenterSyncResult, document: HelpCenterSyncDocumentResult): PublishingTargetPublication {
    return {
      targetKind: "githubDocsSite",
      sourceId: document.sourceId,
      slug: document.slug,
      url: document.url,
      lastCommitSha: syncResult.commitSha,
      lastPublishedAt: new Date().toISOString(),
      sourceHash: document.sourceHash,
      sourceRevision: helpCenterSheetRevision(libraryPath, project, sheetsById.get(document.sourceId), target),
      draft: false,
    };
  }
}

function helpCenterSheetRevision(
  libraryPath: string,
  project: WritingProject,
  sheet: WritingSheet | undefined,
  target: GitHubDocsPublishingTarget,
): string {
  if (!sheet) return "";
  const binding = normalizeProjectPublishingBinding(project, target);
  const mapping = binding.groupMappings.find((candidate) => candidate.groupId === (sheet.groupId || DEFAULT_USER_GROUP_ID));
  if (!mapping?.enabled) return "";
  let document: HelpCenterSyncInput["documents"][number];
  try {
    document = prepareDocument(libraryPath, project, sheet, mapping, target.id);
  } catch {
    return "";
  }
  const relativeSource = (source: string) => {
    const relative = relativeLocalPath(libraryPath, source);
    return isAbsoluteLocalPath(relative) || relative.startsWith("../") ? source : relative;
  };
  const semantic = JSON.stringify({
    sourceId: document.sourceId,
    title: document.title,
    description: document.description,
    body: document.body,
    slug: document.slug,
    groupId: document.groupId,
    groupDirectory: document.groupDirectory,
    images: document.images.map((image) => ({ source: relativeSource(image.source), alt: image.alt, placeholder: image.placeholder })),
  });
  let hash = 0x811c9dc5;
  for (let index = 0; index < semantic.length; index += 1) {
    hash ^= semantic.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function prepareDocument(
  libraryPath: string,
  project: WritingProject,
  sheet: WritingSheet,
  mapping: PublishingGroupMapping,
  targetId: string,
): HelpCenterSyncInput["documents"][number] {
  let body = renderObsidianImagesAsMarkdown(sheet.body);
  const images: PublishImageInput[] = [];
  for (const reference of parseImageReferences(body)) {
    if (/^(?:https?:|data:)/i.test(reference.path) || isAbsoluteLocalPath(reference.path)) continue;
    const source = resolveSheetImageSourcePath(libraryPath, project, sheet, reference.path);
    if (!source) throw new Error(`找不到本地图片：${reference.path}`);
    const placeholder = `@@LOBY_DOCS_IMAGE:${images.length}@@`;
    body = body.replace(reference.raw, reference.raw.replace(reference.path, placeholder));
    images.push({ source, alt: reference.alt || `图片 ${images.length + 1}`, placeholder });
  }
  const previous = sheet.publications?.[targetId];
  const slug = previous?.targetKind === "githubDocsSite" && previous.slug ? previous.slug : sheetPublicId(sheet.id);
  if (!slug) throw new Error(`「${sheet.title}」仍使用旧文稿 ID，请先在设置中重建索引。`);
  return {
    sourceId: sheet.id,
    title: sheet.title.trim() || "无标题",
    description: sheet.description.trim(),
    body,
    slug,
    groupId: sheet.groupId || DEFAULT_USER_GROUP_ID,
    groupDirectory: mapping.directory,
    images,
  };
}

function groupDirectory(group: ProjectGroup): string {
  const fromTitle = repositorySegment(group.title);
  if (fromTitle) return fromTitle;
  return repositorySegment(group.id) || "group";
}

function repositorySegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\\/:*?"<>|#%{}]+/g, "-")
    .replace(/\[|\]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 80);
}

function uniqueDirectory(preferred: string, occupied: Set<string>): string {
  const base = repositorySegment(preferred) || "group";
  if (!occupied.has(base)) return base;
  let suffix = 2;
  while (occupied.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function isSafeRepositoryPath(value: string): boolean {
  return (
    Boolean(value) &&
    !value.startsWith("/") &&
    !value.endsWith("/") &&
    value.split("/").every((segment) => segment && segment !== "." && segment !== ".." && !segment.startsWith("."))
  );
}
