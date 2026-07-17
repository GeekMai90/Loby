// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { createPersonalWechatTheme } from "../lib/publishing/wechatThemeStore";
import { getWechatTheme, WECHAT_THEMES } from "../lib/publishing/wechatThemes";
import { WechatThemeCatalog } from "./WechatThemeCatalog";

describe("WechatThemeCatalog", () => {
  it("groups favorites, bundled templates and personal themes with synchronized selection", async () => {
    const personal = createPersonalWechatTheme(getWechatTheme("nibva-basic"), "我的主题");
    const onSelect = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(WechatThemeCatalog, {
          themes: [...WECHAT_THEMES, personal],
          selectedThemeId: "grace",
          preferences: { defaultThemeId: personal.id, favoriteThemeIds: ["grace", personal.id] },
          onSelect,
          onToggleFavorite: vi.fn(),
          onSetDefault: vi.fn(),
        }),
      );
    });

    expect(container.textContent).toContain("收藏");
    expect(container.textContent).toContain("系统自带");
    expect(container.textContent).toContain("用户自定义");
    expect(container.querySelectorAll('[data-theme-id="grace"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-theme-id="grace"][data-selected="true"]')).toHaveLength(2);
    expect(container.querySelector(`[data-theme-id="${personal.id}"]`)?.textContent).toContain("默认");
    expect(container.querySelectorAll(".lucide-palette").length).toBeGreaterThan(0);

    await act(async () => container.querySelector<HTMLButtonElement>('[data-theme-id="grace"] button[aria-pressed]')?.click());
    expect(onSelect).toHaveBeenCalledWith("grace");

    await act(async () => root.unmount());
  });

  it("hides an empty favorites section", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(WechatThemeCatalog, {
          themes: WECHAT_THEMES,
          selectedThemeId: "nibva-basic",
          preferences: { defaultThemeId: "nibva-basic", favoriteThemeIds: [] },
          onSelect: vi.fn(),
          onToggleFavorite: vi.fn(),
          onSetDefault: vi.fn(),
        }),
      );
    });

    expect(container.querySelector("#wechat-theme-section-favorites")).toBeNull();
    await act(async () => root.unmount());
  });
});
