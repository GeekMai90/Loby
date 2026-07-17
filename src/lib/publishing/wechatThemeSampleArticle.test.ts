// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { renderWechatArticle } from "./wechatRenderer";
import {
  WECHAT_THEME_SAMPLE_PROJECT,
  WECHAT_THEME_SAMPLE_PROJECT_ID,
  WECHAT_THEME_SAMPLE_SHEET_ID,
  withWechatThemeSampleArticle,
} from "./wechatThemeSampleArticle";

describe("wechat theme sample article", () => {
  it("injects the built-in sample without mutating or duplicating library projects", () => {
    const existing = { ...WECHAT_THEME_SAMPLE_PROJECT, id: "existing-project", title: "现有项目" };
    const projects = [existing, WECHAT_THEME_SAMPLE_PROJECT];
    const result = withWechatThemeSampleArticle(projects);

    expect(result).not.toBe(projects);
    expect(result[0]?.id).toBe(WECHAT_THEME_SAMPLE_PROJECT_ID);
    expect(result.filter((project) => project.id === WECHAT_THEME_SAMPLE_PROJECT_ID)).toHaveLength(1);
    expect(projects).toHaveLength(2);
    expect(result[0]?.title).toBe("示例文章");
  });

  it("renders a restrained long-form article across the supported theme elements", async () => {
    const sheet = WECHAT_THEME_SAMPLE_PROJECT.sheets.find((item) => item.id === WECHAT_THEME_SAMPLE_SHEET_ID);
    expect(sheet).toBeDefined();

    const result = await renderWechatArticle({
      title: sheet!.title,
      markdown: sheet!.body,
      tags: WECHAT_THEME_SAMPLE_PROJECT.tags,
      themeId: "nibva-basic",
    });

    expect(result.title).toBe("把生活重新调回自己的节奏");
    expect(sheet!.summary).toBe("");
    expect(result.html).not.toContain("真正稳定的节奏，不是把日程塞满");
    expect(result.html).not.toContain("article-summary");
    expect(result.html).toContain("在忙碌的齿轮之间，为自己的时间放下一枚锚");
    const images = Array.from(new DOMParser().parseFromString(result.html, "text/html").querySelectorAll<HTMLImageElement>("img"));
    expect(images[0]?.src).toMatch(/^data:image\/jpeg;base64,/);
    expect(images[0]?.src).not.toContain("wechat-theme-sample-cover");
    expect(result.html).toContain("安静的书桌、窗户与一张简短的计划表");
    expect(result.html).toContain("data:image/svg+xml");
    expect(result.html).toContain("<blockquote");
    expect(result.html).toContain("<table");
    expect(result.html).toContain("<pre");
    expect(result.html).toContain("<mark");
    expect(result.html).toContain("Deep Work");
    expect(result.html).not.toContain("<h1");
    expect(result.readingMinutes).toBeGreaterThanOrEqual(4);
  });
});
