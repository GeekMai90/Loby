/**
 * [INPUT]: 依赖 React DOM 测试运行时与应用级 TooltipProvider
 * [OUTPUT]: 验证自动 Tooltip 能接管 Portal 按钮，并清除普通文字的原生 title
 * [POS]: components/animate-ui 的 Tooltip 按钮接管契约回归，覆盖设置 Dialog 等 Portal 表面
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { TooltipProvider } from "./tooltip";

describe("TooltipProvider autoTargets", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("takes over native titles rendered outside the app shell", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(TooltipProvider, {
          autoTargets: true,
          openDelay: 0,
          closeDelay: 0,
          children: createElement("div"),
        }),
      );
      await Promise.resolve();
    });

    const portalButton = document.createElement("button");
    portalButton.title = "关闭设置";
    document.body.append(portalButton);

    await act(async () => {
      portalButton.dispatchEvent(new Event("pointerover", { bubbles: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(portalButton.hasAttribute("title")).toBe(false);
    expect(portalButton.dataset.tooltip).toBe("关闭设置");
    expect(portalButton.getAttribute("aria-label")).toBe("关闭设置");

    await act(async () => root.unmount());
  });

  it("removes native titles from ordinary text without creating a tooltip", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(TooltipProvider, {
          autoTargets: true,
          openDelay: 0,
          closeDelay: 0,
          children: createElement("div"),
        }),
      );
      await Promise.resolve();
    });

    const label = document.createElement("p");
    label.title = "Every封面图";
    document.body.append(label);

    await act(async () => {
      label.dispatchEvent(new Event("pointerover", { bubbles: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(label.hasAttribute("title")).toBe(false);
    expect(label.dataset.tooltip).toBeUndefined();
    expect(document.querySelector("[data-slot='tooltip-content']")).toBeNull();

    await act(async () => root.unmount());
  });
});
