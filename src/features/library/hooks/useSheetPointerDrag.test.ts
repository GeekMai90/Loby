// @vitest-environment happy-dom

import { act, createElement, Fragment, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { SheetDropTarget, WritingSheet } from "@/shared/types";
import type { SheetMoveTarget } from "@/features/library/model/projectCreation";
import { SHEET_LIBRARY_RETURN_DELAY_MS, SHEET_PROJECT_OPEN_DELAY_MS } from "@/features/library/model/sheetDrag";
import { useSheetPointerDrag, type SheetDragPreviewState } from "@/features/library/hooks/useSheetPointerDrag";

const testSheet: WritingSheet = {
  id: "sheet-1",
  title: "测试文稿",
  groupId: "group-default",
  tags: [],
  targetWords: 1000,
  description: "",
  body: "# 测试文稿",
  createdAt: "2026-07-19",
  updatedAt: "2026-07-19",
  properties: {},
};

const secondTestSheet: WritingSheet = {
  ...testSheet,
  id: "sheet-2",
  title: "第二篇文稿",
  body: "# 第二篇文稿",
};

interface DragCallbacks {
  onReorderStart: Mock<(sheetId: string) => void>;
  onReorderPreview: Mock<(target: SheetDropTarget | null) => void>;
  onReorderCommit: Mock<(sourceSheetId: string, targetSheetId: string, position: SheetDropTarget["position"]) => void>;
  onReorderEnd: Mock<() => void>;
  onMoveCommit: Mock<(sheetIds: string[], target: SheetMoveTarget) => void>;
  onPreviewProject: Mock<(projectId: string) => void>;
  onPreviewLibrary: Mock<() => void>;
  onPreviewClear: Mock<() => void>;
}

function callbacks(): DragCallbacks {
  return {
    onReorderStart: vi.fn(),
    onReorderPreview: vi.fn(),
    onReorderCommit: vi.fn(),
    onReorderEnd: vi.fn(),
    onMoveCommit: vi.fn(),
    onPreviewProject: vi.fn(),
    onPreviewLibrary: vi.fn(),
    onPreviewClear: vi.fn(),
  };
}

function DragHarness({
  events,
  sheets = [testSheet],
  selectedSheetIds = [testSheet.id],
}: {
  events: DragCallbacks;
  sheets?: WritingSheet[];
  selectedSheetIds?: string[];
}) {
  const [clickCount, setClickCount] = useState(0);
  const drag = useSheetPointerDrag({
    sheets,
    sheetMetaLabelById: Object.fromEntries(sheets.map((sheet) => [sheet.id, "项目"])),
    selectedSheetIds,
    canReorderSheets: true,
    canMoveSheets: true,
    onSheetReorderStart: events.onReorderStart,
    onSheetReorderPreview: events.onReorderPreview,
    onSheetReorderCommit: events.onReorderCommit,
    onSheetReorderEnd: events.onReorderEnd,
    onSheetMoveCommit: events.onMoveCommit,
    onSheetDragPreviewProject: events.onPreviewProject,
    onSheetDragPreviewLibrary: events.onPreviewLibrary,
    onSheetDragPreviewClear: events.onPreviewClear,
  });
  return createElement(
    Fragment,
    null,
    createElement(
      "button",
      {
        "data-testid": "sheet",
        onPointerDown: (event) => drag.startSheetPointerDrag(testSheet.id, event),
        onClick: (event) => {
          if (!drag.suppressClickAfterDrag(event)) setClickCount((current) => current + 1);
        },
      },
      "文稿",
    ),
    createElement("output", { "data-testid": "clicks" }, clickCount),
    createElement("output", { "data-testid": "preview" }, previewText(drag.dragPreview)),
  );
}

function previewText(preview: SheetDragPreviewState | null): string {
  return preview ? `${preview.title}:${preview.x},${preview.y}` : "";
}

describe("useSheetPointerDrag", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    await act(async () => root.unmount());
    container.remove();
    document.body.classList.remove("dragging-sheet-card");
  });

  async function renderHarness(events: DragCallbacks, options: { sheets?: WritingSheet[]; selectedSheetIds?: string[] } = {}) {
    await act(async () => root.render(createElement(DragHarness, { events, ...options })));
    return container.querySelector<HTMLButtonElement>('[data-testid="sheet"]')!;
  }

  async function startDrag(button: HTMLButtonElement, pointerId = 7) {
    await act(async () => {
      button.dispatchEvent(pointerEvent("pointerdown", { pointerId, clientX: 20, clientY: 30 }));
    });
    return pointerId;
  }

  it("waits for the movement threshold and cancels an active drag with Escape", async () => {
    const events = callbacks();
    const button = await renderHarness(events);
    const pointerId = await startDrag(button);
    vi.spyOn(document, "elementFromPoint").mockReturnValue(null);

    await act(async () => window.dispatchEvent(pointerEvent("pointermove", { pointerId, clientX: 22, clientY: 31 })));
    expect(events.onReorderStart).not.toHaveBeenCalled();

    await act(async () => window.dispatchEvent(pointerEvent("pointermove", { pointerId, clientX: 28, clientY: 38 })));
    expect(events.onReorderStart).toHaveBeenCalledWith(testSheet.id);
    expect(container.querySelector('[data-testid="preview"]')?.textContent).toBe("测试文稿:28,38");
    expect(document.body.classList.contains("dragging-sheet-card")).toBe(true);

    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(events.onReorderEnd).toHaveBeenCalledOnce();
    expect(events.onMoveCommit).not.toHaveBeenCalled();
    expect(events.onPreviewClear).toHaveBeenCalledOnce();
    expect(document.body.classList.contains("dragging-sheet-card")).toBe(false);
  });

  it("opens project and library navigation after their distinct hover delays", async () => {
    vi.useFakeTimers();
    const events = callbacks();
    const button = await renderHarness(events);
    const projectTarget = document.createElement("button");
    projectTarget.dataset.sheetHoverProjectId = "project-blog";
    projectTarget.dataset.sheetMoveProjectId = "project-blog";
    const libraryTarget = document.createElement("div");
    libraryTarget.dataset.sheetDragReturnLibrary = "";
    document.body.append(projectTarget, libraryTarget);
    const hitTarget = vi.spyOn(document, "elementFromPoint");

    const pointerId = await startDrag(button);
    hitTarget.mockReturnValue(projectTarget);
    await act(async () => window.dispatchEvent(pointerEvent("pointermove", { pointerId, clientX: 40, clientY: 50 })));
    await act(async () => vi.advanceTimersByTime(SHEET_PROJECT_OPEN_DELAY_MS - 1));
    expect(events.onPreviewProject).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1));
    expect(events.onPreviewProject).toHaveBeenCalledWith("project-blog");

    hitTarget.mockReturnValue(libraryTarget);
    await act(async () => window.dispatchEvent(pointerEvent("pointermove", { pointerId, clientX: 50, clientY: 60 })));
    await act(async () => vi.advanceTimersByTime(SHEET_LIBRARY_RETURN_DELAY_MS));
    expect(events.onPreviewLibrary).toHaveBeenCalledOnce();

    await act(async () => window.dispatchEvent(pointerEvent("pointercancel", { pointerId, clientX: 50, clientY: 60 })));
    projectTarget.remove();
    libraryTarget.remove();
  });

  it("commits the move target and suppresses only the click produced by the drag", async () => {
    const events = callbacks();
    const button = await renderHarness(events);
    const target = document.createElement("button");
    target.dataset.sheetMoveProjectId = "project-blog";
    target.dataset.sheetMoveGroupId = "group-published";
    document.body.append(target);
    vi.spyOn(document, "elementFromPoint").mockReturnValue(target);

    const pointerId = await startDrag(button);
    await act(async () => window.dispatchEvent(pointerEvent("pointermove", { pointerId, clientX: 40, clientY: 50 })));
    await act(async () => window.dispatchEvent(pointerEvent("pointerup", { pointerId, clientX: 40, clientY: 50 })));

    expect(events.onMoveCommit).toHaveBeenCalledWith([testSheet.id], {
      projectId: "project-blog",
      groupId: "group-published",
    });
    await act(async () => button.click());
    expect(container.querySelector('[data-testid="clicks"]')?.textContent).toBe("0");
    await act(async () => button.click());
    expect(container.querySelector('[data-testid="clicks"]')?.textContent).toBe("1");
    target.remove();
  });

  it("commits the full selected set when dragging a selected sheet to a project", async () => {
    const events = callbacks();
    const button = await renderHarness(events, {
      sheets: [testSheet, secondTestSheet],
      selectedSheetIds: [testSheet.id, secondTestSheet.id],
    });
    const target = document.createElement("button");
    target.dataset.sheetMoveProjectId = "project-blog";
    document.body.append(target);
    vi.spyOn(document, "elementFromPoint").mockReturnValue(target);

    const pointerId = await startDrag(button);
    await act(async () => window.dispatchEvent(pointerEvent("pointermove", { pointerId, clientX: 40, clientY: 50 })));
    await act(async () => window.dispatchEvent(pointerEvent("pointerup", { pointerId, clientX: 40, clientY: 50 })));

    expect(events.onMoveCommit).toHaveBeenCalledWith([testSheet.id, secondTestSheet.id], {
      projectId: "project-blog",
    });
    target.remove();
  });
});

function pointerEvent(type: string, init: PointerEventInit & { pointerId: number }): PointerEvent {
  return new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, ...init });
}
