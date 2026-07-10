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
