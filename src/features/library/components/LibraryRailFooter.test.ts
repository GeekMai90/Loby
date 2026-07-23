// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest 与 LibraryRailFooter
 * [OUTPUT]: 验证导航栏底部设置与主题控件的统一图标按钮契约
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
    expect(settingsButton?.dataset.surface).toBe("default");
    expect(settingsButton?.dataset.size).toBe("icon-sm");
    expect(settingsButton?.querySelector(".lucide-settings")?.classList.contains("size-3.5")).toBe(true);
    expect(container.querySelectorAll("button")).toHaveLength(2);
    const themeButton = container.querySelector<HTMLButtonElement>('button[aria-label^="当前为"]');
    expect(themeButton?.dataset.surface).toBe("default");
    expect(themeButton?.dataset.size).toBe("icon-sm");
    expect(themeButton?.querySelector(".lucide-sun")?.classList.contains("size-3.5")).toBe(true);

    await act(async () => settingsButton?.click());
    expect(onOpenSettings).toHaveBeenCalledOnce();

    await act(async () => root.unmount());
  });
});
