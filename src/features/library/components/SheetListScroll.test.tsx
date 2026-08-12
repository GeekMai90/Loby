// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、虚拟列表测试替身与 SheetList
 * [OUTPUT]: 验证全局搜索请求将目标文稿对齐到列表顶部、普通文稿切换仍使用自然定位，以及滚动条 thumb 的连续拖动
 * [POS]: 文稿列表滚动行为回归边界，保护搜索定位与日常切换之间的交互差异
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WritingSheet } from "@/shared/types";
import { SheetList } from "@/features/library/components/SheetList";

const { scrollToIndex, virtualizer } = vi.hoisted(() => {
  const scrollToIndex = vi.fn();
  const virtualizer = {
    getVirtualItems: () => [
      { index: 0, key: "sheet-1", start: 0 },
      { index: 1, key: "sheet-2", start: 88 },
      { index: 2, key: "sheet-3", start: 176 },
    ],
    getTotalSize: () => 264,
    measureElement: vi.fn(),
    scrollToIndex,
  };
  return { scrollToIndex, virtualizer };
});

vi.mock("@tanstack/react-virtual", () => ({
  defaultRangeExtractor: ({ start, end }: { start: number; end: number }) =>
    Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index),
  useVirtualizer: () => virtualizer,
}));

vi.mock("@/features/library/components/SheetRow", () => ({
  SheetRow: ({ sheet }: { sheet: WritingSheet }) => createElement("article", { "data-sheet-id": sheet.id }, sheet.title),
}));

describe("SheetList scroll requests", () => {
  let root: Root | undefined;
  let container: HTMLDivElement;

  beforeEach(() => {
    scrollToIndex.mockClear();
    container = document.createElement("div");
    document.body.append(container);
  });

  afterEach(() => {
    root?.unmount();
    root = undefined;
    document.body.replaceChildren();
  });

  it("aligns a search result to the top without changing ordinary selection scroll", async () => {
    root = createRoot(container);
    await act(async () => {
      root?.render(createSheetList({ activeSheetId: "sheet-2", scrollToTopRequest: { sheetId: "sheet-2", requestId: 1 } }));
    });

    expect(scrollToIndex).toHaveBeenLastCalledWith(1, { align: "start" });

    await act(async () => {
      root?.render(createSheetList({ activeSheetId: "sheet-3" }));
    });
    expect(scrollToIndex).toHaveBeenLastCalledWith(2, { align: "auto" });

    await act(async () => {
      root?.render(createSheetList({ activeSheetId: "sheet-2", scrollToTopRequest: { sheetId: "sheet-2", requestId: 2 } }));
    });
    expect(scrollToIndex).toHaveBeenLastCalledWith(1, { align: "start" });
    expect(scrollToIndex).toHaveBeenCalledTimes(3);
  });

  it("keeps thumb dragging on the scrollbar after the pointer leaves the thumb", async () => {
    root = createRoot(container);
    await act(async () => {
      root?.render(createSheetList({ activeSheetId: "sheet-1" }));
    });

    const list = container.querySelector<HTMLDivElement>(".sheet-list-scroll");
    const track = container.querySelector<HTMLDivElement>(".sheet-list-scrollbar");
    const thumb = container.querySelector<HTMLDivElement>(".sheet-list-scrollbar-thumb");
    if (!list || !track || !thumb) throw new Error("Missing sheet scrollbar elements");

    Object.defineProperties(list, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 1_000 },
    });
    Object.defineProperty(track, "clientHeight", { configurable: true, value: 100 });
    Object.defineProperty(thumb, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ height: 20, width: 5, top: 0, right: 5, bottom: 20, left: 0, x: 0, y: 0, toJSON: () => ({}) }),
    });

    await act(async () => {
      thumb.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, clientY: 10, pointerId: 7 }));
      window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientY: 50, pointerId: 7 }));
    });

    expect(track.dataset.dragging).toBe("true");
    expect(list.scrollTop).toBe(450);

    await act(async () => {
      window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, pointerId: 7 }));
    });
    expect(track.dataset.dragging).toBeUndefined();
  });
});

function createSheetList({
  activeSheetId,
  scrollToTopRequest,
}: {
  activeSheetId: string;
  scrollToTopRequest?: { sheetId: string; requestId: number };
}) {
  return createElement(SheetList, {
    active: true,
    sheets: [sheet("sheet-1"), sheet("sheet-2"), sheet("sheet-3")],
    sheetMetaLabelById: {},
    sheetProjectById: {},
    libraryPath: "",
    activeSheetId,
    scrollToTopRequest,
    selectedSheetIds: [],
    draggingSheetId: "",
    dropTarget: null,
    canReorderSheets: true,
    canMoveSheets: true,
    onClearSheetSelection: vi.fn(),
    onSelectSheet: vi.fn(),
    onSheetContextMenu: vi.fn(),
    onStartPointerDrag: vi.fn(),
    onSuppressClickAfterDrag: vi.fn(() => false),
  });
}

function sheet(id: string): WritingSheet {
  return {
    id,
    title: id,
    tags: [],
    targetWords: 0,
    description: "",
    body: "",
    createdAt: "2026-07-31",
    updatedAt: "2026-07-31",
    properties: {},
  };
}
