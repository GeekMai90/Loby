import { describe, expect, it } from "vitest";
import type { ProjectGroup, SheetManualOrders, WritingProject, WritingSheet } from "../types";
import { normalizeProjects } from "./projectModel";
import { createSheetListModel, updateSheetSortPreferences, updateVisibleSheetManualOrder } from "./sheetListModel";

describe("sheetListModel", () => {
  it("builds a searchable, manually ordered project-group list", () => {
    const projects = normalizeProjects([
      project({
        groups: [group("drafts", "草稿"), group("published", "已发布")],
        sheets: [
          sheet("one", { groupId: "drafts", title: "第一篇" }),
          sheet("two", { groupId: "drafts", title: "第二篇", body: "目标关键词" }),
          sheet("three", { groupId: "published", title: "第三篇" }),
        ],
      }),
    ]);
    const activeProject = projects[0];

    const model = createSheetListModel({
      projects,
      activeProject,
      activeSheetId: "two",
      activeGroupId: "drafts",
      activeNoteGroupId: "",
      sidebarMode: "project",
      projectFilter: "active",
      sheetSearch: "关键词",
      sheetSortPreferences: { "project:project-1:group:drafts": { mode: "manual", direction: "desc" } },
      sheetManualOrders: { "project:project-1:group:drafts": ["two", "one"] },
      currentDay: "2026-07-17",
    });

    expect(model.title).toBe("草稿");
    expect(model.sortPreferenceKey).toBe("project:project-1:group:drafts");
    expect(model.sourceSheets.map((item) => item.id)).toEqual(["one", "two"]);
    expect(model.filteredSheets.map((item) => item.id)).toEqual(["two"]);
    expect(model.activeSheetIndex).toBe(0);
    expect(model.canManuallyReorderSheets).toBe(false);
    expect(model.sheetActionGroupId).toBe("drafts");
  });

  it("builds the archived library list and preserves project titles", () => {
    const projects = normalizeProjects([
      project({ id: "active", title: "进行中", sheets: [sheet("active-sheet")] }),
      project({
        id: "archived",
        title: "旧项目",
        archivedAt: "2026-07-10",
        sheets: [sheet("archived-sheet", { archivedAt: undefined })],
      }),
    ]);

    const model = createSheetListModel({
      projects,
      activeProject: projects[0],
      activeSheetId: "archived-sheet",
      activeGroupId: "group-main",
      activeNoteGroupId: "",
      sidebarMode: "library",
      projectFilter: "archived",
      sheetSearch: "",
      sheetSortPreferences: {},
      sheetManualOrders: {},
      currentDay: "2026-07-17",
    });

    expect(model.title).toBe("已归档");
    expect(model.filteredProjects.map((item) => item.id)).toEqual(["archived"]);
    expect(model.filteredSheets.map((item) => item.id)).toEqual(["archived-sheet"]);
    expect(model.filteredSheets[0].archivedAt).toBe("2026-07-10");
    expect(model.sheetProjectTitleById).toMatchObject({ "active-sheet": "进行中", "archived-sheet": "旧项目" });
  });

  it("updates only the visible manual-order sequence", () => {
    const current: SheetManualOrders = {
      list: ["hidden", "one", "two"],
      other: ["kept"],
    };

    expect(updateVisibleSheetManualOrder(current, "list", ["one", "two", "three"], "three", "one", "before")).toEqual({
      list: ["three", "one", "two"],
      other: ["kept"],
    });
    expect(updateVisibleSheetManualOrder(current, "list", ["one", "two"], "one", "one", "after")).toBe(current);
  });

  it("preserves sort preference state when an update changes nothing", () => {
    const current = { list: { mode: "updated", direction: "desc" } } as const;

    expect(updateSheetSortPreferences(current, "list", { mode: "updated" })).toBe(current);
    expect(updateSheetSortPreferences(current, "list", { direction: "asc" })).toEqual({
      list: { mode: "updated", direction: "asc" },
    });
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
    sheets: [],
    updatedAt: "2026-07-17",
    ...overrides,
  };
}

function group(id: string, title: string): ProjectGroup {
  return { id, title, description: "" };
}

function sheet(id: string, overrides: Partial<WritingSheet> = {}): WritingSheet {
  return {
    id,
    title: id,
    groupId: "group-main",
    status: "构思",
    targetWords: 1000,
    summary: "",
    body: "",
    updatedAt: "2026-07-17",
    ...overrides,
  };
}
