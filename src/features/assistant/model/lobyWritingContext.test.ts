import { describe, expect, it } from "vitest";
import type { WritingProject, WritingSheet } from "@/shared/types";
import { buildLobyWritingStructureContext } from "@/features/assistant/model/lobyWritingContext";

describe("lobyWritingContext", () => {
  it("summarizes the current writing structure for the Agent", () => {
    const sheetA = sheet({
      id: "sheet-a",
      title: "开头",
      groupId: "group-main",
      body: "第一段",
      description: "说明文章开场。",
      targetWords: 10,
    });
    const sheetB = sheet({
      id: "sheet-b",
      title: "案例",
      groupId: "group-research",
      body: "案例正文",
      description: "用于支撑核心观点。",
      targetWords: 20,
    });
    const context = buildLobyWritingStructureContext(project([sheetA, sheetB]), sheetB);

    expect(context).toContain("### 当前写作结构");
    expect(context).toContain("项目总字数：7 字");
    expect(context).toContain("当前文稿：案例；字数：4 / 20；分组：素材");
    expect(context).toContain("- 正文（1 篇 / 3 字）");
    expect(context).toContain("  - 开头 · 3/10 字 · 说明文章开场。");
    expect(context).toContain("- 素材（1 篇 / 4 字）");
    expect(context).toContain("  - ★ 案例 · 4/20 字 · 用于支撑核心观点。");
    expect(context).toContain("不要假设需要修改其他文稿");
  });

  it("truncates long summaries and caps sheet lists", () => {
    const sheets = Array.from({ length: 4 }, (_, index) =>
      sheet({
        id: `sheet-${index}`,
        title: `文稿 ${index}`,
        groupId: "group-main",
        description: index === 0 ? "这是一段很长的摘要".repeat(10) : "",
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
    tags: [],
    targetWords: 1000,
    description: "",
    body: "正文",
    createdAt: "2026-07-09",
    updatedAt: "2026-07-09",
    properties: {},
    ...overrides,
  };
}

function project(sheets: WritingSheet[]): WritingProject {
  return {
    id: "project-1",
    title: "项目",
    status: "构思",
    projectGoal: { enabled: false, unit: "words", target: 0 },
    groups: [
      { id: "group-main", title: "正文" },
      { id: "group-research", title: "素材" },
    ],
    sheets,
    updatedAt: "2026-07-09",
  };
}
