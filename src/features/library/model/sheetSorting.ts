/**
 * [INPUT]: 依赖 shared 公共契约
 * [OUTPUT]: 对外提供 DEFAULT_SHEET_SORT_PREFERENCE、RailDropPosition、带文稿对象级派生缓存的 sortSheetList、moveItemById、moveIdByPosition
 * [POS]: 写作库文稿排序边界，复用未变化 WritingSheet 的标题与日期键，正文提交时只重算变化文稿
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { SheetSortDirection, SheetSortMode, SheetSortPreference, WritingSheet } from "@/shared/types";

export const DEFAULT_SHEET_SORT_PREFERENCE: SheetSortPreference = {
  mode: "manual",
  direction: "desc",
};

const sheetSortTitleCache = new WeakMap<WritingSheet, string>();
const sheetUpdatedValueCache = new WeakMap<WritingSheet, number>();
const sheetCreatedValueCache = new WeakMap<WritingSheet, number>();

export type RailDropPosition = "before" | "after";

export function sortSheetList(
  sheets: WritingSheet[],
  mode: SheetSortMode,
  direction: SheetSortDirection,
  manualOrder: string[] = [],
): WritingSheet[] {
  if (mode === "manual") return applyManualSheetOrder(sheets, manualOrder);
  return [...sheets].sort((a, b) => {
    if (mode === "title") {
      return getSheetSortTitle(a).localeCompare(getSheetSortTitle(b), "zh-Hans-CN", {
        numeric: true,
        sensitivity: "base",
      });
    }
    if (mode === "updated") {
      return direction === "asc" ? getSheetUpdatedValue(a) - getSheetUpdatedValue(b) : getSheetUpdatedValue(b) - getSheetUpdatedValue(a);
    }
    return direction === "asc" ? getSheetCreatedValue(a) - getSheetCreatedValue(b) : getSheetCreatedValue(b) - getSheetCreatedValue(a);
  });
}

export function moveItemById<T extends { id: string }>(items: T[], sourceId: string, targetId: string, position: RailDropPosition): T[] {
  if (sourceId === targetId) return items;
  const sourceIndex = items.findIndex((item) => item.id === sourceId);
  const targetIndex = items.findIndex((item) => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return items;
  const nextItems = [...items];
  const [sourceItem] = nextItems.splice(sourceIndex, 1);
  const adjustedTargetIndex = nextItems.findIndex((item) => item.id === targetId);
  if (adjustedTargetIndex < 0) return items;
  nextItems.splice(position === "after" ? adjustedTargetIndex + 1 : adjustedTargetIndex, 0, sourceItem);
  return nextItems;
}

export function moveIdByPosition(ids: string[], sourceId: string, targetId: string, position: RailDropPosition): string[] {
  if (sourceId === targetId) return ids;
  const sourceIndex = ids.indexOf(sourceId);
  const targetIndex = ids.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0) return ids;
  const nextIds = [...ids];
  nextIds.splice(sourceIndex, 1);
  const adjustedTargetIndex = nextIds.indexOf(targetId);
  if (adjustedTargetIndex < 0) return ids;
  nextIds.splice(position === "after" ? adjustedTargetIndex + 1 : adjustedTargetIndex, 0, sourceId);
  return nextIds;
}

function applyManualSheetOrder(sheets: WritingSheet[], manualOrder: string[]): WritingSheet[] {
  if (manualOrder.length === 0) return sheets;
  const sheetById = new Map(sheets.map((sheet) => [sheet.id, sheet]));
  const orderedSheets: WritingSheet[] = [];
  const usedIds = new Set<string>();
  for (const sheetId of manualOrder) {
    const sheet = sheetById.get(sheetId);
    if (!sheet || usedIds.has(sheetId)) continue;
    orderedSheets.push(sheet);
    usedIds.add(sheetId);
  }
  for (const sheet of sheets) {
    if (!usedIds.has(sheet.id)) orderedSheets.push(sheet);
  }
  return orderedSheets;
}

function getSheetSortTitle(sheet: WritingSheet): string {
  const cached = sheetSortTitleCache.get(sheet);
  if (cached !== undefined) return cached;
  const title = sheet.body.match(/^#\s+(.+?)\s*#*\s*$/m)?.[1]?.trim() || sheet.title || "无标题";
  sheetSortTitleCache.set(sheet, title);
  return title;
}

function getSheetUpdatedValue(sheet: WritingSheet): number {
  const cached = sheetUpdatedValueCache.get(sheet);
  if (cached !== undefined) return cached;
  const value = Date.parse(sheet.updatedAt);
  const resolved = Number.isNaN(value) ? getSheetCreatedValue(sheet) : value;
  sheetUpdatedValueCache.set(sheet, resolved);
  return resolved;
}

function getSheetCreatedValue(sheet: WritingSheet): number {
  const cached = sheetCreatedValueCache.get(sheet);
  if (cached !== undefined) return cached;
  const createdAt = sheet.createdAt ? Date.parse(sheet.createdAt) : Number.NaN;
  let resolved: number;
  if (!Number.isNaN(createdAt)) {
    resolved = createdAt;
  } else {
    const match = sheet.id.match(/(?:sheet|version)-(\d{10,})/);
    if (match) resolved = Number(match[1]);
    else {
      const fallback = Date.parse(sheet.updatedAt);
      resolved = Number.isNaN(fallback) ? 0 : fallback;
    }
  }
  sheetCreatedValueCache.set(sheet, resolved);
  return resolved;
}
