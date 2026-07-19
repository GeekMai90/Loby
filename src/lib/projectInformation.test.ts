import { describe, expect, it } from "vitest";
import type { WritingProject, WritingSheet } from "../types";
import { getProjectInformation } from "./projectInformation";

describe("project information", () => {
  it("summarizes active writing documents and both goal levels", () => {
    const information = getProjectInformation(
      project({
        projectGoal: { enabled: true, unit: "words", target: 10 },
        sheets: [
          sheet("article", { body: "你好 world 测试", targetWords: 4 }),
          sheet("chapter", { type: "章节", body: "章节", targetWords: 4 }),
          sheet("material", { type: "素材", body: "资料不计入" }),
          sheet("trashed", { body: "废纸篓不计入", targetWords: 4, archivedAt: "2026-07-19T12:00:00.000Z" }),
        ],
      }),
    );

    expect(information).toEqual({
      articleCount: 2,
      totalWords: 7,
      projectGoal: { enabled: true, unit: "words", current: 7, target: 10, progress: 70 },
      articleGoal: { enabled: true, targetWords: 4, achievedCount: 1, progress: 50 },
    });
  });

  it("reports goals as disabled when the project has no configured targets", () => {
    expect(getProjectInformation(project())).toEqual({
      articleCount: 0,
      totalWords: 0,
      projectGoal: { enabled: false, unit: "words", current: 0, target: 0, progress: 0 },
      articleGoal: { enabled: false, targetWords: 0, achievedCount: 0, progress: 0 },
    });
  });
});

function project(overrides: Partial<WritingProject> = {}): WritingProject {
  return {
    id: "project-1",
    title: "博客",
    description: "",
    status: "构思",
    targetPlatform: "未指定",
    targetWords: 0,
    projectGoal: { enabled: false, unit: "words", target: 0 },
    tags: [],
    sheets: [],
    updatedAt: "2026-07-19T00:00:00.000Z",
    ...overrides,
  };
}

function sheet(id: string, overrides: Partial<WritingSheet> = {}): WritingSheet {
  return {
    id,
    title: "文稿",
    type: "正文",
    status: "初稿",
    targetWords: 0,
    summary: "",
    body: "",
    updatedAt: "2026-07-19T00:00:00.000Z",
    ...overrides,
  };
}
