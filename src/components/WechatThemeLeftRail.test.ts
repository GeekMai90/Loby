// @vitest-environment happy-dom

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getWechatTheme } from "../lib/publishing/wechatThemes";
import { WechatThemeLeftRail } from "./WechatThemeLeftRail";

function renderRail(view: "articles" | "styles") {
  return renderToStaticMarkup(
    createElement(WechatThemeLeftRail, {
      view,
      onViewChange: vi.fn(),
      projects: [],
      activeSheetId: "",
      search: "",
      onSearchChange: vi.fn(),
      onSelect: vi.fn(),
      baseStyle: getWechatTheme("loby-basic").baseStyle,
      onBaseStyleChange: vi.fn(),
    }),
  );
}

describe("WechatThemeLeftRail", () => {
  it("keeps article selection behind the article segment", () => {
    const html = renderRail("articles");
    expect(html).toContain("搜索文章");
    expect(html).toContain('class="function-segmented-tabs function-segmented-tabs-with-labels"');
    expect(html).toContain('aria-label="样式"');
    expect(html).not.toContain("正文行高");
  });

  it("shows only universal manual theme controls in the style segment", () => {
    const html = renderRail("styles");
    expect(html).toContain("文章标题");
    expect(html).toContain("正文行高");
    expect(html).toContain("主题色");
    expect(html).toContain("内容左右留白");
    expect(html).not.toContain("品牌信息");
    expect(html).not.toContain("模块样式");
  });
});
