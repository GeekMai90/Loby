/**
 * [INPUT]: 依赖 React 服务端渲染、Vitest、SheetList 与 WritingSheet 契约
 * [OUTPUT]: 验证文稿选择分组、覆盖式滚动条、无界面滚动动画的有界虚拟窗口与选中背景原子切换
 * [POS]: 文稿列表组合层回归，防止全量 DOM、滚动视口动效或选择背景渐变重新引入性能和视觉问题
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
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

  it("keeps a narrow overlay scrollbar independent from list layout", () => {
    const activeHtml = renderSheetList([], true);
    const inactiveHtml = renderSheetList([], false);

    expect(activeHtml).toContain('class="sheet-list-scroll');
    expect(activeHtml).toContain('class="sheet-list-scrollbar"');
    expect(activeHtml).toContain('class="sheet-list-scrollbar-thumb"');
    expect(activeHtml).toContain('role="scrollbar"');
    expect(activeHtml).toContain('data-active="true"');
    expect(inactiveHtml).toContain('data-active="false"');
    expect(activeHtml).not.toContain("scrollbar-gutter");
  });

  it("switches selection backgrounds atomically while preserving drag transitions", () => {
    const classes = sheetClasses(renderSheetList(["sheet-1"]), "sheet-1");

    expect(classes).toContain("transition-[opacity,transform]");
    expect(classes).not.toContain("background-color");
  });

  it("virtualizes large sheet collections without restoring viewport reveal animation", () => {
    const sheets = Array.from({ length: 1_000 }, (_, index) => sheet(`sheet-${index + 1}`));
    const html = renderSheetList([], true, sheets);

    expect(html).toContain('data-sheet-virtualized-count="1000"');
    expect(html.match(/data-sheet-virtual-item=/g)?.length).toBeLessThan(30);
    expect(html).not.toContain("transform:scale(0.7)");
    expect(html).not.toContain("opacity:0");
  });

  it("renders every row when the collection fits inside the initial virtual window", () => {
    const html = renderSheetList([]);

    expect(html.match(/data-sheet-virtual-item=/g)).toHaveLength(3);
  });

  it("highlights the title and shows the matching body line while searching", () => {
    const html = renderSheetList([], true, [sheet("sheet-search", { title: "标题命中", body: "# 标题命中\n默认首行\n这里是命中正文。" })], {
      search: "命中",
    });

    expect(html.match(/<mark\b/g)).toHaveLength(2);
    expect(html).toMatch(/<span>这里是<\/span><mark[^>]*>命中<\/mark><span>正文/);
    expect(html).not.toContain("默认首行");
  });

  it("keeps the active sheet and drag source mounted outside the viewport range", () => {
    const sheets = Array.from({ length: 1_000 }, (_, index) => sheet(`sheet-${index + 1}`));
    const html = renderSheetList([], true, sheets, {
      activeSheetId: "sheet-500",
      draggingSheetId: "sheet-1000",
    });

    expect(html).toContain('data-sheet-virtual-item="sheet-500"');
    expect(html).toContain('data-sheet-virtual-item="sheet-1000"');
    expect(html).toContain('aria-posinset="1000"');
    expect(html).toContain('aria-setsize="1000"');
    expect(html.match(/data-sheet-virtual-item=/g)?.length).toBeLessThan(30);
  });
});

function renderSheetList(
  selectedSheetIds: string[],
  active = true,
  sheets: WritingSheet[] = [sheet("sheet-1"), sheet("sheet-2"), sheet("sheet-3")],
  state: { activeSheetId?: string; draggingSheetId?: string; search?: string } = {},
): string {
  return renderToStaticMarkup(
    React.createElement(SheetList, {
      active,
      sheets,
      sheetMetaLabelById: {},
      sheetProjectById: {},
      libraryPath: "",
      search: state.search ?? "",
      activeSheetId: state.activeSheetId ?? "sheet-1",
      selectedSheetIds,
      draggingSheetId: state.draggingSheetId ?? "",
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

function sheet(id: string, overrides: Partial<WritingSheet> = {}): WritingSheet {
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
    ...overrides,
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
