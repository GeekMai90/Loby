import { describe, expect, it } from "vitest";
import type { WritingActivityStore, WritingProject, WritingSheet } from "../types";
import {
  deriveWritingCheckIns,
  hasCelebratedTarget,
  mergeWritingCheckIns,
  normalizeProjectGoal,
  normalizeWritingActivity,
  projectGoalProgress,
  projectGoalValue,
  qualifiesForWritingCheckIn,
  withCelebratedTarget,
  writingDates,
  writingStreaks,
} from "./writingGoals";

describe("writing goals", () => {
  it("migrates a legacy project word target into an enabled word goal", () => {
    expect(normalizeProjectGoal(project({ targetWords: 12_000 }))).toEqual({
      enabled: true,
      unit: "words",
      target: 12_000,
    });
  });

  it("keeps an explicit article goal", () => {
    expect(normalizeProjectGoal(project({ projectGoal: { enabled: true, unit: "articles", target: 12 } }))).toEqual({
      enabled: true,
      unit: "articles",
      target: 12,
    });
  });

  it("counts only writing documents for project word goals", () => {
    const value = projectGoalValue(
      project({
        projectGoal: { enabled: true, unit: "words", target: 10 },
        sheets: [
          sheet("body", { type: "正文", body: "你好 world" }),
          sheet("chapter", { type: "章节", body: "章节内容" }),
          sheet("outline", { type: "提纲", body: "这部分不计入" }),
        ],
      }),
    );

    expect(value).toBe(7);
  });

  it("counts only manually completed articles for project article goals", () => {
    const targetProject = project({
      projectGoal: { enabled: true, unit: "articles", target: 2 },
      sheets: [
        sheet("done", { type: "正文", completedAt: "2026-07-19T08:00:00.000Z" }),
        sheet("draft", { type: "正文" }),
        sheet("chapter", { type: "章节", completedAt: "2026-07-19T08:00:00.000Z" }),
      ],
    });

    expect(projectGoalValue(targetProject)).toBe(1);
    expect(projectGoalProgress(targetProject)).toBe(50);
  });

  it("excludes trashed documents from project goals", () => {
    const targetProject = project({
      projectGoal: { enabled: true, unit: "words", target: 10 },
      sheets: [sheet("active", { body: "保留内容" }), sheet("trashed", { body: "废纸篓内容", archivedAt: "2026-07-19T08:00:00.000Z" })],
    });

    expect(projectGoalValue(targetProject)).toBe(4);
    expect(projectGoalProgress(targetProject)).toBe(40);
  });
});

describe("writing check-ins", () => {
  it("checks in a non-empty article on its creation date", () => {
    const targetProject = project({ id: "project-1", title: "博客" });
    const targetSheet = sheet("article-1", {
      title: "新文章",
      type: "正文",
      body: "今天写了一点。",
      createdAt: "2026-07-19T09:00:00+08:00",
      updatedAt: "2026-08-01T09:00:00+08:00",
    });

    expect(qualifiesForWritingCheckIn(targetProject, targetSheet)).toBe(true);
    expect(deriveWritingCheckIns([{ ...targetProject, sheets: [targetSheet] }], "2026-07-19")).toEqual([
      {
        date: "2026-07-19",
        projectId: "project-1",
        projectTitle: "博客",
        sheetId: "article-1",
        sheetTitle: "新文章",
      },
    ]);
  });

  it("does not infer a past check-in when an old blank article is filled later", () => {
    const oldArticle = sheet("old", {
      body: "今天才补写",
      createdAt: "2026-07-18T09:00:00+08:00",
      updatedAt: "2026-07-19T09:00:00+08:00",
    });

    expect(deriveWritingCheckIns([{ ...project(), sheets: [oldArticle] }], "2026-07-19")).toEqual([]);
  });

  it("does not count blank, non-article, or system-project documents", () => {
    const blank = sheet("blank", { body: "  ", createdAt: "2026-07-19T09:00:00+08:00" });
    const material = sheet("material", { type: "素材", body: "资料", createdAt: "2026-07-19T09:00:00+08:00" });
    const article = sheet("article", { body: "正文", createdAt: "2026-07-19T09:00:00+08:00" });

    expect(qualifiesForWritingCheckIn(project({ id: "project-1" }), blank)).toBe(false);
    expect(qualifiesForWritingCheckIn(project({ id: "project-1" }), material)).toBe(false);
    expect(qualifiesForWritingCheckIn(project({ id: "loby-guide" }), article)).toBe(false);
    expect(qualifiesForWritingCheckIn(project({ id: "inbox-root" }), article)).toBe(false);
    expect(qualifiesForWritingCheckIn(project({ id: "notes-root" }), article)).toBe(false);
  });

  it("does not count prefilled template content until the new article is edited", () => {
    const prefilled = sheet("prefilled", {
      body: "# 系统预填内容",
      createdAt: "2026-07-19 09:00:00",
      updatedAt: "2026-07-19 09:00:00",
    });
    const edited = { ...prefilled, updatedAt: "2026-07-19 09:00:01" };

    expect(deriveWritingCheckIns([{ ...project(), sheets: [prefilled] }], "2026-07-19")).toEqual([]);
    expect(deriveWritingCheckIns([{ ...project(), sheets: [edited] }], "2026-07-19")).toHaveLength(1);
  });

  it("preserves a recorded check-in after the source document disappears", () => {
    const recorded = checkIn("2026-07-18", "old-sheet");

    expect(mergeWritingCheckIns([recorded], [])).toEqual([recorded]);
  });

  it("normalizes records and derives distinct writing dates", () => {
    const activity = normalizeWritingActivity({
      version: 99,
      checkIns: [checkIn("2026-07-18", "first"), checkIn("2026-07-18", "second"), { nope: true }],
      celebratedTargets: { first: [500, 500, -1, 1000.2], empty: "bad" },
    });

    expect(writingDates(activity.checkIns)).toEqual(["2026-07-18"]);
    expect(activity.celebratedTargets).toEqual({ first: [500, 1000] });
  });

  it("calculates current and longest streaks using local calendar days", () => {
    expect(writingStreaks(["2026-07-10", "2026-07-11", "2026-07-17", "2026-07-18"], new Date(2026, 6, 19, 12))).toEqual({
      current: 2,
      longest: 2,
    });
    expect(writingStreaks(["2026-07-17", "2026-07-18", "2026-07-19"], new Date(2026, 6, 19, 12))).toEqual({
      current: 3,
      longest: 3,
    });
  });
});

describe("article goal celebrations", () => {
  it("records each achieved target once", () => {
    const activity: WritingActivityStore = { version: 1, checkIns: [], celebratedTargets: {} };
    const first = withCelebratedTarget(activity, "sheet-1", 500);

    expect(hasCelebratedTarget(first, "sheet-1", 500)).toBe(true);
    expect(withCelebratedTarget(first, "sheet-1", 500)).toBe(first);
    expect(withCelebratedTarget(first, "sheet-1", 1000).celebratedTargets["sheet-1"]).toEqual([500, 1000]);
  });
});

function project(overrides: Partial<WritingProject> = {}): WritingProject {
  return {
    id: "project-1",
    title: "项目",
    description: "",
    status: "构思",
    targetPlatform: "未指定",
    targetWords: 0,
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
    createdAt: "2026-07-19T00:00:00.000Z",
    updatedAt: "2026-07-19T00:00:00.000Z",
    ...overrides,
  };
}

function checkIn(date: string, sheetId: string) {
  return {
    date,
    projectId: "project-1",
    projectTitle: "项目",
    sheetId,
    sheetTitle: "文稿",
  };
}
