// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest 与本地 Select primitives
 * [OUTPUT]: 验证 Select 语义宽度、13px 字号 Token、Trigger/Content 默认等宽、内容自适应、独立宽度及超长条目截断契约
 * [POS]: components/ui 的 Select 视觉契约回归测试，防止宽度、字号或内容布局从共享 primitive 漂移
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
    expect(triggers.every((trigger) => trigger.className.includes("text-app-base"))).toBe(true);
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
    expect(item?.className).toContain("text-app-base");
    expect(item?.className).toContain("whitespace-nowrap");
    expect(item?.innerHTML).toContain("truncate");

    await act(async () => root.unmount());
  });

  it("lets a fit-content trigger use an independent popup width", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(
          Select,
          { open: true, value: "short", onValueChange: () => undefined, onOpenChange: () => undefined },
          createElement(SelectTrigger, { width: "fit" }, createElement(SelectValue)),
          createElement(
            SelectContent,
            { width: "default" },
            createElement(SelectItem, { value: "short" }, "短选项"),
            createElement(SelectItem, { value: "long" }, "一个长度明显更长的菜单选项"),
          ),
        ),
      );
      await Promise.resolve();
    });

    const trigger = container.querySelector<HTMLElement>("[data-slot='select-trigger']");
    const content = document.querySelector<HTMLElement>("[data-slot='select-content']");
    const viewport = content?.querySelector<HTMLElement>("[data-radix-select-viewport]");
    expect(trigger?.className).toContain("w-fit");
    expect(content?.dataset.width).toBe("default");
    expect(content?.className).toContain("w-44");
    expect(content?.className).not.toContain("w-(--radix-select-trigger-width)");
    expect(viewport?.className).not.toContain("min-w-(--radix-select-trigger-width)");

    await act(async () => root.unmount());
  });

  it("lets a fit popup grow from the trigger width to its complete item content", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(
          Select,
          { open: true, value: "system", onValueChange: () => undefined, onOpenChange: () => undefined },
          createElement(SelectTrigger, { width: "fit" }, createElement(SelectValue)),
          createElement(
            SelectContent,
            { width: "fit", align: "end" },
            createElement(SelectItem, { value: "system" }, "跟随系统"),
            createElement(SelectItem, { value: "light" }, "浅色"),
          ),
        ),
      );
      await Promise.resolve();
    });

    const content = document.querySelector<HTMLElement>("[data-slot='select-content']");
    const viewport = content?.querySelector<HTMLElement>("[data-radix-select-viewport]");
    expect(content?.dataset.width).toBe("fit");
    expect(content?.dataset.align).toBe("end");
    expect(content?.className).toContain("w-max");
    expect(content?.className).toContain("min-w-(--radix-select-trigger-width)");
    expect(content?.className).not.toContain("min-w-36");
    expect(viewport?.className).toContain("w-max");

    await act(async () => root.unmount());
  });
});
