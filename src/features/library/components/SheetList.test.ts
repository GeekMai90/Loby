import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { WritingSheet } from "@/shared/types";
import { SheetList } from "@/features/library/components/SheetList";

describe("SheetList", () => {
  it("joins adjacent selected sheets into one visual card group", () => {
    const html = renderSheetList(["sheet-1", "sheet-2", "sheet-3"]);

    expect(sheetClasses(html, "sheet-1")).toContain("selected-group-start");
    expect(sheetClasses(html, "sheet-1")).not.toContain("selected-group-end");
    expect(sheetClasses(html, "sheet-2")).not.toContain("selected-group-start");
    expect(sheetClasses(html, "sheet-2")).not.toContain("selected-group-end");
    expect(sheetClasses(html, "sheet-3")).not.toContain("selected-group-start");
    expect(sheetClasses(html, "sheet-3")).toContain("selected-group-end");
    expect(sheetMarkup(html, "sheet-1")).toContain('class="sheet-row-divider"');
  });

  it("keeps non-adjacent selections as separate card groups", () => {
    const html = renderSheetList(["sheet-1", "sheet-3"]);

    expect(sheetClasses(html, "sheet-1")).toContain("selected-group-start");
    expect(sheetClasses(html, "sheet-1")).toContain("selected-group-end");
    expect(sheetClasses(html, "sheet-2")).toContain("unselected");
    expect(sheetClasses(html, "sheet-2")).toContain("before-selected");
    expect(sheetClasses(html, "sheet-3")).toContain("selected-group-start");
    expect(sheetClasses(html, "sheet-3")).toContain("selected-group-end");
  });

  it("exposes the list focus state to its scrollbar styling", () => {
    expect(renderSheetList([], true)).toContain('class="sheet-list-scroll');
    expect(renderSheetList([], true)).toContain('data-active="true"');
    expect(renderSheetList([], false)).toContain('data-active="false"');
  });
});

function renderSheetList(selectedSheetIds: string[], active = true): string {
  const sheets = [sheet("sheet-1"), sheet("sheet-2"), sheet("sheet-3")];

  return renderToStaticMarkup(
    React.createElement(SheetList, {
      active,
      sheets,
      sheetProjectTitleById: {},
      activeSheetId: "sheet-1",
      selectedSheetIds,
      draggingSheetId: "",
      dropTarget: null,
      canReorderSheets: true,
      canMoveSheets: true,
      onClearSheetSelection: vi.fn(),
      onSelectSheet: vi.fn(),
      onSheetContextMenu: vi.fn(),
      onStartPointerDrag: vi.fn(),
      onSuppressClickAfterDrag: vi.fn(() => false),
    }),
  );
}

function sheet(id: string): WritingSheet {
  return {
    id,
    title: id,
    tags: [],
    targetWords: 0,
    description: "摘要",
    body: "正文",
    createdAt: "2026-07-19T00:00:00.000Z",
    updatedAt: "2026-07-19T00:00:00.000Z",
    properties: {},
  };
}

function sheetClasses(html: string, sheetId: string): string {
  const match = html.match(new RegExp(`<article[^>]*class="([^"]+)"[^>]*data-sheet-id="${sheetId}"`));
  if (!match) throw new Error(`Missing sheet row ${sheetId}`);
  return match[1];
}

function sheetMarkup(html: string, sheetId: string): string {
  const start = html.indexOf(`data-sheet-id="${sheetId}"`);
  const end = html.indexOf("</article>", start);
  if (start === -1 || end === -1) throw new Error(`Missing sheet row ${sheetId}`);
  return html.slice(start, end);
}
