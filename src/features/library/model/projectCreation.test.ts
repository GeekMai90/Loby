/**
 * [INPUT]: 依赖 Vitest、项目草稿、projectCreation 领域模型与文稿默认属性模型
 * [OUTPUT]: 验证通用项目为空容器且只保留必要文稿字段，并保护项目目标、导入、分组和文稿移动契约
 * [POS]: library model 的项目创建回归测试，阻止原型模板内容进入作者项目与持久化模型
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addProjectGroup,
  createImportedProjectFromSheets,
  createWritingProject,
  createProjectGroupDraft,
  getInitialProjectSelection,
  moveSheetBetweenProjects,
  reorderProjectGroupsForRail,
} from "@/features/library/model/projectCreation";
import {
  DEFAULT_USER_GROUP_ID,
  INBOX_GROUP_ID,
  INBOX_PROJECT_ID,
  NOTES_PROJECT_ID,
  NOTES_QUICK_GROUP_ID,
  PROJECT_ALL_GROUP_ID,
} from "@/features/library/model/projectModel";
import type { NewProjectDraft } from "@/features/library/constants/projectAppearance";
import { createSheetWithProjectDefaults, getDocumentPropertyDefinitions } from "@/features/editor/model/documentProperties";
import type { WritingProject, WritingSheet } from "@/shared/types";

const draft: NewProjectDraft = {
  title: "新项目",
  icon: "pen",
  iconColor: "#007aff",
};

const importedSheet: WritingSheet = {
  id: "import-1",
  title: "导入文稿",
  groupId: "group-default",
  status: "构思",
  tags: [],
  targetWords: 300,
  summary: "",
  body: "正文",
  createdAt: "2026-07-08 10:00:00",
  updatedAt: "2026-07-08 10:00:00",
  properties: {},
};

describe("projectCreation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T10:00:00+08:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a normalized general-purpose project without seeded documents", () => {
    const project = createWritingProject(draft);
    const selection = getInitialProjectSelection(project);

    expect(project.id).toBe("project-1783476000000");
    expect(project.title).toBe("新项目");
    expect(project.icon).toBe("pen");
    expect(project.projectGoal).toEqual({ enabled: false, unit: "words", target: 0 });
    expect(project.groups?.map((group) => group.id)).toEqual([DEFAULT_USER_GROUP_ID]);
    expect(project.documentPropertyDefinitions).toEqual([]);
    expect(project.sheets).toEqual([]);
    expect(selection.groupId).toBe(PROJECT_ALL_GROUP_ID);
    expect(selection.sheetId).toBe("");
  });

  it("keeps only the required document property definitions", () => {
    const project = createWritingProject(draft);

    expect(project.documentPropertyDefinitions).toEqual([]);
    expect(getDocumentPropertyDefinitions(project.documentPropertyDefinitions).map((field) => field.key)).toEqual([
      "tags",
      "targetWords",
      "summary",
    ]);

    const sheet = createSheetWithProjectDefaults(project, {
      id: "sheet-new",
      title: "无标题",
      body: "",
      updatedAt: "2026-07-08 10:00:00",
    });
    expect(sheet).toMatchObject({
      status: "构思",
      targetWords: 1000,
      summary: "",
      createdAt: "2026-07-08 10:00:00",
      tags: [],
      properties: {},
    });
  });

  it("creates the project goal selected in the project dialog", () => {
    const project = createWritingProject({
      ...draft,
      goalEnabled: true,
      goalUnit: "articles",
      goalTarget: 12,
    });

    expect(project.projectGoal).toEqual({ enabled: true, unit: "articles", target: 12 });
  });

  it("creates an imported project with an import label and minimum target words", () => {
    const project = createImportedProjectFromSheets([
      { ...importedSheet, properties: { 公众号发布: true, 渠道: ["微信", "博客"], 复杂字段: { nested: true } } },
    ]);

    expect(project.id).toBe("project-import-1783476000000");
    expect(project.title).toBe("导入文稿");
    expect(project.documentPropertyDefinitions?.find((field) => field.key === "公众号发布")?.type).toBe("checkbox");
    expect(project.documentPropertyDefinitions?.find((field) => field.key === "渠道")?.type).toBe("tags");
    expect(project.documentPropertyDefinitions?.some((field) => field.key === "复杂字段")).toBe(false);
    expect(project.sheets[0].properties?.复杂字段).toEqual({ nested: true });
  });

  it("adds a project group while removing legacy system groups", () => {
    const project = projectWithGroups([{ id: "group-content", title: "正文" }]);
    const group = createProjectGroupDraft(project, { ...draft, title: "新分组" });

    const next = addProjectGroup(project, group);

    expect(next.groups?.map((item) => item.id)).toEqual([group.id]);
    expect(next.groups?.[0].title).toBe("新分组");
  });

  it("keeps quick notes fixed while reordering note groups", () => {
    const notesProject = projectWithGroups(
      [
        { id: NOTES_QUICK_GROUP_ID, title: "随手记" },
        { id: "note-a", title: "A" },
        { id: "note-b", title: "B" },
      ],
      NOTES_PROJECT_ID,
    );

    const next = reorderProjectGroupsForRail(notesProject, "note-b", "note-a", "before");

    expect(next.groups?.map((item) => item.id)).toEqual([NOTES_QUICK_GROUP_ID, "note-b", "note-a"]);
  });

  it("moves a sheet to a project's pending group or a specific group", () => {
    const source = { ...projectWithGroups([{ id: INBOX_GROUP_ID, title: "收件箱" }], INBOX_PROJECT_ID), sheets: [importedSheet] };
    const target = projectWithGroups([
      { id: DEFAULT_USER_GROUP_ID, title: "待整理" },
      { id: "group-writing", title: "写作中" },
    ]);

    const pending = moveSheetBetweenProjects([source, target], importedSheet.id, { projectId: target.id });
    expect(pending.find((project) => project.id === INBOX_PROJECT_ID)?.sheets).toHaveLength(0);
    expect(pending.find((project) => project.id === target.id)?.sheets[0].groupId).toBe(DEFAULT_USER_GROUP_ID);

    const writing = moveSheetBetweenProjects(pending, importedSheet.id, { projectId: target.id, groupId: "group-writing" });
    expect(writing.find((project) => project.id === target.id)?.sheets[0].groupId).toBe("group-writing");
  });

  it("fills target project defaults without overwriting or removing existing document properties", () => {
    const sourceSheet: WritingSheet = {
      ...importedSheet,
      properties: { 渠道: "公众号", 来源: "采访" },
    };
    const source = {
      ...projectWithGroups([{ id: INBOX_GROUP_ID, title: "收件箱" }], INBOX_PROJECT_ID),
      sheets: [sourceSheet],
    };
    const target = {
      ...projectWithGroups([{ id: DEFAULT_USER_GROUP_ID, title: "待整理" }], "blog"),
      documentPropertyDefinitions: [
        { id: "channel", key: "渠道", label: "渠道", type: "text" as const, defaultValue: "博客" },
        { id: "stage", key: "阶段", label: "阶段", type: "select" as const, defaultValue: "选题" },
        { id: "remark", key: "备注", label: "备注", type: "text" as const },
      ],
    };

    const moved = moveSheetBetweenProjects([source, target], sourceSheet.id, { projectId: target.id });
    const movedSheet = moved.find((project) => project.id === target.id)?.sheets[0];

    expect(movedSheet?.properties).toEqual({ 渠道: "公众号", 来源: "采访", 阶段: "选题" });
  });

  it("does not apply project defaults when only changing groups inside the same project", () => {
    const project = {
      ...projectWithGroups([
        { id: DEFAULT_USER_GROUP_ID, title: "待整理" },
        { id: "published", title: "已发布" },
      ]),
      sheets: [importedSheet],
      documentPropertyDefinitions: [{ id: "stage", key: "阶段", label: "阶段", type: "select" as const, defaultValue: "选题" }],
    };

    const moved = moveSheetBetweenProjects([project], importedSheet.id, { projectId: project.id, groupId: "published" });

    expect(moved[0].sheets[0].properties).toEqual({});
  });
});

function projectWithGroups(groups: WritingProject["groups"], id = "project-1"): WritingProject {
  return {
    id,
    title: "项目",
    status: "构思",
    projectGoal: { enabled: false, unit: "words", target: 0 },
    groups,
    sheets: [],
    updatedAt: "2026-07-08 10:00:00",
  };
}
