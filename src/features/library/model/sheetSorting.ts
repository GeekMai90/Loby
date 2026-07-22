/**
 * [INPUT]: 依赖 shared 公共契约
 * [OUTPUT]: 对外提供 DEFAULT_SHEET_SORT_PREFERENCE、RailDropPosition、sortSheetList、moveItemById、moveIdByPosition
 * [POS]: 写作库 feature 的领域模型边界，集中 写作库 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { SheetSortDirection, SheetSortMode, SheetSortPreference, WritingSheet } from "@/shared/types";

export const DEFAULT_SHEET_SORT_PREFERENCE: SheetSortPreference = {
  mode: "manual",
  direction: "desc",
};

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
  return sheet.body.match(/^#\s+(.+?)\s*#*\s*$/m)?.[1]?.trim() || sheet.title || "无标题";
}

function getSheetUpdatedValue(sheet: WritingSheet): number {
  const value = Date.parse(sheet.updatedAt);
  return Number.isNaN(value) ? getSheetCreatedValue(sheet) : value;
}

function getSheetCreatedValue(sheet: WritingSheet): number {
  const createdAt = sheet.createdAt ? Date.parse(sheet.createdAt) : Number.NaN;
  if (!Number.isNaN(createdAt)) return createdAt;
  const match = sheet.id.match(/(?:sheet|version)-(\d{10,})/);
  if (match) return Number(match[1]);
  const fallback = Date.parse(sheet.updatedAt);
  return Number.isNaN(fallback) ? 0 : fallback;
}
