// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WECHAT_THEME_SAMPLE_PROJECT } from "@/features/publishing/model/wechatThemeSampleArticle";
import { getWechatTheme, type WechatThemeManifest } from "@/features/publishing/model/wechatThemes";
import { WechatPublishDialog } from "@/features/publishing/components/WechatPublishDialog";

const {
  copyWechatHtmlMock,
  loadWechatImageHostSettingsMock,
  loadWechatThemeStoreMock,
  openWechatThemeStudioMock,
  renderWechatArticleMock,
  saveWechatThemePreferencesMock,
  uploadWechatImagesMock,
} = vi.hoisted(() => ({
  copyWechatHtmlMock: vi.fn(),
  loadWechatImageHostSettingsMock: vi.fn(),
  loadWechatThemeStoreMock: vi.fn(),
  openWechatThemeStudioMock: vi.fn(),
  renderWechatArticleMock: vi.fn(),
  saveWechatThemePreferencesMock: vi.fn(),
  uploadWechatImagesMock: vi.fn(),
}));

vi.mock("@/features/publishing/model/wechatRenderer", () => ({
  copyWechatHtml: copyWechatHtmlMock,
  renderWechatArticle: renderWechatArticleMock,
}));

vi.mock("@/features/publishing/model/wechatThemeStore", () => ({
  loadWechatThemeStore: loadWechatThemeStoreMock,
  openWechatThemeStudio: openWechatThemeStudioMock,
  saveWechatThemePreferences: saveWechatThemePreferencesMock,
}));

vi.mock("@/features/publishing/model/wechatImageHost", () => ({
  loadWechatImageHostSettings: loadWechatImageHostSettingsMock,
  uploadWechatImages: uploadWechatImagesMock,
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (source: string) => `asset://${source}`,
}));

const selectedTheme: WechatThemeManifest = {
  ...getWechatTheme("loby-basic"),
  id: "theme-selected-personal",
  kind: "personal",
  name: "当前个人主题",
  description: "这段说明不应出现在主题列表中",
  baseStyle: {
    ...getWechatTheme("loby-basic").baseStyle,
    colors: {
      ...getWechatTheme("loby-basic").baseStyle.colors,
      accent: "#FF3366",
    },
  },
};

const currentProject = {
  ...WECHAT_THEME_SAMPLE_PROJECT,
  id: "current-project",
  title: "当前项目",
  sheets: [
    {
      ...WECHAT_THEME_SAMPLE_PROJECT.sheets[0]!,
      id: "current-sheet",
      title: "当前用户文章",
      body: "# 当前用户文章\n\n这是用户当前选择的文章。",
    },
  ],
};

