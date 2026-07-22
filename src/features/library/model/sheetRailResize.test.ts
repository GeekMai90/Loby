import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHEET_RAIL_WIDTH,
  MAX_SHEET_RAIL_WIDTH,
  MIN_SHEET_RAIL_WIDTH,
  normalizeSheetRailWidth,
  resolveSheetRailDrag,
} from "@/features/library/model/sheetRailResize";

describe("sheetRailResize", () => {
  it("uses 240px as both the default and minimum width", () => {
    expect(DEFAULT_SHEET_RAIL_WIDTH).toBe(240);
    expect(MIN_SHEET_RAIL_WIDTH).toBe(240);
    expect(normalizeSheetRailWidth(undefined)).toBe(240);
    expect(normalizeSheetRailWidth(180)).toBe(240);
  });

  it("allows expansion up to the 360px maximum", () => {
    expect(resolveSheetRailDrag(240, 80, false)).toEqual({ width: 320, shouldCollapse: false });
    expect(resolveSheetRailDrag(320, 100, false)).toEqual({ width: MAX_SHEET_RAIL_WIDTH, shouldCollapse: false });
  });

  it("never collapses while the navigation rail is visible", () => {
    expect(resolveSheetRailDrag(240, -120, false)).toEqual({ width: 240, shouldCollapse: false });
  });

  it("collapses only after crossing the threshold with the navigation rail hidden", () => {
    expect(resolveSheetRailDrag(240, -59, true)).toEqual({ width: 240, shouldCollapse: false });
    expect(resolveSheetRailDrag(240, -60, true)).toEqual({ width: 240, shouldCollapse: true });
  });
});
