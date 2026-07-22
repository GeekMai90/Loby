// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest 与本地 Select primitives
 * [OUTPUT]: 验证 Select 语义宽度映射、Trigger/Content 等宽及超长条目截断契约
 * [POS]: components/ui 的 Select 几何回归测试，防止调用方重新维护两份宽度或内容驱动布局
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Select width geometry", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("maps semantic widths on the trigger", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(
          "div",
          null,
          createElement(Select, { defaultValue: "default" }, createElement(SelectTrigger, null, createElement(SelectValue))),
          createElement(
            Select,
            { defaultValue: "compact" },
            createElement(SelectTrigger, { width: "compact" }, createElement(SelectValue)),
          ),
          createElement(Select, { defaultValue: "wide" }, createElement(SelectTrigger, { width: "wide" }, createElement(SelectValue))),
          createElement(Select, { defaultValue: "full" }, createElement(SelectTrigger, { width: "full" }, createElement(SelectValue))),
          createElement(Select, { defaultValue: "fit" }, createElement(SelectTrigger, { width: "fit" }, createElement(SelectValue))),
        ),
      );
    });

    const triggers = Array.from(container.querySelectorAll<HTMLElement>("[data-slot='select-trigger']"));
    expect(triggers.map((trigger) => trigger.dataset.width)).toEqual(["default", "compact", "wide", "full", "fit"]);
    expect(triggers.every((trigger) => trigger.className.includes("text-left"))).toBe(true);
    expect(triggers.map((trigger) => trigger.className)).toEqual([
      expect.stringContaining("w-44"),
      expect.stringContaining("w-28"),
      expect.stringContaining("w-64"),
      expect.stringContaining("w-full"),
      expect.stringContaining("w-fit"),
    ]);

    await act(async () => root.unmount());
  });

  it("keeps the popup equal to the trigger and truncates long items", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(
          Select,
          { open: true, value: "long", onValueChange: () => undefined, onOpenChange: () => undefined },
          createElement(SelectTrigger, { width: "default" }, createElement(SelectValue)),
          createElement(SelectContent, null, createElement(SelectItem, { value: "long" }, "一个长度明显超过默认宽度的选择菜单条目")),
        ),
      );
      await Promise.resolve();
    });

    const content = document.querySelector<HTMLElement>("[data-slot='select-content']");
    const item = document.querySelector<HTMLElement>("[data-slot='select-item']");
    expect(content?.className).toContain("w-(--radix-select-trigger-width)");
    expect(item?.className).toContain("whitespace-nowrap");
    expect(item?.innerHTML).toContain("truncate");

    await act(async () => root.unmount());
  });
});
