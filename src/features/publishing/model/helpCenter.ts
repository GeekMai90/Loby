/**
 * [INPUT]: 依赖 shared 项目契约、文稿稳定 ID、写作库图片解析与帮助中心 native API 契约
 * [OUTPUT]: 对外提供帮助中心绑定归一化、配置校验、单篇/整项目同步 payload 与发布记录回写能力
 * [POS]: publishing model 的帮助中心纯转换边界；自动映射分组但不执行网络请求，单篇与整项目共享同一打包规则
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { parseImageReferences, renderObsidianImagesAsMarkdown, resolveSheetImageSourcePath } from "@/features/library/model/imageAssets";
import { DEFAULT_USER_GROUP_ID, getVisibleProjectGroups } from "@/features/library/model/projectModel";
import { sheetPublicId } from "@/features/library/model/documentId";
import type {
  HelpCenterBinding,
  HelpCenterGroupMapping,
  ProjectGroup,
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

export const HELP_CENTER_PUBLICATION_ID = "help-center";

export const DEFAULT_HELP_CENTER_BINDING: HelpCenterBinding = {
  repository: "",
  branch: "main",
  contentRoot: "src/content/docs",
  manifestPath: "src/data/loby-docs.json",
  assetsRoot: "public/images/docs",
  siteUrl: "",
  groupMappings: [],
};

export function normalizeHelpCenterBinding(project: WritingProject): HelpCenterBinding | undefined {
  const source = project.helpCenterBinding;
  if (!source) return undefined;
  const occupied = new Set<string>();
  const previous = new Map((source.groupMappings ?? []).map((mapping) => [mapping.groupId, mapping]));
  const groupMappings = getVisibleProjectGroups(project).map((group) => {
    if (group.id === DEFAULT_USER_GROUP_ID) return { groupId: group.id, directory: "", enabled: false };
    const existing = previous.get(group.id);
    const preferred = existing?.directory.trim() || groupDirectory(group);
    const directory = uniqueDirectory(preferred, occupied);
    occupied.add(directory);
    return { groupId: group.id, directory, enabled: existing?.enabled ?? true };
  });
  return {
    repository: (source.repository ?? "").trim(),
    branch: (source.branch ?? "").trim() || "main",
    contentRoot: normalizeRepositoryPath(source.contentRoot ?? "", DEFAULT_HELP_CENTER_BINDING.contentRoot),
    manifestPath: normalizeRepositoryPath(source.manifestPath ?? "", DEFAULT_HELP_CENTER_BINDING.manifestPath),
    assetsRoot: normalizeRepositoryPath(source.assetsRoot ?? "", DEFAULT_HELP_CENTER_BINDING.assetsRoot),
    siteUrl: (source.siteUrl ?? "").trim().replace(/\/+$/, ""),
    groupMappings,
  };
}

export function createHelpCenterBinding(project: WritingProject): HelpCenterBinding {
  return normalizeHelpCenterBinding({ ...project, helpCenterBinding: DEFAULT_HELP_CENTER_BINDING }) ?? DEFAULT_HELP_CENTER_BINDING;
}

export function validateHelpCenterBinding(binding: HelpCenterBinding): string {
  if (!/^[^/\s]+\/[^/\s]+$/.test(binding.repository.trim())) return "GitHub 仓库应使用 owner/repository 格式。";
  if (!binding.branch.trim()) return "GitHub 分支不能为空。";
  if (!/^https?:\/\//i.test(binding.siteUrl.trim())) return "帮助中心地址应以 http:// 或 https:// 开头。";
  const enabled = binding.groupMappings.filter((mapping) => mapping.enabled);
  if (enabled.some((mapping) => !isSafeRepositoryPath(mapping.directory))) return "同步分组的 GitHub 文件夹不能为空或包含不安全路径。";
  if (new Set(enabled.map((mapping) => mapping.directory)).size !== enabled.length) return "同步分组不能使用相同的 GitHub 文件夹。";
  return "";
}

export function prepareHelpCenterSyncInput(
  libraryPath: string,
  project: WritingProject,
  sheetId?: string,
  deleteMissing = false,
): HelpCenterSyncInput {
  const binding = normalizeHelpCenterBinding(project);
  if (!binding) throw new Error("当前项目尚未绑定帮助中心仓库。");
  const validationError = validateHelpCenterBinding(binding);
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
      if (sheetId) throw new Error("这篇文稿所在分组未启用帮助中心同步。");
      return [];
    }
    return [prepareDocument(libraryPath, project, sheet, mapping)];
  });
  if (documents.length === 0) throw new Error(sheetId ? "这篇文稿不能同步。" : "当前项目没有可同步的文稿。");
  return {
    repository: binding.repository,
    branch: binding.branch,
    contentRoot: binding.contentRoot,
    manifestPath: binding.manifestPath,
    assetsRoot: binding.assetsRoot,
    siteUrl: binding.siteUrl,
    libraryPath,
    projectId: project.id,
    projectTitle: project.title,
    mode: sheetId ? "document" : "project",
    deleteMissing: !sheetId && deleteMissing,
    groups,
    documents,
  };
}

export function helpCenterPublicationsFromResult(result: HelpCenterSyncResult): Map<string, PublishingTargetPublication> {
  return new Map(result.documents.map((document) => [document.sourceId, publicationFromDocument(result, document)]));
}

function prepareDocument(
  libraryPath: string,
  project: WritingProject,
  sheet: WritingSheet,
  mapping: HelpCenterGroupMapping,
): HelpCenterSyncInput["documents"][number] {
  let body = renderObsidianImagesAsMarkdown(sheet.body);
  const images: PublishImageInput[] = [];
  for (const reference of parseImageReferences(body)) {
    if (/^(?:https?:|data:|\/)/i.test(reference.path)) continue;
    const source = resolveSheetImageSourcePath(libraryPath, project, sheet, reference.path);
    if (!source) throw new Error(`找不到本地图片：${reference.path}`);
    const placeholder = `@@LOBY_DOCS_IMAGE:${images.length}@@`;
    body = body.replace(reference.raw, reference.raw.replace(reference.path, placeholder));
    images.push({ source, alt: reference.alt || `图片 ${images.length + 1}`, placeholder });
  }
  const previous = sheet.publications?.[HELP_CENTER_PUBLICATION_ID];
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

function publicationFromDocument(result: HelpCenterSyncResult, document: HelpCenterSyncDocumentResult): PublishingTargetPublication {
  return {
    targetKind: "githubDocsSite",
    sourceId: document.sourceId,
    slug: document.slug,
    url: document.url,
    lastCommitSha: result.commitSha,
    lastPublishedAt: new Date().toISOString(),
    sourceHash: document.sourceHash,
    draft: false,
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

function normalizeRepositoryPath(value: string, fallback: string): string {
  const normalized = value.trim().replace(/^\/+|\/+$/g, "");
  return isSafeRepositoryPath(normalized) ? normalized : fallback;
}

function isSafeRepositoryPath(value: string): boolean {
  return (
    Boolean(value) &&
    !value.startsWith("/") &&
    !value.endsWith("/") &&
    value.split("/").every((segment) => segment && segment !== "." && segment !== ".." && !segment.startsWith("."))
  );
}
