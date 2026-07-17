// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WECHAT_THEME_SAMPLE_PROJECT } from "../lib/publishing/wechatThemeSampleArticle";
import { getWechatTheme, type WechatThemeManifest } from "../lib/publishing/wechatThemes";
import { WechatPublishDialog } from "./WechatPublishDialog";

const { copyWechatHtmlMock, loadWechatThemeStoreMock, openWechatThemeStudioMock, renderWechatArticleMock } = vi.hoisted(() => ({
  copyWechatHtmlMock: vi.fn(),
  loadWechatThemeStoreMock: vi.fn(),
  openWechatThemeStudioMock: vi.fn(),
  renderWechatArticleMock: vi.fn(),
}));

vi.mock("../lib/publishing/wechatRenderer", () => ({
  copyWechatHtml: copyWechatHtmlMock,
  renderWechatArticle: renderWechatArticleMock,
}));

vi.mock("../lib/publishing/wechatThemeStore", () => ({
  loadWechatThemeStore: loadWechatThemeStoreMock,
  openWechatThemeStudio: openWechatThemeStudioMock,
  WECHAT_SELECTED_THEME_STORAGE_KEY: "nibva.publish.wechat.theme",
}));

const selectedTheme: WechatThemeManifest = {
  ...getWechatTheme("deep-blue-study"),
  id: "theme-selected-personal",
  kind: "personal",
  name: "当前个人主题",
  description: "这段说明不应出现在主题列表中",
  baseStyle: {
    ...getWechatTheme("deep-blue-study").baseStyle,
    colors: {
      ...getWechatTheme("deep-blue-study").baseStyle.colors,
      accent: "#FF3366",
    },
  },
};

describe("WechatPublishDialog", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    loadWechatThemeStoreMock.mockResolvedValue({
      schemaVersion: 1,
      themes: [selectedTheme],
      revisions: {},
      redos: {},
      conversations: {},
      activeConversationIds: {},
    });
    renderWechatArticleMock.mockResolvedValue({
      title: "示例文章",
      html: '<section data-nibva-publish="wechat"><p>正文</p></section>',
      textCount: 2,
      readingMinutes: 1,
      compatibilityWarnings: [],
    });
  });

  it("loads the saved personal theme before the first preview render", async () => {
    localStorage.setItem("nibva.publish.wechat.theme", selectedTheme.id);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(WechatPublishDialog, {
          open: true,
          project: WECHAT_THEME_SAMPLE_PROJECT,
          sheet: WECHAT_THEME_SAMPLE_PROJECT.sheets[0]!,
          libraryPath: "/tmp/nibva-library",
          onClose: vi.fn(),
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(renderWechatArticleMock).toHaveBeenCalledTimes(1);
    expect(renderWechatArticleMock.mock.calls[0]?.[0]).toMatchObject({
      themeId: selectedTheme.id,
      theme: { id: selectedTheme.id, baseStyle: { colors: { accent: "#FF3366" } } },
    });
    expect(document.body.textContent).toContain("主题");
    expect(document.body.textContent).toContain("当前个人主题");
    expect(document.body.textContent).not.toContain("选择版式");
    expect(document.body.textContent).not.toContain("使用方法");
    expect(document.body.textContent).not.toContain(selectedTheme.description);
    const themeButtons = document.querySelectorAll<HTMLButtonElement>("[data-wechat-publish-dialog] aside button[aria-pressed]");
    const selectedThemeButton = document.querySelector<HTMLButtonElement>(
      "[data-wechat-publish-dialog] aside button[data-selected='true']",
    );
    expect(themeButtons).toHaveLength(3);
    expect(selectedThemeButton?.textContent).toContain(selectedTheme.name);
    expect(selectedThemeButton?.getAttribute("aria-pressed")).toBe("true");
    expect(selectedThemeButton?.className).toContain("bg-primary");
    expect(selectedThemeButton?.className).toContain("text-primary-foreground");
    expect(selectedThemeButton?.querySelector(".lucide-check")).toBeNull();
    expect(document.activeElement).not.toBe(themeButtons[0]);
    expect(document.querySelector("[data-wechat-publish-dialog]")?.className).toContain("w-[min(1420px,calc(100vw-24px))]");
    expect(document.querySelector("[data-wechat-publish-dialog]")?.className).toContain("h-[min(1224px,calc(100vh-16px))]");
    expect(document.body.textContent).toContain("主题管理");
    const previewActions = document.querySelector("[data-wechat-preview-actions]");
    expect(previewActions).not.toBeNull();
    expect(previewActions?.querySelector("[data-wechat-copy-button='icon']")?.className).toContain("liquid-glass-button");
    expect(previewActions?.querySelector("[data-wechat-close-button]")?.className).toContain("liquid-glass-button");
    expect(previewActions?.textContent).not.toContain("复制排版");
    expect(document.querySelector("[data-slot='dialog-content'] > header")).toBeNull();
    expect(document.querySelector("[data-slot='dialog-content'] > footer")).toBeNull();
    expect(document.querySelector('[aria-label="手机端预览"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="电脑端预览"]')).not.toBeNull();
    const previewToolbar = document.querySelector('[role="toolbar"][aria-label="预览工具"]');
    expect(previewToolbar?.className).toContain("wechat-preview-tool-rail");
    expect(previewToolbar?.querySelectorAll("button")).toHaveLength(2);
    expect(document.querySelector('[aria-label="切换到 HTML 源码"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="切换到暗色预览"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="富文本预览"]')).toBeNull();
    expect(document.querySelector('[aria-label="亮色预览"]')).toBeNull();

    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="切换到暗色预览"]')?.click());
    expect(document.querySelector("main")?.getAttribute("data-preview-color-scheme")).toBe("dark");
    expect(document.querySelector('[aria-label="切换到亮色预览"]')).not.toBeNull();

    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="切换到 HTML 源码"]')?.click());
    expect(document.querySelector('[data-preview-content="html"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="切换到富文本预览"]')).not.toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });
});
