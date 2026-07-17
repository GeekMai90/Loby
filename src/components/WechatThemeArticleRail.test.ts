// @vitest-environment happy-dom

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WECHAT_THEME_SAMPLE_PROJECT } from "../lib/publishing/wechatThemeSampleArticle";
import type { WritingProject } from "../types";
import { WechatThemeArticleRail } from "./WechatThemeArticleRail";

function createUserProject(): WritingProject {
  const sampleSheet = WECHAT_THEME_SAMPLE_PROJECT.sheets[0]!;
  return {
    ...WECHAT_THEME_SAMPLE_PROJECT,
    id: "user-project",
    title: "用户项目",
    sheets: Array.from({ length: 31 }, (_, index) => ({
      ...sampleSheet,
      id: `user-sheet-${index + 1}`,
      title: `用户文章 ${index + 1}`,
      summary: index === 0 ? "限定目标" : `文章摘要 ${index + 1}`,
      updatedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    })),
  };
}

function renderRail(search = "") {
  return renderToStaticMarkup(
    createElement(WechatThemeArticleRail, {
      projects: [WECHAT_THEME_SAMPLE_PROJECT, createUserProject()],
      activeSheetId: "",
      search,
      onSearchChange: vi.fn(),
      onSelect: vi.fn(),
    }),
  );
}

describe("WechatThemeArticleRail", () => {
  it("shows the built-in example and a flat, initially limited all-articles section", () => {
    const html = renderRail();

    expect(html).toContain(">示例文章</h2>");
    expect(html).toContain(">所有文章</h2>");
    expect(html).not.toContain(">用户项目</h2>");
    expect(html).toContain(">用户文章 31</strong>");
    expect(html).not.toContain(">用户文章 1</strong>");
    expect(html).toContain("显示更多");
  });

  it("searches the complete article collection beyond the initial limit", () => {
    const html = renderRail("限定目标");

    expect(html).toContain(">用户文章 1</strong>");
    expect(html).not.toContain("显示更多");
  });
});
