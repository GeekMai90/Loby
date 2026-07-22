/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供 DEFAULT_SHEET_RAIL_WIDTH、MIN_SHEET_RAIL_WIDTH、MAX_SHEET_RAIL_WIDTH、SHEET_RAIL_COLLAPSE_THRESHOLD、SheetRailDragResult、normalizeSheetRailWidth、resolveSheetRailDrag
 * [POS]: 写作库 feature 的领域模型边界，集中 写作库 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export const DEFAULT_SHEET_RAIL_WIDTH = 240;
export const MIN_SHEET_RAIL_WIDTH = 240;
export const MAX_SHEET_RAIL_WIDTH = 360;
export const SHEET_RAIL_COLLAPSE_THRESHOLD = 180;

export interface SheetRailDragResult {
  width: number;
  shouldCollapse: boolean;
}

export function normalizeSheetRailWidth(value: unknown, fallback = DEFAULT_SHEET_RAIL_WIDTH) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(MAX_SHEET_RAIL_WIDTH, Math.max(MIN_SHEET_RAIL_WIDTH, Math.round(value)));
}

export function resolveSheetRailDrag(startWidth: number, deltaX: number, canCollapse: boolean): SheetRailDragResult {
  const requestedWidth = startWidth + deltaX;
  return {
    width: normalizeSheetRailWidth(requestedWidth, startWidth),
    shouldCollapse: canCollapse && requestedWidth <= SHEET_RAIL_COLLAPSE_THRESHOLD,
  };
}
