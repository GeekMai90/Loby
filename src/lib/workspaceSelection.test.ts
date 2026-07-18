import { describe, expect, it } from "vitest";
import type { ProjectGroup, WritingProject, WritingSheet } from "../types";
import { createDefaultInboxProject, createDefaultNotesProject, NOTES_QUICK_GROUP_ID } from "./projectModel";
import {
  resolveFilteredProjectRepair,
  resolveLibrarySheetRepair,
  resolveProjectSidebarRepair,
  selectionForNoteGroup,
  selectionForProjectEntry,
  selectionForProjectFilter,
  selectionForProjectGroup,
  selectionForSheet,
  type WorkspaceSelectionSnapshot,
} from "./workspaceSelection";

const firstGroup: ProjectGroup = { id: "group-default", title: "待整理", icon: "inbox", iconColor: "#007aff", description: "" };
const secondGroup: ProjectGroup = { id: "group-published", title: "已发布", icon: "article", iconColor: "#007aff", description: "" };

function sheet(id: string, groupId: string): WritingSheet {
  return {
    id,
    title: id,
    groupId,
    type: "正文",
    status: "构思",
    targetWords: 1000,
    summary: "",
    body: `# ${id}`,
    updatedAt: "2026-07-19",
  };
}

function project(id: string, sheets = [sheet(`${id}-draft`, firstGroup.id), sheet(`${id}-published`, secondGroup.id)]): WritingProject {
  return {
    id,
    title: id,
    description: "",
    status: "构思",
    targetPlatform: "公众号",
    targetWords: 1000,
    tags: [],
    groups: [firstGroup, secondGroup],
    sheets,
    updatedAt: "2026-07-19",
  };
}

function snapshot(overrides: Partial<WorkspaceSelectionSnapshot> = {}): WorkspaceSelectionSnapshot {
  return {
    activeProjectId: "project-a",
    activeSheetId: "project-a-draft",
    activeGroupId: firstGroup.id,
    activeNoteGroupId: "",
    sidebarMode: "library",
    projectFilter: "active",
    activeGroupIdsByProject: {},
    ...overrides,
  };
}

describe("workspace selection", () => {
  it("enters a project through its remembered group and first sheet", () => {
    expect(selectionForProjectEntry(project("project-a"), { "project-a": secondGroup.id })).toMatchObject({
      activeProjectId: "project-a",
      activeGroupId: secondGroup.id,
      activeSheetId: "project-a-published",
      sidebarMode: "project",
      projectFilter: "active",
    });
  });

  it("opens a note group and falls back to the first available group", () => {
    const notes = createDefaultNotesProject();
    expect(selectionForNoteGroup(notes, notes.groups ?? [], "missing")).toMatchObject({
      activeProjectId: notes.id,
      activeGroupId: NOTES_QUICK_GROUP_ID,
      activeNoteGroupId: NOTES_QUICK_GROUP_ID,
      sidebarMode: "library",
    });
  });

  it("opens Inbox at its first active sheet and keeps the current rail mode", () => {
    const inbox = createDefaultInboxProject();
    inbox.sheets = [{ ...sheet("archived", "inbox-default"), archivedAt: "2026-07-18" }, sheet("active", "inbox-default")];
    expect(selectionForProjectFilter(snapshot({ sidebarMode: "project" }), "inbox", inbox)).toMatchObject({
      activeProjectId: inbox.id,
      activeSheetId: "active",
      activeGroupId: "inbox-default",
      activeNoteGroupId: "",
      projectFilter: "inbox",
      sidebarMode: "project",
    });
  });

  it("selects a project group and remembers it for the next project entry", () => {
    expect(selectionForProjectGroup(project("project-a"), secondGroup.id)).toEqual({
      activeGroupId: secondGroup.id,
      activeSheetId: "project-a-published",
      rememberedGroup: { projectId: "project-a", groupId: secondGroup.id },
    });
  });

  it("keeps the smart-list context when selecting a sheet from another project", () => {
    const next = selectionForSheet(
      [project("project-a"), project("project-b")],
      "project-b-published",
      snapshot({ projectFilter: "recent" }),
    );
    expect(next).toMatchObject({
      activeProjectId: "project-b",
      activeSheetId: "project-b-published",
      activeGroupId: secondGroup.id,
      sidebarMode: "library",
      activeNoteGroupId: "",
      rememberedGroup: { projectId: "project-b", groupId: secondGroup.id },
    });
  });

  it("repairs a project view after its selected group or sheet disappears", () => {
    const activeProject = project("project-a", [sheet("remaining", secondGroup.id)]);
    expect(
      resolveProjectSidebarRepair({
        activeProject,
        activeGroupId: firstGroup.id,
        activeSheetId: "removed",
        selectedVisibleGroup: undefined,
        sidebarMode: "project",
        visibleProjectGroups: [secondGroup],
      }),
    ).toEqual({ activeGroupId: secondGroup.id, activeSheetId: "remaining", rememberedGroupId: secondGroup.id });
  });

  it("repairs a note-group sheet without escaping into another group", () => {
    const notes = createDefaultNotesProject();
    notes.sheets = [sheet("quick-note", NOTES_QUICK_GROUP_ID)];
    expect(
      resolveLibrarySheetRepair({
        activeProject: notes,
        activeSheetId: "removed-note",
        activeNoteGroupId: NOTES_QUICK_GROUP_ID,
        notesProject: notes,
        selectedNoteGroupId: NOTES_QUICK_GROUP_ID,
        sidebarMode: "library",
      }),
    ).toBe("quick-note");
  });

  it("moves a filtered selection only when its project is no longer visible", () => {
    const visible = project("project-b");
    expect(
      resolveFilteredProjectRepair({
        activeNoteGroupId: "",
        activeProjectId: "project-a",
        activeSheetId: "project-a-draft",
        filteredProjects: [visible],
        projectFilter: "active",
        sourceSheetIds: new Set(visible.sheets.map((item) => item.id)),
      }),
    ).toEqual({
      activeProjectId: "project-b",
      activeSheetId: "project-b-draft",
      activeGroupId: firstGroup.id,
    });
  });

  it("does not repair Inbox or trash smart-list selection", () => {
    const inbox = createDefaultInboxProject();
    expect(
      resolveFilteredProjectRepair({
        activeNoteGroupId: "",
        activeProjectId: inbox.id,
        activeSheetId: "missing",
        filteredProjects: [project("project-b")],
        projectFilter: "inbox",
        sourceSheetIds: new Set(),
      }),
    ).toBeNull();
  });
});
