import { describe, expect, it } from "vitest";
import type { WritingProject, WritingSheet } from "../types";
import { buildLobyWritingStructureContext } from "./lobyWritingContext";

describe("lobyWritingContext", () => {
  it("summarizes the current writing structure for Codex", () => {
    const sheetA = sheet({
      id: "sheet-a",
      title: "开头",
      groupId: "group-main",
      body: "第一段",
      summary: "说明文章开场。",
      targetWords: 10,
    });
    const sheetB = sheet({
      id: "sheet-b",
      title: "案例",
      groupId: "group-research",
      type: "素材",
      status: "修改中",
      body: "案例正文",
      summary: "用于支撑核心观点。",
      targetWords: 20,
    });
    const context = buildLobyWritingStructureContext(project([sheetA, sheetB]), sheetB);

    expect(context).toContain("### 当前写作结构");
    expect(context).toContain("项目进度：7 / 1200 字（1%）");
    expect(context).toContain("当前文稿：案例；类型：素材；字数：4 / 20；分组：素材");
    expect(context).toContain("- 正文（1 篇 / 3 字）");
    expect(context).toContain("  - 开头 · 正文 · 3/10 字 · 说明文章开场。");
    expect(context).toContain("- 素材（1 篇 / 4 字）");
    expect(context).toContain("  - ★ 案例 · 素材 · 4/20 字 · 用于支撑核心观点。");
    expect(context).toContain("不要假设需要修改其他文稿");
  });

  it("truncates long summaries and caps sheet lists", () => {
    const sheets = Array.from({ length: 4 }, (_, index) =>
      sheet({
        id: `sheet-${index}`,
        title: `文稿 ${index}`,
        groupId: "group-main",
        summary: index === 0 ? "这是一段很长的摘要".repeat(10) : "",
      }),
    );
    const context = buildLobyWritingStructureContext(project(sheets), sheets[0], { maxSheets: 2 });

    expect(context).toContain("这是一段很长的摘要这是一段很长的摘要");
    expect(context).toContain("...");
    expect(context).toContain("- 另有 2 篇未列出");
    expect(context).not.toContain("文稿 3 ·");
  });
});

function sheet(overrides: Partial<WritingSheet>): WritingSheet {
  return {
    id: "sheet",
    title: "文稿",
    groupId: "group-main",
    type: "正文",
    status: "构思",
    targetWords: 1000,
    summary: "",
    body: "正文",
    updatedAt: "2026-07-09",
    ...overrides,
  };
}

function project(sheets: WritingSheet[]): WritingProject {
  return {
    id: "project-1",
    title: "项目",
    description: "",
    status: "构思",
    targetPlatform: "公众号",
    targetWords: 1200,
    tags: [],
    groups: [
      { id: "group-main", title: "正文" },
      { id: "group-research", title: "素材" },
    ],
    sheets,
    updatedAt: "2026-07-09",
  };
}
