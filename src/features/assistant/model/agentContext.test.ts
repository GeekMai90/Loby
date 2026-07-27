import { describe, expect, it } from "vitest";
import type { WritingProject, WritingSheet } from "@/shared/types";
import { buildAgentContext } from "@/features/assistant/model/agentContext";

describe("agentContext", () => {
  it("includes Loby writing structure and document outline context", () => {
    const sheet: WritingSheet = {
      id: "sheet-1",
      title: "第一篇",
      groupId: "group-main",
      status: "构思",
      tags: [],
      targetWords: 1000,
      description: "当前稿件摘要",
      body: "# 开头\n\n正文第一段。\n\n## 案例\n\n正文第二段。",
      createdAt: "2026-07-09",
      updatedAt: "2026-07-09",
      properties: {},
    };
    const project: WritingProject = {
      id: "project-1",
      title: "写作项目",
      status: "构思",
      projectGoal: { enabled: false, unit: "words", target: 0 },
      groups: [{ id: "group-main", title: "正文" }],
      sheets: [sheet],
      updatedAt: "2026-07-09",
      writingBrief: {
        audience: "专业读者",
        thesis: "核心观点",
        tone: "克制",
        publishingNotes: "发布备注",
      },
    };

    const context = buildAgentContext(
      project,
      sheet,
      "选区文本",
      [],
      [],
      [],
      [],
      { provider: "openai-api", model: "auto", reasoningEffort: "medium", quickMode: false },
      "/Users/example/LobyLibrary",
      null,
    );

    expect(context).toContain("### 当前写作结构");
    expect(context).toContain("当前文稿：第一篇；字数：14 / 1000");
    expect(context).toContain("### 当前文稿轮廓");
    expect(context).toContain("- H1 L1: 开头");
    expect(context).toContain("  - H2 L5: 案例");
    expect(context).toContain("当前选区：4 字");
    expect(context).toContain("### 落笔（Loby）操作说明");
  });

  it("does not duplicate current sheet body when the current document is already mounted", () => {
    const { project, sheet } = fixture();
    const context = buildAgentContext(
      project,
      sheet,
      "",
      [],
      ["current-sheet"],
      [],
      [
        {
          id: "document:sheet-1",
          type: "document",
          projectId: "project-1",
          sheetId: "sheet-1",
          title: "第一篇",
          subtitle: "当前文稿",
          content: sheet.body,
        },
      ],
      { provider: "openai-api", model: "auto", reasoningEffort: "medium", quickMode: false },
      "/Users/example/LobyLibrary",
      null,
    );

    expect(countOccurrences(context, "唯一正文片段")).toBe(1);
    expect(context).toContain("### 已挂载上下文");
    expect(context).not.toContain("### 当前稿件正文\n# 开头");
  });

  it("keeps current sheet body when it is requested through mention modes only", () => {
    const { project, sheet } = fixture();
    const context = buildAgentContext(
      project,
      sheet,
      "",
      [],
      ["current-sheet"],
      [],
      [],
      { provider: "openai-api", model: "auto", reasoningEffort: "medium", quickMode: false },
      "/Users/example/LobyLibrary",
      null,
    );

    expect(context).toContain("### 当前稿件正文");
    expect(countOccurrences(context, "唯一正文片段")).toBe(1);
  });
});

function fixture(): { project: WritingProject; sheet: WritingSheet } {
  const sheet: WritingSheet = {
    id: "sheet-1",
    title: "第一篇",
    groupId: "group-main",
    status: "构思",
    tags: [],
    targetWords: 1000,
    description: "当前稿件摘要",
    body: "# 开头\n\n唯一正文片段\n\n## 案例\n\n结尾",
    createdAt: "2026-07-09",
    updatedAt: "2026-07-09",
    properties: {},
  };
  return {
    sheet,
    project: {
      id: "project-1",
      title: "写作项目",
      status: "构思",
      projectGoal: { enabled: false, unit: "words", target: 0 },
      groups: [{ id: "group-main", title: "正文" }],
      sheets: [sheet],
      updatedAt: "2026-07-09",
      writingBrief: {
        audience: "专业读者",
        thesis: "核心观点",
        tone: "克制",
        publishingNotes: "发布备注",
      },
    },
  };
}

function countOccurrences(value: string, needle: string): number {
  return value.split(needle).length - 1;
}
