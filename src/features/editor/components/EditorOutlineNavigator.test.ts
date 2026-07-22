// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { editorOutlineMarkerWidth } from "@/features/editor/model/editorOutlineNavigator";
import { EditorOutlineNavigator } from "@/features/editor/components/EditorOutlineNavigator";

describe("editorOutlineMarkerWidth", () => {
  it("tapers marker lengths by distance from the active heading", () => {
    expect([0, 1, 2, 3, 4, 5].map((index) => editorOutlineMarkerWidth(index, 2))).toEqual([13, 18, 26, 18, 13, 9]);
    expect(editorOutlineMarkerWidth(6, 2)).toBe(6);
    expect(editorOutlineMarkerWidth(2, null)).toBe(6);
  });
});

describe("EditorOutlineNavigator", () => {
  const containers: HTMLDivElement[] = [];

  afterEach(() => {
    containers.splice(0).forEach((container) => container.remove());
  });

  it("renders one compact navigation target per heading and reveals the clicked heading", async () => {
    const container = document.createElement("div");
    containers.push(container);
    document.body.append(container);
    const onRevealPosition = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(EditorOutlineNavigator, {
          body: "# 开始\n正文\n\n## 方法\n内容\n\n### 结尾\n完成",
          onRevealPosition,
        }),
      );
    });

    const buttons = container.querySelectorAll<HTMLButtonElement>(".editor-outline-button");
    expect(buttons).toHaveLength(3);
    expect(buttons[1].getAttribute("aria-label")).toBe("跳转到标题：方法");

    await act(async () => buttons[1].dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    expect(buttons[1].closest("li")?.getAttribute("data-active")).toBe("true");
    expect(buttons[1].querySelector(".editor-outline-title")?.getAttribute("aria-hidden")).toBe("false");

    await act(async () => buttons[1].click());
    expect(onRevealPosition).toHaveBeenCalledWith(9);

    await act(async () => root.unmount());
  });

  it("stays hidden when the document has no Markdown headings", async () => {
    const container = document.createElement("div");
    containers.push(container);
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(EditorOutlineNavigator, { body: "只有正文", onRevealPosition: vi.fn() }));
    });

    expect(container.querySelector("nav")).toBeNull();
    await act(async () => root.unmount());
  });

  it("stays hidden when the document has only one Markdown heading", async () => {
    const container = document.createElement("div");
    containers.push(container);
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(EditorOutlineNavigator, { body: "# 唯一标题\n正文", onRevealPosition: vi.fn() }));
    });

    expect(container.querySelector("nav")).toBeNull();
    await act(async () => root.unmount());
  });
});
