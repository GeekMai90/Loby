// @vitest-environment happy-dom

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  resolveWechatThemePreviewHeight,
  WECHAT_THEME_PREVIEW_FRAMES,
  type WechatThemePreviewViewport,
} from "../lib/publishing/wechatThemePreviewModel";
import { getWechatTheme } from "../lib/publishing/wechatThemes";
import { WechatThemePreview } from "./WechatThemePreview";

function renderPreview(viewport: WechatThemePreviewViewport) {
  return renderToStaticMarkup(
    createElement(WechatThemePreview, {
      result: null,
      theme: getWechatTheme("deep-blue-study"),
      busy: false,
      error: "",
      viewport,
      onViewportChange: vi.fn(),
    }),
  );
}

describe("WechatThemePreview", () => {
  it("renders the default mobile content canvas without device chrome", () => {
    const html = renderPreview("mobile");

    expect(WECHAT_THEME_PREVIEW_FRAMES.mobile).toMatchObject({ width: 390, height: 760 });
    expect(html).toContain('data-preview-viewport="mobile"');
    expect(html).toContain("手机端预览");
    expect(html).toContain("function-segmented-tabs-with-labels");
    expect(html).toContain("top-3 left-1/2");
    expect(html).toContain("flex-1 overflow-hidden");
    expect(html).not.toContain("scrollbar-width:none");
    expect(html).not.toContain("缩小预览");
    expect(html).not.toContain("放大预览");
    expect(html).not.toContain("公众号兼容输出");
    expect(html).not.toContain("rounded-[30px]");
    expect(html).not.toContain("h-1.5 w-16");
  });

  it("renders a wider desktop content canvas and both viewport controls", () => {
    const html = renderPreview("desktop");

    expect(WECHAT_THEME_PREVIEW_FRAMES.desktop).toMatchObject({ width: 820, height: 760 });
    expect(html).toContain('data-preview-viewport="desktop"');
    expect(html).toContain('aria-label="手机端预览"');
    expect(html).toContain('aria-label="电脑端预览"');
    expect(html).toContain("电脑端预览");
  });

  it("fits the content canvas within the available preview height", () => {
    expect(resolveWechatThemePreviewHeight(858, 0.9, 760)).toBe(855);
    expect(resolveWechatThemePreviewHeight(600, 0.9, 760)).toBe(568);
    expect(resolveWechatThemePreviewHeight(0, 0.9, 760)).toBe(760);
  });
});
