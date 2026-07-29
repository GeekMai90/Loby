/**
 * [INPUT]: 依赖 Vitest、写作库列表模型、排序模型与 shared 公共契约
 * [OUTPUT]: 验证文稿列表上下文、筛选、手动排序偏好与对象级排序键缓存
 * [POS]: 写作库列表模型的回归边界，锁定正文提交只重算变化文稿的排序派生
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import type { ProjectGroup, SheetManualOrders, WritingProject, WritingSheet } from "@/shared/types";
import { normalizeProjects, PROJECT_ALL_GROUP_ID } from "@/features/library/model/projectModel";
import { createSheetListModel, updateSheetSortPreferences, updateVisibleSheetManualOrder } from "@/features/library/model/sheetListModel";
import { sortSheetList } from "@/features/library/model/sheetSorting";

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

  it("builds a project-wide list for the virtual all filter", () => {
    const projects = normalizeProjects([
      project({
        groups: [group("drafts", "草稿"), group("published", "已发布")],
        sheets: [
          sheet("one", { groupId: "drafts" }),
          sheet("two", { groupId: "published" }),
          sheet("archived", { groupId: "published", archivedAt: "2026-07-16" }),
        ],
      }),
    ]);

    const model = createSheetListModel({
      projects,
      activeProject: projects[0],
      activeSheetId: "one",
      activeGroupId: PROJECT_ALL_GROUP_ID,
      activeNoteGroupId: "",
      sidebarMode: "project",
      projectFilter: "active",
      sheetSearch: "",
      sheetSortPreferences: {},
      sheetManualOrders: {},
      currentDay: "2026-07-17",
    });

    expect(model.title).toBe("全部");
    expect(model.projectGroupFilterId).toBe(PROJECT_ALL_GROUP_ID);
    expect(model.selectedVisibleGroup).toBeUndefined();
    expect(model.sortPreferenceKey).toBe(`project:project-1:group:${PROJECT_ALL_GROUP_ID}`);
    expect(model.sourceSheets.map((item) => item.id)).toEqual(["one", "two"]);
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

  it("reuses title sort keys for unchanged sheet objects", () => {
    const observed = sheet("observed");
    let bodyReads = 0;
    Object.defineProperty(observed, "body", {
      configurable: true,
      enumerable: true,
      get() {
        bodyReads += 1;
        return "# 甲标题";
      },
    });
    const sheets = [sheet("other", { body: "# 乙标题" }), observed];

    sortSheetList(sheets, "title", "asc");
    sortSheetList(sheets, "title", "asc");

    expect(bodyReads).toBe(1);
  });
});

function project(overrides: Partial<WritingProject> = {}): WritingProject {
  return {
    id: "project-1",
    title: "项目",
    status: "构思",
    projectGoal: { enabled: false, unit: "words", target: 0 },
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
    tags: [],
    targetWords: 1000,
    description: "",
    body: "",
    createdAt: "2026-07-17",
    updatedAt: "2026-07-17",
    properties: {},
    ...overrides,
  };
}
