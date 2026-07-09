import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addProjectGroup,
  createImportedProjectFromSheets,
  createProjectFromTemplate,
  createProjectGroupDraft,
  getInitialProjectSelection,
  reorderProjectGroupsForRail,
} from "./projectCreation";
import { NOTES_INBOX_GROUP_ID, NOTES_PROJECT_ID } from "./projectModel";
import type { NewProjectDraft } from "../constants/projectAppearance";
import type { WritingProject, WritingSheet } from "../types";

const draft: NewProjectDraft = {
  title: "新项目",
  icon: "pen",
  iconColor: "#007aff",
};

const importedSheet: WritingSheet = {
  id: "import-1",
  title: "导入文稿",
  groupId: "group-default",
  type: "正文",
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
    expect(project.groups?.[0].id).toBe("group-default");
    expect(selection.groupId).toBe("group-default");
    expect(selection.sheetId).toBe(project.sheets[0].id);
  });

  it("creates an imported project with an import label and minimum target words", () => {
    const project = createImportedProjectFromSheets([importedSheet], 1);

    expect(project.id).toBe("project-import-1783476000000");
    expect(project.title).toBe("导入文稿");
    expect(project.description).toBe("从 1 个 Markdown/text 文件创建。");
    expect(project.targetWords).toBe(1000);
    expect(project.tags).toEqual(["导入"]);
  });

  it("adds a project group while removing legacy system groups", () => {
    const project = projectWithGroups([{ id: "group-content", title: "正文" }]);
    const group = createProjectGroupDraft(project, { ...draft, title: "新分组" });

    const next = addProjectGroup(project, group);

    expect(next.groups?.map((item) => item.id)).toEqual([group.id]);
    expect(next.groups?.[0].title).toBe("新分组");
  });

  it("keeps the notes inbox fixed while reordering note groups", () => {
    const notesProject = projectWithGroups(
      [
        { id: NOTES_INBOX_GROUP_ID, title: "收件箱" },
        { id: "note-a", title: "A" },
        { id: "note-b", title: "B" },
      ],
      NOTES_PROJECT_ID,
    );

    const next = reorderProjectGroupsForRail(notesProject, "note-b", "note-a", "before");

    expect(next.groups?.map((item) => item.id)).toEqual([NOTES_INBOX_GROUP_ID, "note-b", "note-a"]);
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
