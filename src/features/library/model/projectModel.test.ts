/**
 * [INPUT]: 依赖 Vitest、写作库 project model 与 shared 公共契约
 * [OUTPUT]: 验证项目归一化、路径、筛选、分组、选择恢复与固定查询词搜索缓存
 * [POS]: 写作库项目模型的回归边界，覆盖结构规则与未变化文稿的搜索派生复用
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONTENT_GROUP_ID,
  DEFAULT_MATERIAL_GROUP_ID,
  DEFAULT_USER_GROUP_ID,
  INBOX_GROUP_ID,
  INBOX_PROJECT_ID,
  NOTES_QUICK_GROUP_ID,
  NOTES_PROJECT_ID,
  PROJECT_ALL_GROUP_ID,
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
  resolveNewSheetTarget,
  resolveSavedProjectSelection,
  safeVisiblePathSegment,
} from "@/features/library/model/projectModel";
import type { ProjectGroup, WritingProject, WritingSheet } from "@/shared/types";

describe("projectModel", () => {
  it("adds the notes project when normalizing project lists", () => {
    const projects = normalizeProjects([project({ id: "project-1", title: "项目" })]);

    expect(projects.map((item) => item.id)).toEqual(["project-1", INBOX_PROJECT_ID, NOTES_PROJECT_ID]);
    expect(projects.find((item) => item.id === INBOX_PROJECT_ID)?.groups?.[0].id).toBe(INBOX_GROUP_ID);
    expect(projects.find((item) => item.id === NOTES_PROJECT_ID)?.groups?.[0]).toMatchObject({
      id: NOTES_QUICK_GROUP_ID,
      title: "随手记",
    });
  });

  it("deduplicates legacy system project entries", () => {
    const projects = normalizeProjects([
      project({ id: INBOX_PROJECT_ID, title: "收件箱" }),
      project({ id: INBOX_PROJECT_ID, title: "旧收件箱" }),
      project({ id: NOTES_PROJECT_ID, title: "笔记" }),
      project({ id: NOTES_PROJECT_ID, title: "旧笔记" }),
    ]);

    expect(projects.filter((item) => item.id === INBOX_PROJECT_ID)).toHaveLength(1);
    expect(projects.filter((item) => item.id === NOTES_PROJECT_ID)).toHaveLength(1);
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

  it("renames legacy default groups without changing document ownership", () => {
    const normalizedProject = normalizeProject(project({ groups: [group(DEFAULT_USER_GROUP_ID, "默认组")] }));
    const normalizedNotes = normalizeProject(
      project({
        id: NOTES_PROJECT_ID,
        groups: [group("notes-inbox", "收件箱")],
        sheets: [sheet("note-1", { groupId: "notes-inbox" })],
      }),
    );

    expect(normalizedProject.groups?.[0]).toMatchObject({ title: "待整理", icon: "inbox" });
    expect(normalizedNotes.groups?.[0]).toMatchObject({ id: NOTES_QUICK_GROUP_ID, title: "随手记" });
    expect(normalizedNotes.sheets[0].groupId).toBe(NOTES_QUICK_GROUP_ID);
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

  it("opens the first user project instead of a system area for a new library", () => {
    const introduction = project({
      id: "loby-guide",
      title: "落笔指南",
      sheets: [sheet("loby-guide-welcome", { title: "欢迎使用落笔" })],
    });

    expect(
      resolveSavedProjectSelection([project({ id: INBOX_PROJECT_ID }), project({ id: NOTES_PROJECT_ID }), introduction], "", ""),
    ).toEqual({
      projectId: "loby-guide",
      sheetId: "loby-guide-welcome",
    });
  });

  it("routes global, note, and project creation to their explicit default locations", () => {
    const writingProject = project({ groups: [group(DEFAULT_USER_GROUP_ID, "待整理"), group("group-writing", "写作中")] });
    const projects = normalizeProjects([writingProject]);

    expect(
      resolveNewSheetTarget({
        projects,
        activeProject: writingProject,
        activeGroupId: "group-writing",
        activeNoteGroupId: "",
        sidebarMode: "library",
      }),
    ).toMatchObject({ project: { id: INBOX_PROJECT_ID }, groupId: INBOX_GROUP_ID });
    expect(
      resolveNewSheetTarget({
        projects,
        activeProject: writingProject,
        activeGroupId: "",
        activeNoteGroupId: NOTES_QUICK_GROUP_ID,
        sidebarMode: "library",
      }),
    ).toMatchObject({ project: { id: NOTES_PROJECT_ID }, groupId: NOTES_QUICK_GROUP_ID });
    expect(
      resolveNewSheetTarget({ projects, activeProject: writingProject, activeGroupId: "", activeNoteGroupId: "", sidebarMode: "project" }),
    ).toMatchObject({ project: { id: writingProject.id }, groupId: DEFAULT_USER_GROUP_ID });
    expect(
      resolveNewSheetTarget({
        projects,
        activeProject: writingProject,
        activeGroupId: PROJECT_ALL_GROUP_ID,
        activeNoteGroupId: "",
        sidebarMode: "project",
      }),
    ).toMatchObject({ project: { id: writingProject.id }, groupId: DEFAULT_USER_GROUP_ID });
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
      project({ id: "active", title: "知识管理", sheets: [sheet("sheet-1", { tags: ["AI"], description: "EPOS 方法" })] }),
      project({ id: "archived", title: "旧项目", status: "已归档" }),
    ];

    expect(filterProjects(projects, "epos").map((item) => item.id)).toEqual(["active"]);
    expect(filterProjects(projects, "").map((item) => item.id)).toEqual(["active"]);
    expect(filterSheets([sheet("a", { title: "标题" }), sheet("b", { body: "正文关键词" })], "关键词").map((item) => item.id)).toEqual([
      "b",
    ]);
  });

  it("reuses a fixed search result for unchanged sheet objects", () => {
    const observed = sheet("observed");
    let bodyReads = 0;
    Object.defineProperty(observed, "body", {
      configurable: true,
      enumerable: true,
      get() {
        bodyReads += 1;
        return "包含固定关键词";
      },
    });

    expect(filterSheets([observed], "固定")).toEqual([observed]);
    expect(filterSheets([observed], "固定")).toEqual([observed]);
    expect(bodyReads).toBe(1);

    filterSheets([observed], "另一个查询");
    expect(bodyReads).toBe(2);
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
    expect(buildSheetMarkdownPath("/Library", { ...model, id: INBOX_PROJECT_ID }, model.sheets[0])).toBe("/Library/inbox/第一篇：Demon.md");
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
    status: "构思",
    projectGoal: { enabled: false, unit: "words", target: 0 },
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
    status: "构思",
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
