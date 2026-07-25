import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { WritingProject } from "@/shared/types";
import { ProjectGoalProgress } from "@/features/writing-activity/components/ProjectGoalProgress";

describe("ProjectGoalProgress", () => {
  it("shows the active project goal as a compact progress bar", () => {
    const html = renderToStaticMarkup(
      React.createElement(ProjectGoalProgress, {
        project: project({
          projectGoal: { enabled: true, unit: "words", target: 1000 },
          sheets: [{ ...sheet(), body: "一二三四五" }],
        }),
      }),
    );

    expect(html).toContain("项目字数进度：5 / 1,000 字，已完成 1%");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain("--project-goal-progress:1%");
    expect(html).toContain(">1%</span>");
    expect(html).toContain("项目字数进度");
  });

  it("does not reserve space when the project goal is disabled", () => {
    const html = renderToStaticMarkup(React.createElement(ProjectGoalProgress, { project: project() }));

    expect(html).toBe("");
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

function sheet(): WritingProject["sheets"][number] {
  return {
    id: "sheet-1",
    title: "文章",
    status: "初稿",
    tags: [],
    description: "",
    body: "",
    targetWords: 0,
    createdAt: "2026-07-19T00:00:00.000Z",
    updatedAt: "2026-07-19T00:00:00.000Z",
    properties: {},
  };
}
