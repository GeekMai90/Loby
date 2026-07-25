/**
 * [INPUT]: 依赖 yaml、shared 公共契约、编辑器模块、写作库模块
 * [OUTPUT]: 对外提供 deriveImportedSheetTitle、buildImportedMarkdownSheets
 * [POS]: 写作库 feature 的领域模型边界，集中 写作库 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { parse as parseYaml } from "yaml";
import type { ImportedMarkdownFile, MetadataValue, ProjectStatus, WritingProject, WritingSheet } from "@/shared/types";
import { nowTimestamp } from "@/shared/lib/dates";
import { createSheetId } from "@/features/library/model/documentId";
import { createSheetWithProjectDefaults } from "@/features/editor/model/documentProperties";
import { DEFAULT_USER_GROUP_ID } from "@/features/library/model/projectModel";

const RESERVED_FRONTMATTER_KEYS = new Set([
  "loby",
  "lobySheet",
  "id",
  "title",
  "groupId",
  "type",
  "status",
  "tags",
  "targetWords",
  "summary",
  "createdAt",
  "updatedAt",
  "archivedAt",
]);
const PROJECT_STATUSES: ProjectStatus[] = ["构思", "初稿", "修改中", "待配图", "待发布", "已发布", "已归档"];

interface ParsedImportedMarkdown {
  body: string;
  metadata: Record<string, unknown>;
  properties: Record<string, MetadataValue>;
}

export function deriveImportedSheetTitle(filename: string, body: string): string {
  const withoutFrontmatter = splitFrontmatter(body)?.body ?? body;
  const heading = withoutFrontmatter
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

export function buildImportedMarkdownSheets(
  files: ImportedMarkdownFile[],
  groupId = DEFAULT_USER_GROUP_ID,
  project?: WritingProject,
): WritingSheet[] {
  const now = nowTimestamp();
  const defaultsProject = project ?? createImportDefaultsProject(now);

  return files.map((file) => {
    const parsed = parseImportedMarkdown(file.content);
    const metadata = parsed.metadata;
    const nested = isPlainRecord(metadata.loby) ? metadata.loby : {};
    const body = parsed.body.trimStart();
    const title = readString(metadata.title) || deriveImportedSheetTitle(file.name, body);
    const status = readProjectStatus(nested.status ?? metadata.status);
    const tags = readStringArray(metadata.tags);
    const targetWords = readFiniteNumber(nested.targetWords ?? metadata.targetWords);
    const summary = readString(nested.summary ?? metadata.summary);
    const createdAt = readString(nested.createdAt ?? metadata.createdAt);

    return createSheetWithProjectDefaults(defaultsProject, {
      id: createSheetId(),
      title,
      groupId,
      status,
      tags,
      targetWords,
      summary,
      body: body || `# ${title}\n\n`,
      createdAt,
      updatedAt: now,
      properties: parsed.properties,
    });
  });
}

function parseImportedMarkdown(content: string): ParsedImportedMarkdown {
  const normalized = content.replace(/^\uFEFF/, "");
  const parts = splitFrontmatter(normalized);
  if (!parts) return { body: normalized, metadata: {}, properties: {} };

  try {
    const parsed = parseYaml(parts.frontmatter);
    const metadata = isPlainRecord(parsed) ? parsed : {};
    const properties = Object.fromEntries(
      Object.entries(metadata).flatMap(([key, value]) => {
        if (RESERVED_FRONTMATTER_KEYS.has(key)) return [];
        const normalizedValue = normalizeMetadataValue(value);
        return normalizedValue === undefined ? [] : [[key, normalizedValue]];
      }),
    );
    return { body: parts.body, metadata, properties };
  } catch {
    return { body: normalized, metadata: {}, properties: {} };
  }
}

function splitFrontmatter(markdown: string): { frontmatter: string; body: string } | null {
  if (!markdown.startsWith("---\n")) return null;
  const endIndex = markdown.slice(4).search(/\n---(?:\n|$)/);
  if (endIndex < 0) return null;
  const boundaryStart = 4 + endIndex;
  const boundary = markdown.slice(boundaryStart).match(/^\n---(?:\n|$)/)?.[0] ?? "";
  const body = markdown.slice(boundaryStart + boundary.length).replace(/^\n/, "");
  return { frontmatter: markdown.slice(4, boundaryStart), body };
}

function normalizeMetadataValue(value: unknown): MetadataValue | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    const values = value.map(normalizeMetadataValue).filter((item): item is MetadataValue => item !== undefined);
    return values;
  }
  if (!isPlainRecord(value)) return undefined;
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) => {
      const normalized = normalizeMetadataValue(item);
      return normalized === undefined ? [] : [[key, normalized]];
    }),
  );
}

function createImportDefaultsProject(now: string): WritingProject {
  return {
    id: "project-import-defaults",
    title: "导入项目",
    status: "构思",
    projectGoal: { enabled: false, unit: "words", target: 0 },
    groups: [{ id: DEFAULT_USER_GROUP_ID, title: "正文" }],
    sheets: [],
    documentPropertyDefinitions: [],
    updatedAt: now,
  };
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
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim());
}

function readProjectStatus(value: unknown): ProjectStatus | undefined {
  return typeof value === "string" && PROJECT_STATUSES.includes(value as ProjectStatus) ? (value as ProjectStatus) : undefined;
}
