/**
 * [INPUT]: 依赖 shared 公共契约
 * [OUTPUT]: 对外提供 getSheetDisplayTitle、getSheetPreview、isBlankSheet、getSheetMetaText
 * [POS]: 写作库 feature 的领域模型边界，集中 写作库 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { WritingSheet } from "@/shared/types";

export function getSheetDisplayTitle(sheet: WritingSheet) {
  const headingTitle = sheet.body.match(/^#\s+(.+?)\s*#*\s*$/m)?.[1]?.trim();
  return headingTitle || sheet.title || "无标题";
}

export function getSheetPreview(sheet: WritingSheet) {
  return sheet.body
    .split("\n")
    .map(cleanSheetPreviewLine)
    .filter(Boolean)
    .filter((line) => line !== getSheetDisplayTitle(sheet))
    .slice(0, 3)
    .join(" ");
}

export function isBlankSheet(sheet: WritingSheet) {
  return !sheet.body.trim() && !sheet.summary.trim();
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
  return /^!\[[^\]]*\]\([^)]+\)(?:\s+"[^"]*")?\s*$/.test(value) || /^!\[\[[^\]]+\]\]\s*$/.test(value);
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
