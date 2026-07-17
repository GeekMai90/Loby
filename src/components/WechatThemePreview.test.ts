// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  resolveWechatMobileDeviceScale,
  resolveWechatThemePreviewHeight,
  WECHAT_MOBILE_DEVICE_FRAME,
  WECHAT_THEME_PREVIEW_FRAMES,
  type WechatThemePreviewViewport,
} from "../lib/publishing/wechatThemePreviewModel";
import { buildWechatPreviewDocument } from "../lib/publishing/wechatPreview";
import { getWechatTheme } from "../lib/publishing/wechatThemes";
import { WechatThemePreview } from "./WechatThemePreview";

function renderPreview(viewport: WechatThemePreviewViewport) {
  return renderToStaticMarkup(
    createElement(WechatThemePreview, {
      result: null,
      theme: getWechatTheme("nibva-basic"),
      busy: false,
      error: "",
      viewport,
      onViewportChange: vi.fn(),
    }),
  );
}

describe("WechatThemePreview", () => {
  it("renders the default mobile content inside the iPhone 17 Pro frame", () => {
    const html = renderPreview("mobile");

    expect(WECHAT_THEME_PREVIEW_FRAMES.mobile).toMatchObject({ width: 402, height: 874 });
    expect(html).toContain('data-preview-viewport="mobile"');
    expect(html).toContain('data-device-frame="iphone-17-pro-silver"');
    expect(html).toContain("iphone-17-pro-silver.svg");
    expect(html).toContain("iPhone 17 Pro 预览");
    expect(html).toContain("padding:64px 0 32px");
    expect(html).toContain("手机端预览");
    expect(html).toContain("function-segmented-tabs-with-labels");
    expect(html).toContain("top-3 left-1/2");
    expect(html).toContain('data-preview-color-scheme="light"');
    expect(html).toContain('aria-label="预览主题"');
    expect(html).toContain('aria-label="亮色预览"');
    expect(html).toContain('aria-label="暗色预览"');
    expect(html).toContain("right-4 bottom-4");
    expect(html).toContain("flex-1 overflow-hidden");
    expect(html).not.toContain("scrollbar-width:none");
    expect(html).not.toContain("缩小预览");
    expect(html).not.toContain("放大预览");
    expect(html).not.toContain("公众号兼容输出");
    expect(html).not.toContain("h-1.5 w-16");
  });

  it("renders a wider desktop content canvas and both viewport controls", () => {
    const html = renderPreview("desktop");

    expect(WECHAT_THEME_PREVIEW_FRAMES.desktop).toMatchObject({ width: 677, height: 760 });
    expect(html).toContain('data-preview-viewport="desktop"');
    expect(html).toContain('aria-label="手机端预览"');
    expect(html).toContain('aria-label="电脑端预览"');
    expect(html).toContain("电脑端预览");
    expect(html).toContain("padding:0px 0 0px");
    expect(html).not.toContain('data-device-frame="iphone-17-pro-silver"');
    expect(html).not.toContain('data-device-frame="macbook-pro-16"');
  });

  it("can reuse the preview surface as a rich text and HTML source switcher", () => {
    const html = renderToStaticMarkup(
      createElement(WechatThemePreview, {
        result: {
          title: "测试文章",
          html: '<section data-nibva-publish="wechat"><p>正文</p></section>',
          textCount: 2,
          readingMinutes: 1,
          compatibilityWarnings: [],
        },
        theme: getWechatTheme("nibva-basic"),
        busy: false,
        error: "",
        viewport: "mobile",
        onViewportChange: vi.fn(),
        contentMode: "html",
        onContentModeChange: vi.fn(),
      }),
    );

    expect(html).toContain('role="toolbar"');
    expect(html).toContain('aria-label="预览工具"');
    expect(html).toContain('aria-label="切换到富文本预览"');
    expect(html).toContain('aria-label="切换到暗色预览"');
    expect(html).toContain("wechat-preview-tool-rail");
    expect(html).toContain('data-preview-content="html"');
    expect(html).toContain("data-nibva-publish=&quot;wechat&quot;");
    expect(html).not.toContain('data-device-frame="iphone-17-pro-silver"');
    expect(html).not.toContain('aria-label="预览主题"');
  });

  it("fits the desktop content canvas within the available preview height", () => {
    expect(resolveWechatThemePreviewHeight(1000, 1, 760)).toBe(952);
    expect(resolveWechatThemePreviewHeight(600, 1, 760)).toBe(552);
    expect(resolveWechatThemePreviewHeight(0, 1, 760)).toBe(760);
  });

  it("keeps the iPhone 17 Pro frame at 100% when it fits and scales it down proportionally when needed", () => {
    expect(WECHAT_MOBILE_DEVICE_FRAME.sourceScreenWidth * WECHAT_MOBILE_DEVICE_FRAME.sourceScale).toBe(402);
    expect(WECHAT_MOBILE_DEVICE_FRAME.sourceScreenHeight * WECHAT_MOBILE_DEVICE_FRAME.sourceScale).toBe(874);
    expect(resolveWechatMobileDeviceScale(700, 1100)).toBe(1);
    expect(resolveWechatMobileDeviceScale(600, 800)).toBeCloseTo(752 / (2822 / 3));
    expect(resolveWechatMobileDeviceScale(0, 0)).toBe(1);
  });

  it("builds a preview-only dark appearance without changing the article HTML", () => {
    const articleHtml = '<section data-nibva-publish="wechat"><img src="cover.png" alt=""><p>正文</p></section>';
    const document = buildWechatPreviewDocument(articleHtml, "#ffffff", { colorScheme: "dark" });

    expect(document).toContain('data-wechat-preview-color-scheme="dark"');
    expect(document).toContain('<meta name="color-scheme" content="dark">');
    expect(document).toContain("body{filter:invert(1) hue-rotate(180deg);}");
    expect(document).toContain("img,video,canvas{filter:invert(1) hue-rotate(180deg);}");
    expect(document).toContain(articleHtml);
  });

  it("switches only the embedded preview documents to dark appearance", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(WechatThemePreview, {
          result: null,
          theme: getWechatTheme("nibva-basic"),
          busy: false,
          error: "",
          viewport: "mobile",
          onViewportChange: vi.fn(),
        }),
      );
    });
    const darkButton = container.querySelector<HTMLButtonElement>('[aria-label="暗色预览"]');
    expect(darkButton).not.toBeNull();

    await act(async () => darkButton?.click());

    expect(container.querySelector("main")?.getAttribute("data-preview-color-scheme")).toBe("dark");
    expect(container.querySelector("iframe")?.getAttribute("srcdoc")).toContain('data-wechat-preview-color-scheme="dark"');

    await act(async () => root.unmount());
    container.remove();
  });
});
