// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React 测试运行时与 SheetDragPreview
 * [OUTPUT]: 验证拖拽预览脱离列表栏坐标系，并以图标中心对齐窗口指针
 * [POS]: library components 的拖拽预览几何回归测试，保护 Portal 层级与光标锚点
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SheetDragPreview } from "@/features/library/components/SheetDragPreview";

describe("SheetDragPreview", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("renders in the document layer with the icon center anchored to the pointer", async () => {
    await act(async () => {
      root.render(<SheetDragPreview preview={{ title: "测试文稿", meta: "今天 · 收件箱", x: 300, y: 200 }} />);
    });

    const preview = document.body.querySelector<HTMLElement>(".sheet-drag-preview");
    expect(preview?.parentElement).toBe(document.body);
    expect(container.querySelector(".sheet-drag-preview")).toBeNull();
    expect(preview?.style.left).toBe("275px");
    expect(preview?.style.top).toBe("177px");
  });
});
