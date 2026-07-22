import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addProjectGroup,
  createImportedProjectFromSheets,
  createProjectFromTemplate,
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
import { PROJECT_TEMPLATES } from "@/features/library/constants/projectTemplates";
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
  targetWords: 300,
  summary: "",
  body: "正文",
  updatedAt: "2026-07-08 10:00:00",
};

describe("projectCreation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T10:00:00+08:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a normalized project from a template", () => {
    const project = createProjectFromTemplate("blank", draft);
    const selection = getInitialProjectSelection(project);

    expect(project.id).toBe("project-1783476000000");
    expect(project.title).toBe("新项目");
    expect(project.icon).toBe("pen");
    expect(project.projectGoal).toEqual({ enabled: false, unit: "words", target: 3000 });
    expect(project.groups?.map((group) => group.id)).toEqual([DEFAULT_USER_GROUP_ID]);
    expect(project.propertyDefinitions?.map((field) => field.key)).toEqual(["tags", "targetWords"]);
    expect(project.sheets).toEqual([]);
    expect(selection.groupId).toBe(PROJECT_ALL_GROUP_ID);
    expect(selection.sheetId).toBe("");
  });

  it("does not seed custom properties into any project template", () => {
    for (const template of PROJECT_TEMPLATES) {
      expect(template.propertyDefinitions, template.title).toEqual([]);
      expect(createProjectFromTemplate(template.id, draft).propertyDefinitions?.every((field) => field.locked)).toBe(true);
    }
  });

  it("creates the project goal selected in the project dialog", () => {
    const project = createProjectFromTemplate("blank", {
      ...draft,
      goalEnabled: true,
      goalUnit: "articles",
      goalTarget: 12,
    });

    expect(project.projectGoal).toEqual({ enabled: true, unit: "articles", target: 12 });
    expect(project.targetWords).toBe(0);
  });

  it("creates an imported project with an import label and minimum target words", () => {
    const project = createImportedProjectFromSheets(
      [{ ...importedSheet, properties: { 公众号发布: true, 渠道: ["微信", "博客"], 复杂字段: { nested: true } } }],
      1,
    );

    expect(project.id).toBe("project-import-1783476000000");
    expect(project.title).toBe("导入文稿");
    expect(project.description).toBe("从 1 个 Markdown/text 文件创建。");
    expect(project.targetWords).toBe(1000);
    expect(project.tags).toEqual(["导入"]);
    expect(project.propertyDefinitions?.find((field) => field.key === "公众号发布")?.type).toBe("checkbox");
    expect(project.propertyDefinitions?.find((field) => field.key === "渠道")?.type).toBe("tags");
    expect(project.propertyDefinitions?.some((field) => field.key === "复杂字段")).toBe(false);
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
});

function projectWithGroups(groups: WritingProject["groups"], id = "project-1"): WritingProject {
  return {
    id,
    title: "项目",
    description: "",
    status: "构思",
    targetPlatform: "公众号",
    targetWords: 1000,
    tags: [],
    groups,
    sheets: [],
    updatedAt: "2026-07-08 10:00:00",
  };
}