describe("WechatPublishDialog", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    loadWechatThemeStoreMock.mockResolvedValue({
      schemaVersion: 2,
      themes: [selectedTheme],
      revisions: {},
      redos: {},
      conversations: {},
      activeConversationIds: {},
      preferences: { defaultThemeId: selectedTheme.id, favoriteThemeIds: [] },
    });
    renderWechatArticleMock.mockResolvedValue({
      title: "示例文章",
      html: '<section data-loby-publish="wechat"><p>正文</p></section>',
      textCount: 2,
      readingMinutes: 1,
      compatibilityWarnings: [],
    });
    loadWechatImageHostSettingsMock.mockResolvedValue({
      settings: {
        region: "oss-cn-hangzhou",
        bucket: "example-bucket",
        accessKeyId: "LTAI-test",
        customDomain: "",
        objectPrefix: "wechat",
      },
      hasAccessKeySecret: true,
      configured: true,
    });
  });

  it("loads the default personal theme before the first preview render", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(WechatPublishDialog, {
          open: true,
          project: currentProject,
          sheet: currentProject.sheets[0]!,
          libraryPath: "/tmp/loby-library",
          onClose: vi.fn(),
          onOpenImageHostingSettings: vi.fn(),
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(renderWechatArticleMock).toHaveBeenCalledTimes(1);
    expect(renderWechatArticleMock.mock.calls[0]?.[0]).toMatchObject({
      title: "当前用户文章",
      themeId: selectedTheme.id,
      theme: { id: selectedTheme.id, baseStyle: { colors: { accent: "#FF3366" } } },
    });
    expect(document.body.textContent).toContain("主题");
    expect(document.body.textContent).toContain("系统自带");
    expect(document.body.textContent).toContain("自定义");
    expect(document.body.textContent).toContain("当前个人主题");
    expect(document.body.textContent).not.toContain("选择版式");
    expect(document.body.textContent).not.toContain("使用方法");
    expect(document.body.textContent).not.toContain(selectedTheme.description);
    const themeButtons = document.querySelectorAll<HTMLButtonElement>("[data-wechat-publish-dialog] aside button[aria-pressed]");
    const selectedThemeCard = document.querySelector<HTMLElement>(
      "[data-wechat-publish-dialog] aside [data-theme-id][data-selected='true']",
    );
    expect(themeButtons).toHaveLength(5);
    expect(selectedThemeCard?.textContent).toContain(selectedTheme.name);
    expect(selectedThemeCard?.className).toContain("bg-[var(--navigation-selection-active-bg)]");
    expect(selectedThemeCard?.className).toContain("text-primary-foreground");
    expect(selectedThemeCard?.querySelector(".lucide-check")).toBeNull();
    expect(document.activeElement).not.toBe(themeButtons[0]);
    expect(document.querySelector("[data-wechat-publish-dialog]")?.className).toContain("w-[min(1120px,calc(100vw-24px))]");
    expect(document.querySelector("[data-wechat-publish-dialog]")?.className).toContain("h-[min(1224px,calc(100vh-16px))]");
    expect(document.querySelector("[data-wechat-publish-dialog]")?.hasAttribute("data-app-tooltip-scope")).toBe(true);
    expect(document.querySelector("[data-wechat-publish-dialog] aside")?.className).toContain("bg-background");
    expect(document.querySelector("[data-wechat-publish-dialog] aside")?.className).toContain("border-[var(--separator)]");
    expect(document.body.textContent).toContain("主题管理");
    const previewActions = document.querySelector("[data-wechat-preview-actions]");
    expect(previewActions).not.toBeNull();
    expect(previewActions?.querySelector("[data-wechat-image-host-button]")).not.toBeNull();
    expect(previewActions?.querySelector("[data-wechat-copy-button='icon']")?.getAttribute("data-slot")).toBe("button");
    expect(previewActions?.querySelector("[data-wechat-close-button]")?.getAttribute("data-variant")).toBe("ghost");
    expect(previewActions?.querySelector(".liquid-glass-button")).toBeNull();
    expect(previewActions?.textContent).not.toContain("复制排版");
    expect(document.querySelector("[data-slot='dialog-content'] > header")).toBeNull();
    expect(document.querySelector("[data-slot='dialog-content'] > footer")).toBeNull();
    expect(document.querySelector('[aria-label="手机端预览"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="电脑端预览"]')).not.toBeNull();
    const previewToolbar = document.querySelector('[role="toolbar"][aria-label="预览工具"]');
    expect(previewToolbar?.className).toContain("wechat-preview-tool-rail");
    expect(previewToolbar?.querySelectorAll("button")).toHaveLength(3);
    expect(document.querySelector('[aria-label="使用示例文章预览"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="切换到 HTML 源码"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="切换到 HTML 源码"] .lucide-newspaper')).not.toBeNull();
    expect(document.querySelector('[aria-label="切换到暗色预览"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="富文本预览"]')).toBeNull();
    expect(document.querySelector('[aria-label="亮色预览"]')).toBeNull();

    await act(async () => {
      document.querySelector<HTMLButtonElement>('[aria-label="使用示例文章预览"]')?.click();
      await Promise.resolve();
    });
    expect(renderWechatArticleMock.mock.calls.at(-1)?.[0]).toMatchObject({ title: "把生活重新调回自己的节奏" });
    expect(document.querySelector('[aria-label="恢复当前文章预览"]')?.getAttribute("aria-pressed")).toBe("true");

    await act(async () => {
      document.querySelector<HTMLButtonElement>('[aria-label="恢复当前文章预览"]')?.click();
      await Promise.resolve();
    });
    expect(renderWechatArticleMock.mock.calls.at(-1)?.[0]).toMatchObject({ title: "当前用户文章" });

    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="切换到暗色预览"]')?.click());
    expect(document.querySelector("main")?.getAttribute("data-preview-color-scheme")).toBe("dark");
    expect(document.querySelector('[aria-label="切换到亮色预览"]')).not.toBeNull();

    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="切换到 HTML 源码"]')?.click());
    expect(document.querySelector('[data-preview-content="html"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="切换到富文本预览"]')).not.toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });

  it("uploads local images and rerenders the copied layout with remote urls", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    const projectWithImages = {
      ...currentProject,
      sheets: [
        {
          ...currentProject.sheets[0]!,
          body: "# 当前用户文章\n\n![本地图](cover.png)\n\n![远程图](https://example.com/remote.png)",
        },
      ],
    };
    uploadWechatImagesMock.mockImplementation(async (images: Array<{ source: string }>) =>
      images.map((image) => ({ source: image.source, url: "https://img.example.com/wechat/cover.png" })),
    );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(WechatPublishDialog, {
          open: true,
          project: projectWithImages,
          sheet: projectWithImages.sheets[0]!,
          libraryPath: "/tmp/loby-library",
          onClose: vi.fn(),
          onOpenImageHostingSettings: vi.fn(),
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-wechat-image-host-button]")?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(uploadWechatImagesMock).toHaveBeenCalledTimes(1);
    expect(uploadWechatImagesMock.mock.calls[0]?.[0]).toHaveLength(1);
    expect(renderWechatArticleMock.mock.calls.at(-1)?.[0].markdown).toContain("https://img.example.com/wechat/cover.png");
    expect(renderWechatArticleMock.mock.calls.at(-1)?.[0].markdown).toContain("https://example.com/remote.png");
    expect(document.querySelector("[data-wechat-image-host-button]")?.getAttribute("aria-label")).toContain("已上传 1 张图片");

    await act(async () => root.unmount());
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    container.remove();
  });
});
