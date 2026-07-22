// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React 服务端渲染、Vitest、公众号主题模型与 WechatThemeLeftRail
 * [OUTPUT]: 验证 Animate UI Tabs 只显示当前主题工作视图对应的左栏内容
 * [POS]: publishing 的主题工作室左栏回归测试，保护文章与样式视图的边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getWechatTheme } from "@/features/publishing/model/wechatThemes";
import { WechatThemeLeftRail } from "@/features/publishing/components/WechatThemeLeftRail";

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
    expect(html).toContain('data-slot="tabs-list"');
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
