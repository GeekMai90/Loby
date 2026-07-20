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
loby:
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
      targetWords: 1800,
      summary: "导入摘要",
      body: "# 正文标题\n\n内容",
      properties: { 公众号发布: true, 渠道: ["微信", "博客"], 阶段: "构思", tags: [] },
    });
    expect(sheet).not.toHaveProperty("type");
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

  it("preserves malformed frontmatter as visible body content instead of dropping data", () => {
    const content = "---\ntitle: [未闭合\n---\n# 正文标题\n\n内容";
    const [sheet] = buildImportedMarkdownSheets([{ name: "broken.md", path: "/tmp/broken.md", sizeBytes: content.length, content }]);

    expect(sheet.title).toBe("正文标题");
    expect(sheet.body).toBe(content);
    expect(sheet.properties).toMatchObject({ 阶段: "构思", tags: [] });
  });

  it("keeps nested custom metadata while excluding app-owned frontmatter keys", () => {
    const [sheet] = buildImportedMarkdownSheets([
      {
        name: "reserved.md",
        path: "/tmp/reserved.md",
        sizeBytes: 200,
        content: `---
id: foreign-id
title: 保留字段测试
type: 不支持的类型
status: 不支持的状态
targetWords: not-a-number
createdAt: 2026-01-01
lobySheet: true
资料:
  来源: 采访
  权重: 3
---
正文`,
      },
    ]);

    expect(sheet).toMatchObject({
      title: "保留字段测试",
      status: "构思",
      targetWords: 1000,
      properties: { 资料: { 来源: "采访", 权重: 3 }, 阶段: "构思", tags: [] },
    });
    expect(sheet.id).not.toBe("foreign-id");
    expect(sheet.properties).not.toHaveProperty("id");
    expect(sheet.properties).not.toHaveProperty("lobySheet");
  });

  it("creates unique deterministic IDs for a large import batch in one clock tick", () => {
    const files = Array.from({ length: 500 }, (_, index) => ({
      name: `document-${index}.md`,
      path: `/tmp/document-${index}.md`,
      sizeBytes: 4,
      content: "正文",
    }));

    const sheets = buildImportedMarkdownSheets(files);

    expect(new Set(sheets.map((sheet) => sheet.id))).toHaveLength(500);
    expect(sheets[0]?.id).toBe("sheet-import-1783648800000-0");
    expect(sheets.at(-1)?.id).toBe("sheet-import-1783648800000-499");
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
      { id: "legacy-type", key: "type", label: "旧文稿类型", type: "select", defaultValue: "正文", locked: true },
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
