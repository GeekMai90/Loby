// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest 与 LibraryRailFooter
 * [OUTPUT]: 验证导航栏底部设置/主题/帮助菜单及可用更新替换入口的交互契约
 * [POS]: library 导航 footer 的聚焦组件回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { LibraryRailFooter } from "@/features/library/components/LibraryRailFooter";

describe("LibraryRailFooter", () => {
  it("keeps settings and theme controls, then exposes the four help menu actions on the right", async () => {
    const onOpenSettings = vi.fn();
    const onOpenNewFeatures = vi.fn();
    const onOpenKeyboardShortcuts = vi.fn();
    const onOpenHelp = vi.fn();
    const onCheckForUpdates = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(LibraryRailFooter, {
          resolvedAppTheme: "light",
          updateAvailable: false,
          updateBusy: false,
          updateInstalling: false,
          updateProgress: null,
          availableVersion: "",
          onOpenSettings,
          onOpenNewFeatures,
          onOpenKeyboardShortcuts,
          onOpenHelp,
          onCheckForUpdates,
          onInstallUpdate: vi.fn(),
          onTemporaryAppThemeChange: vi.fn(),
        }),
      );
    });

    const settingsButton = container.querySelector<HTMLButtonElement>('button[aria-label="设置"]');
    expect(settingsButton?.textContent).toBe("");
    expect(settingsButton?.dataset.surface).toBe("default");
    expect(settingsButton?.dataset.size).toBe("icon-sm");
    expect(settingsButton?.querySelector(".lucide-settings")?.classList.contains("size-3.5")).toBe(true);
    expect(container.querySelectorAll("button")).toHaveLength(3);
    const themeButton = container.querySelector<HTMLButtonElement>('button[aria-label^="当前为"]');
    expect(themeButton?.dataset.surface).toBe("default");
    expect(themeButton?.dataset.size).toBe("icon-sm");
    expect(themeButton?.querySelector(".lucide-sun")?.classList.contains("size-3.5")).toBe(true);
    const helpButton = container.querySelector<HTMLButtonElement>('button[aria-label="帮助"]');
    expect(helpButton?.classList.contains("ml-auto")).toBe(true);
    expect(helpButton?.querySelector("svg")?.classList.contains("size-3.5")).toBe(true);

    await act(async () => {
      helpButton?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
      await Promise.resolve();
    });
    const menuItems = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    expect(menuItems.map((item) => item.textContent?.trim())).toEqual(["新功能", "键盘快捷键", "帮助", "检查更新"]);

    await act(async () => menuItems[1]?.click());
    expect(onOpenKeyboardShortcuts).toHaveBeenCalledOnce();

    await act(async () => settingsButton?.click());
    expect(onOpenSettings).toHaveBeenCalledOnce();

    await act(async () => root.unmount());
  });

  it("replaces the help menu with a primary download button when an update is available", async () => {
    const onInstallUpdate = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(LibraryRailFooter, {
          resolvedAppTheme: "dark",
          updateAvailable: true,
          updateBusy: false,
          updateInstalling: false,
          updateProgress: null,
          availableVersion: "0.2.0",
          onOpenSettings: vi.fn(),
          onOpenNewFeatures: vi.fn(),
          onOpenKeyboardShortcuts: vi.fn(),
          onOpenHelp: vi.fn(),
          onCheckForUpdates: vi.fn(),
          onInstallUpdate,
          onTemporaryAppThemeChange: vi.fn(),
        }),
      );
    });

    expect(container.querySelector('[aria-label="帮助"]')).toBeNull();
    const updateButton = container.querySelector<HTMLButtonElement>('[data-update-available="true"]');
    expect(updateButton?.classList.contains("text-primary")).toBe(true);
    expect(updateButton?.querySelector(".lucide-download")?.classList.contains("size-3.5")).toBe(true);
    expect(updateButton?.getAttribute("aria-label")).toBe("下载并安装落笔 0.2.0");

    await act(async () => updateButton?.click());
    expect(onInstallUpdate).toHaveBeenCalledOnce();

    await act(async () => root.unmount());
  });
});
