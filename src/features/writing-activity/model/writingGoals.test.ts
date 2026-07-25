import { describe, expect, it } from "vitest";
import type { WritingActivityStore, WritingProject, WritingSheet } from "@/shared/types";
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
  writingActivityLevel,
  writingDates,
  writingStreaks,
} from "@/features/writing-activity/model/writingGoals";

describe("writing goals", () => {
  it("keeps an explicit article goal", () => {
    expect(normalizeProjectGoal(project({ projectGoal: { enabled: true, unit: "articles", target: 12 } }))).toEqual({
      enabled: true,
      unit: "articles",
      target: 12,
    });
  });

  it("counts every active document for project word goals", () => {
    const value = projectGoalValue(
      project({
        projectGoal: { enabled: true, unit: "words", target: 10 },
        sheets: [sheet("first", { body: "你好 world" }), sheet("second", { body: "章节内容" }), sheet("third", { body: "这部分也计入" })],
      }),
    );

    expect(value).toBe(13);
  });

  it("counts every active document for project article goals", () => {
    const targetProject = project({
      projectGoal: { enabled: true, unit: "articles", target: 3 },
      sheets: [sheet("first"), sheet("draft"), sheet("third"), sheet("archived", { archivedAt: "2026-07-19T08:00:00.000Z" })],
    });

    expect(projectGoalValue(targetProject)).toBe(3);
    expect(projectGoalProgress(targetProject)).toBe(100);
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

  it("checks in an existing non-empty article when its content changes today", () => {
    const previousArticle = sheet("old", {
      body: "昨天的内容",
      createdAt: "2026-07-18T09:00:00+08:00",
      updatedAt: "2026-07-18T09:00:00+08:00",
    });
    const editedArticle = sheet("old", {
      body: "昨天的内容，今天继续修改",
      createdAt: "2026-07-18T09:00:00+08:00",
      updatedAt: "2026-07-19T09:00:00+08:00",
    });

    expect(
      deriveWritingCheckIns([{ ...project(), sheets: [editedArticle] }], "2026-07-19", [{ ...project(), sheets: [previousArticle] }]),
    ).toHaveLength(1);
  });

  it("ignores metadata-only updates and edits that leave an article blank", () => {
    const previousArticle = sheet("old", {
      body: "已有内容",
      createdAt: "2026-07-18T09:00:00+08:00",
      updatedAt: "2026-07-18T09:00:00+08:00",
    });
    const metadataOnly = { ...previousArticle, status: "修改中" as const, updatedAt: "2026-07-19T09:00:00+08:00" };
    const blank = sheet("blank", { title: "改过标题", updatedAt: "2026-07-19T09:00:00+08:00" });
    const previousBlank = { ...blank, title: "旧标题", updatedAt: "2026-07-18T09:00:00+08:00" };

    expect(
      deriveWritingCheckIns([{ ...project(), sheets: [metadataOnly, blank] }], "2026-07-19", [
        { ...project(), sheets: [previousArticle, previousBlank] },
      ]),
    ).toEqual([]);
  });

  it("marks the day when an edited article first reaches its word target", () => {
    const previousArticle = sheet("goal", { body: "不足", targetWords: 5 });
    const achievedArticle = { ...previousArticle, body: "今天刚好达到目标" };

    expect(
      deriveWritingCheckIns([{ ...project(), sheets: [achievedArticle] }], "2026-07-19", [{ ...project(), sheets: [previousArticle] }]),
    ).toMatchObject([{ sheetId: "goal", goalAchieved: true }]);
  });

  it("does not count blank or system-project documents", () => {
    const blank = sheet("blank", { body: "  ", createdAt: "2026-07-19T09:00:00+08:00" });
    const document = sheet("document", { body: "资料", createdAt: "2026-07-19T09:00:00+08:00" });
    const article = sheet("article", { body: "正文", createdAt: "2026-07-19T09:00:00+08:00" });

    expect(qualifiesForWritingCheckIn(project({ id: "project-1" }), blank)).toBe(false);
    expect(qualifiesForWritingCheckIn(project({ id: "project-1" }), document)).toBe(true);
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

  it("preserves a goal achievement when later edits update the same daily check-in", () => {
    const achieved = { ...checkIn("2026-07-19", "goal"), goalAchieved: true };
    const laterEdit = { ...checkIn("2026-07-19", "goal"), sheetTitle: "更新后的标题", goalAchieved: false };

    expect(mergeWritingCheckIns([achieved], [laterEdit])).toEqual([{ ...laterEdit, goalAchieved: true }]);
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

  it("maps daily writing to three activity levels", () => {
    const light = checkIn("2026-07-19", "first");
    const achieved = { ...checkIn("2026-07-19", "first"), goalAchieved: true };
    const second = checkIn("2026-07-19", "second");

    expect(writingActivityLevel([], "2026-07-19")).toBe(0);
    expect(writingActivityLevel([light, second], "2026-07-19")).toBe(1);
    expect(writingActivityLevel([achieved], "2026-07-19")).toBe(2);
    expect(writingActivityLevel([achieved, second], "2026-07-19")).toBe(3);
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
    status: "初稿",
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

function checkIn(date: string, sheetId: string) {
  return {
    date,
    projectId: "project-1",
    projectTitle: "项目",
    sheetId,
    sheetTitle: "文稿",
  };
}
