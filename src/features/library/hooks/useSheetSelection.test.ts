// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest 与 useSheetSelection 的列表选择契约
 * [OUTPUT]: 验证修饰键多选、活动文稿切换、可见范围修复和清空选择行为
 * [POS]: library 文稿选择协调器的集成回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSheetSelection } from "@/features/library/hooks/useSheetSelection";

interface SelectionHarnessProps {
  initialSheetId?: string;
}

function SelectionHarness({ initialSheetId = "sheet-1" }: SelectionHarnessProps) {
  const [activeSheetId, setActiveSheetId] = useState(initialSheetId);
  const [visibleSheetIds, setVisibleSheetIds] = useState(["sheet-1", "sheet-2", "sheet-3"]);
  const selection = useSheetSelection({
    initialSheetId,
    activeSheetId,
    projectFilter: "active",
    visibleSheetIds,
    onActiveSheetChange: setActiveSheetId,
    onSelectSheet: setActiveSheetId,
  });

  return createElement(
    "section",
    null,
    createElement(
      "button",
      {
        "data-testid": "select-second",
        onClick: () => selection.selectSheetFromList("sheet-2", { metaKey: false, ctrlKey: false, shiftKey: false }),
      },
      "second",
    ),
    createElement(
      "button",
      {
        "data-testid": "add-third",
        onClick: () => selection.selectSheetFromList("sheet-3", { metaKey: true, ctrlKey: false, shiftKey: false }),
      },
      "third",
    ),
    createElement("button", { "data-testid": "hide-second", onClick: () => setVisibleSheetIds(["sheet-1", "sheet-3"]) }, "hide"),
    createElement("button", { "data-testid": "clear", onClick: selection.clearSheetSelection }, "clear"),
    createElement("output", { "data-testid": "selected" }, selection.selectedSheetIds.join(",")),
    createElement("output", { "data-testid": "anchor" }, selection.sheetSelectionAnchorId),
    createElement("output", { "data-testid": "active" }, activeSheetId),
  );
}

describe("useSheetSelection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
    container.remove();
  });

  it("switches the active sheet and adds a second sheet with a modifier", async () => {
    await act(async () => root.render(createElement(SelectionHarness)));

    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="select-second"]')?.click());
    expect(container.querySelector('[data-testid="selected"]')?.textContent).toBe("sheet-2");
    expect(container.querySelector('[data-testid="anchor"]')?.textContent).toBe("sheet-2");
    expect(container.querySelector('[data-testid="active"]')?.textContent).toBe("sheet-2");

    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="add-third"]')?.click());
    expect(container.querySelector('[data-testid="selected"]')?.textContent).toBe("sheet-2,sheet-3");
    expect(container.querySelector('[data-testid="active"]')?.textContent).toBe("sheet-3");
  });

  it("prunes hidden selections and clears the active sheet", async () => {
    await act(async () => root.render(createElement(SelectionHarness)));

    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="select-second"]')?.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="add-third"]')?.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="hide-second"]')?.click());
    expect(container.querySelector('[data-testid="selected"]')?.textContent).toBe("sheet-3");
    expect(container.querySelector('[data-testid="anchor"]')?.textContent).toBe("sheet-3");

    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="clear"]')?.click());
    expect(container.querySelector('[data-testid="selected"]')?.textContent).toBe("");
    expect(container.querySelector('[data-testid="active"]')?.textContent).toBe("");
  });
});
