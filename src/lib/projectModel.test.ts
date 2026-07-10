import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONTENT_GROUP_ID,
  DEFAULT_MATERIAL_GROUP_ID,
  DEFAULT_USER_GROUP_ID,
  NOTES_INBOX_GROUP_ID,
  NOTES_PROJECT_ID,
  buildProjectFolderPath,
  buildProjectResourcePaths,
  buildSheetMarkdownPath,
  ensureProjectGroups,
  filterProjects,
  filterSheets,
  getPublishingChecklist,
  getSheetsForProjectFilter,
  getVisibleProjectGroups,
  getWritingBrief,
  normalizeProject,
  normalizeProjects,
  resolveProjectGroupId,
  resolveSavedProjectSelection,
  safeVisiblePathSegment,
} from "./projectModel";
import type { ProjectGroup, WritingProject, WritingSheet } from "../types";

describe("projectModel", () => {
  it("adds the notes project when normalizing project lists", () => {
    const projects = normalizeProjects([project({ id: "project-1", title: "项目" })]);

    expect(projects.map((item) => item.id)).toEqual(["project-1", NOTES_PROJECT_ID]);
    expect(projects.find((item) => item.id === NOTES_PROJECT_ID)?.groups?.[0].id).toBe(NOTES_INBOX_GROUP_ID);
  });

  it("normalizes project groups, sheet groups, icons, and duplicate sheets", () => {
    const normalized = normalizeProject(
      project({
        icon: "",
        iconColor: "",
        groups: [group(DEFAULT_CONTENT_GROUP_ID, "正文"), group("group-main", "  "), group(DEFAULT_MATERIAL_GROUP_ID, "素材")],
        sheets: [
          sheet("sheet-1", { groupId: DEFAULT_CONTENT_GROUP_ID }),
          sheet("sheet-1", { title: "重复" }),
          sheet("sheet-2", { groupId: "missing-group" }),
        ],
      }),
    );

    expect(normalized.icon).toBe("library");
    expect(normalized.iconColor).toBe("#007aff");
    expect(normalized.groups?.map((item) => [item.id, item.title])).toEqual([
      ["group-main", "未命名分组"],
      ["missing-group", "未命名分组"],
    ]);
    expect(normalized.sheets.map((item) => [item.id, item.groupId])).toEqual([
      ["sheet-1", "group-main"],
      ["sheet-2", "missing-group"],
    ]);
  });

  it("creates missing non-system groups from sheet group ids", () => {
    const groups = ensureProjectGroups(project({ groups: [], sheets: [sheet("sheet-1", { groupId: "custom-group" })] }));

    expect(groups).toMatchObject([
      {
        id: "custom-group",
        title: "未命名分组",
      },
    ]);
  });

  it("resolves active project and group selection from saved ids", () => {
    const firstProject = project({
      id: "project-1",
      sheets: [sheet("first", { groupId: "group-main" })],
    });
    const secondProject = project({
      id: "project-2",
      groups: [group("group-a", "A"), group("group-b", "B")],
      sheets: [sheet("second", { groupId: "group-b" })],
    });

    expect(resolveSavedProjectSelection([firstProject, secondProject], "project-2", "second")).toEqual({
      projectId: "project-2",
      sheetId: "second",
    });
    expect(resolveProjectGroupId(secondProject, "", "second")).toBe("group-b");
    expect(resolveProjectGroupId(secondProject, "group-a", "second")).toBe("group-a");
  });

  it("merges publishing checklist and writing brief defaults", () => {
    const model = project({
      publishingChecklist: [
        { id: "title", label: "标题已确认", done: true },
        { id: "custom", label: "自定义", done: true },
      ],
      writingBrief: { audience: "读者", thesis: "", tone: "克制", publishingNotes: "" },
    });

    expect(getPublishingChecklist(model).find((item) => item.id === "title")?.done).toBe(true);
    expect(getPublishingChecklist(model).at(-1)).toMatchObject({ id: "custom", done: true });
    expect(getWritingBrief(model)).toEqual({
      audience: "读者",
      thesis: "",
      tone: "克制",
      publishingNotes: "",
    });
  });

  it("filters projects and sheets by meaningful searchable fields", () => {
    const projects = [
      project({ id: "active", title: "知识管理", tags: ["AI"], sheets: [sheet("sheet-1", { summary: "EPOS 方法" })] }),
      project({ id: "archived", title: "旧项目", status: "已归档" }),
    ];

    expect(filterProjects(projects, "epos").map((item) => item.id)).toEqual(["active"]);
    expect(filterProjects(projects, "").map((item) => item.id)).toEqual(["active"]);
    expect(filterSheets([sheet("a", { title: "标题" }), sheet("b", { body: "正文关键词" })], "关键词").map((item) => item.id)).toEqual([
      "b",
    ]);
  });

  it("filters sheets by library filter without duplicating ids", () => {
    const sheets = [
      sheet("same", { status: "已发布", updatedAt: "2026-07-09 10:00:00" }),
      sheet("same", { title: "重复", status: "已归档", updatedAt: "2026-07-09 11:00:00" }),
      sheet("archived", { status: "已归档", updatedAt: "2026-07-08 10:00:00" }),
      sheet("boundary", { updatedAt: "2026-07-03 09:00:00" }),
      sheet("too-old", { updatedAt: "2026-07-02 23:59:59" }),
      sheet("future", { updatedAt: "2026-07-10 09:00:00" }),
    ];

    expect(getSheetsForProjectFilter(sheets, "recent", "2026-07-09").map((item) => item.id)).toEqual(["same", "boundary"]);
    expect(getSheetsForProjectFilter(sheets, "archived", "2026-07-09").map((item) => item.id)).toEqual(["archived"]);
  });

  it("builds readable local paths for projects, sheets, resources, and notes", () => {
    const model = project({
      title: "为什么中国鬼怪故事里，没有 Demon?",
      groups: [group("group-main", "正文 / 初稿")],
      sheets: [sheet("sheet-1", { title: "第一篇：Demon?" })],
    });

    expect(safeVisiblePathSegment(" .. ", "fallback-id")).toBe("fallback-id");
    expect(buildProjectFolderPath("/Library", model)).toBe("/Library/projects/为什么中国鬼怪故事里，没有 Demon");
    expect(buildProjectResourcePaths("/Library", model)).toMatchObject({
      assets: "/Library/projects/为什么中国鬼怪故事里，没有 Demon/assets",
      references: "/Library/projects/为什么中国鬼怪故事里，没有 Demon/references",
      exports: "/Library/projects/为什么中国鬼怪故事里，没有 Demon/exports",
    });
    expect(buildSheetMarkdownPath("/Library", model, model.sheets[0])).toBe(
      "/Library/projects/为什么中国鬼怪故事里，没有 Demon/正文 - 初稿/第一篇：Demon.md",
    );
    expect(buildSheetMarkdownPath("/Library", { ...model, id: NOTES_PROJECT_ID }, model.sheets[0])).toBe(
      "/Library/notes/正文 - 初稿/第一篇：Demon.md",
    );
  });

  it("returns only visible project groups", () => {
    const model = project({
      groups: [group(DEFAULT_CONTENT_GROUP_ID, "正文"), group("visible", "可见")],
    });

    expect(getVisibleProjectGroups(model).map((item) => item.id)).toEqual(["visible"]);
  });
});

function project(overrides: Partial<WritingProject> = {}): WritingProject {
  return {
    id: "project-1",
    title: "项目",
    description: "",
    status: "构思",
    targetPlatform: "公众号",
    targetWords: 1000,
    tags: [],
    groups: [group("group-main", "正文")],
    sheets: [sheet("sheet-1")],
    updatedAt: "2026-07-09",
    ...overrides,
  };
}

function group(id: string, title: string): ProjectGroup {
  return {
    id,
    title,
    icon: "article",
    iconColor: "#007aff",
    description: "",
  };
}

function sheet(id: string, overrides: Partial<WritingSheet> = {}): WritingSheet {
  return {
    id,
    title: "文稿",
    groupId: DEFAULT_USER_GROUP_ID,
    type: "正文",
    status: "构思",
    targetWords: 1000,
    summary: "",
    body: "正文",
    updatedAt: "2026-07-09",
    ...overrides,
  };
}
