/**
 * [INPUT]: 依赖 shared 公共契约、Markdown 标题与双格式图片引用解析
 * [OUTPUT]: 对外提供 getSheetDisplayTitle、getSheetPreview、isBlankSheet、getSheetMetaText
 * [POS]: 写作库文稿列表投影边界，避免标题和独立图片引用污染三行正文预览
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

function resolveSheetDisplayTitle(sheet: WritingSheet, body: string) {
  return extractFirstHeadingTitle(body) || sheet.title || "无标题";
}

export function isBlankSheet(sheet: WritingSheet) {
  return !sheet.body.trim() && !sheet.description.trim();
}

export function getSheetMetaText(sheet: WritingSheet, projectTitle?: string) {
  const timeText = formatSheetTime(sheet.updatedAt || sheet.createdAt || deriveTimeFromSheetId(sheet.id));
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

function formatSheetTime(value: string) {
  const date = parseSheetDate(value);
  if (!date) return "未知时间";
  const now = new Date();
  const dateKey = toDateKey(date);
  const todayKey = toDateKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  if (dateKey === todayKey) return `今天 ${time}`;
  if (dateKey === toDateKey(yesterday)) return `昨天 ${time}`;
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`;
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${time}`;
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

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
