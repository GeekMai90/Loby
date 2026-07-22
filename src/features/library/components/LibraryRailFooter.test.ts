// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest 与 LibraryRailFooter
 * [OUTPUT]: 验证导航栏底部的设置与主题控件契约
 * [POS]: library 导航 footer 的聚焦组件回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { LibraryRailFooter } from "@/features/library/components/LibraryRailFooter";

describe("LibraryRailFooter", () => {
  it("keeps Settings icon-only and places the theme control beside it", async () => {
    const onOpenSettings = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(LibraryRailFooter, {
          resolvedAppTheme: "light",
          onOpenSettings,
          onTemporaryAppThemeChange: vi.fn(),
        }),
      );
    });

    const settingsButton = container.querySelector<HTMLButtonElement>('button[aria-label="设置"]');
    expect(settingsButton?.textContent).toBe("");
    expect(settingsButton?.querySelector(".lucide-settings")).not.toBeNull();
    expect(container.querySelectorAll("button")).toHaveLength(2);
    expect(container.querySelector(".lucide-sun")).not.toBeNull();

    await act(async () => settingsButton?.click());
    expect(onOpenSettings).toHaveBeenCalledOnce();

    await act(async () => root.unmount());
  });
});
