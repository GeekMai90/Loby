import { describe, expect, it } from "vitest";
import type { WritingProject, WritingSheet } from "@/shared/types";
import { getProjectInformation } from "@/features/library/model/projectInformation";

describe("project information", () => {
  it("summarizes active writing documents and both goal levels", () => {
    const information = getProjectInformation(
      project({
        projectGoal: { enabled: true, unit: "words", target: 10 },
        sheets: [
          sheet("article", { body: "你好 world 测试", targetWords: 4 }),
          sheet("second", { body: "章节", targetWords: 4 }),
          sheet("third", { body: "资料也计入" }),
          sheet("trashed", { body: "废纸篓不计入", targetWords: 4, archivedAt: "2026-07-19T12:00:00.000Z" }),
        ],
      }),
    );

    expect(information).toEqual({
      articleCount: 3,
      totalWords: 12,
      projectGoal: { enabled: true, unit: "words", current: 12, target: 10, progress: 100 },
      articleGoal: { enabled: true, configuredCount: 2, achievedCount: 1, progress: 50 },
    });
  });

  it("reports goals as disabled when the project has no configured targets", () => {
    expect(getProjectInformation(project())).toEqual({
      articleCount: 0,
      totalWords: 0,
      projectGoal: { enabled: false, unit: "words", current: 0, target: 0, progress: 0 },
      articleGoal: { enabled: false, configuredCount: 0, achievedCount: 0, progress: 0 },
    });
  });
});

function project(overrides: Partial<WritingProject> = {}): WritingProject {
  return {
    id: "project-1",
    title: "博客",
    status: "构思",
    projectGoal: { enabled: false, unit: "words", target: 0 },
    sheets: [],
    updatedAt: "2026-07-19T00:00:00.000Z",
    ...overrides,
  };
}

function sheet(id: string, overrides: Partial<WritingSheet> = {}): WritingSheet {
  return {
    id,
    title: "文稿",
    tags: [],
    targetWords: 0,
    description: "",
    body: "",
    createdAt: "2026-07-19T00:00:00.000Z",
    updatedAt: "2026-07-19T00:00:00.000Z",
    properties: {},
    ...overrides,
  };
}
