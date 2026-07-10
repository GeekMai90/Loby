import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WritingProject } from "../types";
import { buildImportedMarkdownSheets, deriveImportedSheetTitle } from "./importMarkdown";

describe("importMarkdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T10:00:00+08:00"));
  });

  afterEach(() => vi.useRealTimers());

  it("parses frontmatter, removes it from the body, and keeps custom properties", () => {
    const [sheet] = buildImportedMarkdownSheets([
      {
        name: "fallback.md",
        path: "/tmp/fallback.md",
        sizeBytes: 120,
        content: `---
title: 导入标题
公众号发布: true
渠道:
  - 微信
  - 博客
nibva:
  type: 素材
  targetWords: 1800
  summary: 导入摘要
---
# 正文标题

内容`,
      },
    ]);

    expect(sheet).toMatchObject({
      title: "导入标题",
      type: "素材",
      targetWords: 1800,
      summary: "导入摘要",
      body: "# 正文标题\n\n内容",
      properties: { 公众号发布: true, 渠道: ["微信", "博客"], 阶段: "构思", tags: [] },
    });
  });

  it("applies project defaults before imported values override them", () => {
    const project = defaultsProject();
    const [withImportedValue, withDefaults] = buildImportedMarkdownSheets(
      [
        { name: "one.md", path: "/tmp/one.md", sizeBytes: 20, content: "---\n阶段: 完稿\n---\n正文" },
        { name: "two.md", path: "/tmp/two.md", sizeBytes: 6, content: "正文" },
      ],
      "group-main",
      project,
    );

    expect(withImportedValue.properties).toMatchObject({ 阶段: "完稿", tags: ["项目默认"] });
    expect(withDefaults.properties).toMatchObject({ 阶段: "选题", tags: ["项目默认"] });
    expect(withDefaults.targetWords).toBe(2400);
  });

  it("uses the first heading only when frontmatter has no title", () => {
    expect(deriveImportedSheetTitle("fallback.md", "---\ntags: [测试]\n---\n# 正文标题\n\n内容")).toBe("正文标题");
  });
});

function defaultsProject(): WritingProject {
  return {
    id: "project",
    title: "项目",
    description: "",
    status: "构思",
    targetPlatform: "未指定",
    targetWords: 2400,
    tags: [],
    groups: [{ id: "group-main", title: "正文" }],
    sheets: [],
    updatedAt: "2026-07-10 10:00:00",
    propertyDefinitions: [
      { id: "type", key: "type", label: "文稿类型", type: "select", defaultValue: "正文", locked: true },
      { id: "target", key: "targetWords", label: "目标字数", type: "number", defaultValue: 2400, locked: true },
      { id: "tags", key: "tags", label: "标签", type: "tags", defaultValue: ["项目默认"], locked: true },
      {
        id: "stage",
        key: "阶段",
        label: "阶段",
        type: "select",
        defaultValue: "选题",
        options: [
          { id: "topic", label: "选题" },
          { id: "done", label: "完稿" },
        ],
      },
    ],
  };
}
