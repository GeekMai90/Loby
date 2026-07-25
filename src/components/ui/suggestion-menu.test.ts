// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest 与本地 SuggestionMenu primitives
 * [OUTPUT]: 验证建议菜单与 DropdownMenu 共用实体材质、菜单 Token、13px 条目和选中状态契约
 * [POS]: components/ui 的 SuggestionMenu 视觉与语义回归测试，防止输入建议浮层重新长出独立样式
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { SuggestionMenu, SuggestionMenuItem, SuggestionMenuLabel } from "./suggestion-menu";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("SuggestionMenu", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("shares the standard menu surface and active item tokens", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(
          SuggestionMenu,
          { "aria-label": "建议" },
          createElement(SuggestionMenuLabel, null, "文稿"),
          createElement(SuggestionMenuItem, {
            active: true,
            title: "测试文稿",
            description: "博客 / 待整理",
          }),
        ),
      );
    });

    const menu = container.querySelector<HTMLElement>("[data-slot='suggestion-menu']");
    const item = container.querySelector<HTMLButtonElement>("[data-slot='suggestion-menu-item']");
    expect(menu?.className).toContain("loby-solid-menu");
    expect(menu?.className).toContain("rounded-[var(--menu-radius)]");
    expect(menu?.className).toContain("p-[var(--menu-padding)]");
    expect(menu?.className).not.toContain("loby-glass-menu");
    expect(item?.className).toContain("text-app-base");
    expect(item?.className).toContain("rounded-[var(--menu-item-radius)]");
    expect(item?.dataset.active).toBe("true");
    expect(item?.getAttribute("aria-selected")).toBe("true");

    await act(async () => root.unmount());
  });

  it("keeps a single-line item vertically centered when no description exists", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(SuggestionMenuItem, { icon: createElement("svg"), title: "单行建议" }));
    });

    const icon = container.querySelector<HTMLElement>("[data-slot='suggestion-menu-item-icon']");
    expect(icon?.className).toContain("items-center");
    expect(icon?.className).not.toContain("row-span-2");

    await act(async () => root.unmount());
  });
});
