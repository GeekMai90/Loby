/**
 * [INPUT]: 依赖 shared 公共契约、Markdown 标题与双格式图片引用解析
 * [OUTPUT]: 对外提供标题、单行摘要、首图、空文稿与“相对时间/日期 · 项目”元信息投影
 * [POS]: 写作库文稿卡片投影边界，统一 Bear 式内容层级并避免 Markdown 图片引用污染正文摘要
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { WritingSheet } from "@/shared/types";
import { extractFirstHeadingTitle } from "@/shared/lib/markdownTitle";
import { parseImageReferences } from "@/features/library/model/imageAssets";

export function getSheetDisplayTitle(sheet: WritingSheet) {
  return resolveSheetDisplayTitle(sheet, sheet.body);
}

export function getSheetPreview(sheet: WritingSheet) {
  const body = sheet.body;
  const displayTitle = resolveSheetDisplayTitle(sheet, body);
  const previewLines: string[] = [];
  let lineStart = 0;

  while (lineStart <= body.length && previewLines.length < 3) {
    const newlineIndex = body.indexOf("\n", lineStart);
    const lineEnd = newlineIndex === -1 ? body.length : newlineIndex;
    const line = cleanSheetPreviewLine(body.slice(lineStart, lineEnd));
    if (line && line !== displayTitle) previewLines.push(line);
    if (newlineIndex === -1) break;
    lineStart = newlineIndex + 1;
  }

  return previewLines.join(" ");
}

export function getSheetSearchPreview(sheet: WritingSheet, search: string) {
  const normalizedSearch = search.trim().toLocaleLowerCase();
  if (!normalizedSearch) return getSheetPreview(sheet);

  const displayTitle = resolveSheetDisplayTitle(sheet, sheet.body);
  const body = sheet.body;
  const lowerBody = body.toLocaleLowerCase();
  let matchIndex = lowerBody.indexOf(normalizedSearch);
  while (matchIndex >= 0) {
    const lineStart = body.lastIndexOf("\n", matchIndex - 1) + 1;
    const newlineIndex = body.indexOf("\n", matchIndex);
    const lineEnd = newlineIndex === -1 ? body.length : newlineIndex;
    const line = cleanSheetPreviewLine(body.slice(lineStart, lineEnd));
    if (line && line !== displayTitle && line.toLocaleLowerCase().includes(normalizedSearch)) {
      return buildSearchLinePreview(line, normalizedSearch);
    }
    matchIndex = lowerBody.indexOf(normalizedSearch, matchIndex + Math.max(1, normalizedSearch.length));
  }

  return getSheetPreview(sheet);
}

function buildSearchLinePreview(line: string, normalizedSearch: string) {
  const matchIndex = line.toLocaleLowerCase().indexOf(normalizedSearch);
  if (matchIndex < 0) return line;

  const start = Math.max(0, matchIndex - 6);
  const end = Math.min(line.length, start + 72);
  const snippet = line.slice(start, end).trim();
  return `${start > 0 ? "…" : ""}${snippet}${end < line.length ? "…" : ""}`;
}

export function getSheetPreviewImage(sheet: WritingSheet) {
  return parseImageReferences(sheet.body)[0] ?? null;
}

function resolveSheetDisplayTitle(sheet: WritingSheet, body: string) {
  return extractFirstHeadingTitle(body) || sheet.title || "无标题";
}

export function isBlankSheet(sheet: WritingSheet) {
  const title = sheet.title.trim();
  const hasAuthoredTitle = Boolean(title && title !== "无标题" && title !== "未命名新文稿");
  return !hasAuthoredTitle && !sheet.body.trim() && !sheet.description.trim();
}

export function getSheetMetaText(sheet: WritingSheet, projectTitle?: string, now = new Date()) {
  const timeText = formatSheetTime(sheet.updatedAt || sheet.createdAt || deriveTimeFromSheetId(sheet.id), now);
  return projectTitle ? `${timeText} · ${projectTitle}` : timeText;
}

function cleanSheetPreviewLine(line: string) {
  const trimmed = line.trim();
  if (isStandaloneImageReference(trimmed)) return "";

  return trimmed
    .replace(/^#{1,6}\s+/, "")
    .replace(/^>\s?/, "")
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/, "")
    .replace(/^\s*[-*+]\s+/, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/(^|[^_])_([^_\n]+?)_(?!_)/g, "$1$2")
    .replace(/~~([^~\n]+?)~~/g, "$1")
    .replace(/(?<!~)~([^~\n]+?)~(?!~)/g, "$1")
    .replace(/==(?!=)([^\n]+?)(?<!\\)==(?![=])/g, "$1")
    .replace(/\[\^([^\]\n]+)\]/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function isStandaloneImageReference(value: string) {
  const [reference] = parseImageReferences(value);
  return Boolean(reference && reference.index === 0 && reference.raw === value);
}

function deriveTimeFromSheetId(sheetId: string) {
  const match = sheetId.match(/(?:sheet|import)-(\d{10,})/);
  if (!match) return "";
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return "";
  const timestamp = value > 1_000_000_000_000 ? value : value * 1000;
  return new Date(timestamp).toISOString();
}

function formatSheetTime(value: string, now: Date) {
  const date = parseSheetDate(value);
  if (!date) return "未知时间";
  const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000));
  if (elapsedMinutes < 1) return "刚刚";
  if (elapsedMinutes < 60) return `${elapsedMinutes}分钟前`;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function parseSheetDate(value: string) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 0, 0);
  }
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}
