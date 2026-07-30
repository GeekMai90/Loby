/**
 * [INPUT]: 依赖 shared 文稿契约、目标项目属性定义、Markdown 扫描 DTO、统一图片引用改写与日期工具
 * [OUTPUT]: 对外提供导入标题推导、元信息预览和显式丢弃外部 status/draft 的 buildMarkdownImportResult
 * [POS]: 写作库导入的文稿模型边界，把原生扫描事实转换为目标项目中的标准文稿与一级分组，不执行文件系统读写
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { MetadataValue, ProjectGroup, WritingProject, WritingSheet } from "@/shared/types";
import { nowTimestamp } from "@/shared/lib/dates";
import { createSheetId } from "@/features/library/model/documentId";
import { createSheetWithProjectDefaults } from "@/features/editor/model/documentProperties";
import { DEFAULT_USER_GROUP_ID, getVisibleProjectGroups, INBOX_GROUP_ID, isInboxProject } from "@/features/library/model/projectModel";
import { DEFAULT_PROJECT_ICON, DEFAULT_PROJECT_ICON_COLOR } from "@/features/library/constants/projectAppearance";
import type { MarkdownImportDocument, MarkdownImportImageTransfer, MarkdownImportScan } from "@/features/library/model/persistence";
import { rewriteImportedImageReferences } from "@/features/library/model/imageAssets";

const SYSTEM_METADATA_KEYS = new Set([
  "title",
  "tags",
  "targetWords",
  "summary",
  "description",
  "created",
  "createdAt",
  "updated",
  "updatedAt",
  "modified",
  "status",
  "draft",
  "date",
  "publishedAt",
  "publishDate",
]);
const PUBLISH_DATE_ALIASES = new Set(["date", "publishedAt", "publishDate", "发布日期"]);

export interface MarkdownImportMetadataSummary {
  preservedKeys: string[];
  droppedKeys: string[];
}

export interface MarkdownImportBuildResult extends MarkdownImportMetadataSummary {
  project: WritingProject;
  importedSheets: WritingSheet[];
  createdGroups: ProjectGroup[];
  skippedDuplicateCount: number;
}

interface MappedDocumentMetadata {
  title: string;
  tags?: string[];
  targetWords?: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
  properties: Record<string, MetadataValue>;
  preservedKeys: string[];
  droppedKeys: string[];
}

export function deriveImportedSheetTitle(filename: string, body: string): string {
  const heading = body
    .match(/^#\s+(.+)$/m)?.[1]
    ?.replace(/\s+#+$/, "")
    .trim();
  if (heading) return heading;
  const basename = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return basename || "导入稿件";
}

export function summarizeMarkdownImportMetadata(scan: MarkdownImportScan, project: WritingProject): MarkdownImportMetadataSummary {
  const preserved = new Set<string>();
  const dropped = new Set<string>();
  for (const document of scan.documents) {
    const mapped = mapDocumentMetadata(document, project);
    mapped.preservedKeys.forEach((key) => preserved.add(key));
    mapped.droppedKeys.forEach((key) => dropped.add(key));
  }
  return {
    preservedKeys: Array.from(preserved).sort(),
    droppedKeys: Array.from(dropped).sort(),
  };
}

export function buildMarkdownImportResult(
  scan: MarkdownImportScan,
  targetProject: WritingProject,
  libraryPath: string,
  transfers: MarkdownImportImageTransfer[],
): MarkdownImportBuildResult {
  const now = nowTimestamp();
  const { project, groupByRelativeFolder, createdGroups } = ensureImportGroups(targetProject, scan.documents);
  const destinationBySource = new Map(transfers.map((transfer) => [normalizePath(transfer.sourcePath), transfer.destinationPath]));
  const existingBodies = new Set(project.sheets.map((sheet) => normalizedDocumentBody(sheet.body)));
  const usedTitles = new Set(project.sheets.map((sheet) => sheet.title));
  const importedSheets: WritingSheet[] = [];
  const preserved = new Set<string>();
  const dropped = new Set<string>();
  let skippedDuplicateCount = 0;

  for (const document of scan.documents) {
    const mapped = mapDocumentMetadata(document, project);
    mapped.preservedKeys.forEach((key) => preserved.add(key));
    mapped.droppedKeys.forEach((key) => dropped.add(key));
    const baseTitle = mapped.title;
    const groupId = resolveDocumentGroupId(project, document.relativePath, groupByRelativeFolder);
    const provisional = createSheetWithProjectDefaults(project, {
      id: createSheetId(),
      title: baseTitle,
      groupId,
      tags: mapped.tags,
      targetWords: mapped.targetWords,
      description: mapped.description,
      body: document.body.trimStart() || `# ${baseTitle}\n\n`,
      createdAt: mapped.createdAt,
      updatedAt: mapped.updatedAt,
      properties: mapped.properties,
    });
    const resolutions = document.imageReferences.flatMap((reference) => {
      const destinationPath = destinationBySource.get(normalizePath(reference.sourcePath));
      return reference.status === "resolved" && destinationPath
        ? [{ target: reference.target, sourcePath: reference.sourcePath, destinationPath }]
        : [];
    });
    const body = rewriteImportedImageReferences(provisional.body, resolutions, libraryPath, project, provisional);
    if (existingBodies.has(normalizedDocumentBody(body))) {
      skippedDuplicateCount += 1;
      continue;
    }
    const title = uniqueImportedTitle(baseTitle, usedTitles);
    usedTitles.add(title);
    existingBodies.add(normalizedDocumentBody(body));
    importedSheets.push({ ...provisional, title, body });
  }

  return {
    project: {
      ...project,
      sheets: [...project.sheets, ...importedSheets],
      updatedAt: importedSheets.length > 0 ? now : project.updatedAt,
    },
    importedSheets,
    createdGroups,
    skippedDuplicateCount,
    preservedKeys: Array.from(preserved).sort(),
    droppedKeys: Array.from(dropped).sort(),
  };
}

function mapDocumentMetadata(document: MarkdownImportDocument, project: WritingProject): MappedDocumentMetadata {
  const metadata = isPlainRecord(document.metadata) ? document.metadata : {};
  const preserved = new Set<string>();
  const dropped = new Set<string>();
  const mark = (key: string, wasPreserved: boolean) => (wasPreserved ? preserved : dropped).add(key);
  const titleValue = readString(metadata.title);
  if ("title" in metadata) mark("title", Boolean(titleValue));
  const tags = readStringArray(metadata.tags);
  if ("tags" in metadata) mark("tags", tags !== undefined);
  const targetWords = readFiniteNumber(metadata.targetWords);
  if ("targetWords" in metadata) mark("targetWords", targetWords !== undefined);
  const description = readString(metadata.description) ?? readString(metadata.summary);
  if ("summary" in metadata) mark("summary", Boolean(readString(metadata.summary)));
  if ("description" in metadata) mark("description", Boolean(readString(metadata.description)));
  const createdSource = firstDefined(metadata.createdAt, metadata.created);
  const updatedSource = firstDefined(metadata.updatedAt, metadata.updated, metadata.modified);
  const createdAt =
    normalizeTimestamp(createdSource) ??
    formatFileTimestamp(document.createdTimeMs) ??
    formatFileTimestamp(document.modifiedTimeMs) ??
    nowTimestamp();
  const updatedAt = normalizeTimestamp(updatedSource) ?? formatFileTimestamp(document.modifiedTimeMs) ?? createdAt;
  if ("createdAt" in metadata) mark("createdAt", Boolean(normalizeTimestamp(metadata.createdAt)));
  if ("created" in metadata) mark("created", Boolean(normalizeTimestamp(metadata.created)));
  if ("updatedAt" in metadata) mark("updatedAt", Boolean(normalizeTimestamp(metadata.updatedAt)));
  if ("updated" in metadata) mark("updated", Boolean(normalizeTimestamp(metadata.updated)));
  if ("modified" in metadata) mark("modified", Boolean(normalizeTimestamp(metadata.modified)));

  if ("status" in metadata) mark("status", false);
  if ("draft" in metadata) mark("draft", false);

  const properties: Record<string, MetadataValue> = {};
  const customDefinitions = project.documentPropertyDefinitions ?? [];
  for (const [key, value] of Object.entries(metadata)) {
    if (SYSTEM_METADATA_KEYS.has(key)) continue;
    const definition = customDefinitions.find((candidate) => candidate.key === key || candidate.label === key);
    const normalized = definition ? normalizePropertyValue(value, definition.type) : undefined;
    if (definition && normalized !== undefined) {
      properties[definition.key] = normalized;
      preserved.add(key);
    } else {
      dropped.add(key);
    }
  }

  for (const key of PUBLISH_DATE_ALIASES) {
    if (!(key in metadata)) continue;
    const definition = customDefinitions.find(
      (candidate) => candidate.type === "date" && (PUBLISH_DATE_ALIASES.has(candidate.key) || PUBLISH_DATE_ALIASES.has(candidate.label)),
    );
    const normalized = definition ? normalizePropertyValue(metadata[key], "date") : undefined;
    if (definition && normalized !== undefined) {
      properties[definition.key] = normalized;
      preserved.add(key);
      dropped.delete(key);
    } else {
      dropped.add(key);
    }
  }

  return {
    title: titleValue || deriveImportedSheetTitle(document.name, document.body),
    tags,
    targetWords,
    description,
    createdAt,
    updatedAt,
    properties,
    preservedKeys: Array.from(preserved),
    droppedKeys: Array.from(dropped),
  };
}

function ensureImportGroups(
  project: WritingProject,
  documents: MarkdownImportDocument[],
): { project: WritingProject; groupByRelativeFolder: Map<string, string>; createdGroups: ProjectGroup[] } {
  const groupByRelativeFolder = new Map<string, string>();
  if (isInboxProject(project)) return { project, groupByRelativeFolder, createdGroups: [] };
  const existingByTitle = new Map(getVisibleProjectGroups(project).map((group) => [group.title, group]));
  const usedIds = new Set((project.groups ?? []).map((group) => group.id));
  const createdGroups: ProjectGroup[] = [];
  const folderTitles = Array.from(new Set(documents.map((document) => relativeFolderTitle(document.relativePath)).filter(Boolean))).sort();
  for (const title of folderTitles) {
    const existing = existingByTitle.get(title);
    if (existing) {
      groupByRelativeFolder.set(title, existing.id);
      continue;
    }
    const id = uniqueImportGroupId(title, usedIds);
    usedIds.add(id);
    const group: ProjectGroup = {
      id,
      title,
      icon: DEFAULT_PROJECT_ICON,
      iconColor: DEFAULT_PROJECT_ICON_COLOR,
      description: "",
    };
    createdGroups.push(group);
    groupByRelativeFolder.set(title, id);
  }
  return {
    project: createdGroups.length > 0 ? { ...project, groups: [...(project.groups ?? []), ...createdGroups] } : project,
    groupByRelativeFolder,
    createdGroups,
  };
}

function resolveDocumentGroupId(project: WritingProject, relativePath: string, groupByRelativeFolder: Map<string, string>): string {
  if (isInboxProject(project)) return INBOX_GROUP_ID;
  const folder = relativeFolderTitle(relativePath);
  if (folder) return groupByRelativeFolder.get(folder) ?? DEFAULT_USER_GROUP_ID;
  return (
    getVisibleProjectGroups(project).find((group) => group.id === DEFAULT_USER_GROUP_ID)?.id ??
    getVisibleProjectGroups(project)[0]?.id ??
    DEFAULT_USER_GROUP_ID
  );
}

function relativeFolderTitle(relativePath: string): string {
  const parts = normalizePath(relativePath).split("/").filter(Boolean);
  return parts.length > 1 ? parts.slice(0, -1).join(" / ") : "";
}

function uniqueImportGroupId(title: string, usedIds: Set<string>): string {
  const base = `group-import-${
    title
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
      .replace(/^-+|-+$/g, "") || "folder"
  }`;
  let candidate = base;
  let index = 2;
  while (usedIds.has(candidate)) candidate = `${base}-${index++}`;
  return candidate;
}

function uniqueImportedTitle(title: string, usedTitles: Set<string>): string {
  if (!usedTitles.has(title)) return title;
  let index = 2;
  while (usedTitles.has(`${title} ${index}`)) index += 1;
  return `${title} ${index}`;
}

function normalizePropertyValue(value: unknown, type: string): MetadataValue | undefined {
  if (type === "checkbox") return typeof value === "boolean" ? value : undefined;
  if (type === "number") return readFiniteNumber(value);
  if (type === "tags" || type === "multiSelect") return readStringArray(value);
  if (type === "date") {
    const text = readString(value);
    const date = text?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    return date || undefined;
  }
  return readString(value);
}

function normalizeTimestamp(value: unknown): string | undefined {
  const text = readString(value);
  if (!text) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text} 00:00:00`;
  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime())) return undefined;
  return formatDateTime(parsed);
}

function formatFileTimestamp(value: number | undefined): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return formatDateTime(new Date(value));
}

function formatDateTime(value: Date): string {
  const part = (number: number) => String(number).padStart(2, "0");
  return `${value.getFullYear()}-${part(value.getMonth() + 1)}-${part(value.getDate())} ${part(value.getHours())}:${part(value.getMinutes())}:${part(value.getSeconds())}`;
}

function normalizedDocumentBody(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,，]/) : undefined;
  if (!values) return undefined;
  return Array.from(
    new Set(
      values
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}
