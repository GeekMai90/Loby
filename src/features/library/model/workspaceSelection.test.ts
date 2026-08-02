import { describe, expect, it } from "vitest";
import type { ProjectGroup, WritingProject, WritingSheet } from "@/shared/types";
import {
  createDefaultInboxProject,
  createDefaultNotesProject,
  NOTES_QUICK_GROUP_ID,
  INBOX_PROJECT_ID,
  PROJECT_ALL_GROUP_ID,
} from "@/features/library/model/projectModel";
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
} from "@/features/library/model/workspaceSelection";

const firstGroup: ProjectGroup = { id: "group-default", title: "待整理", icon: "inbox", iconColor: "#007aff", description: "" };
const secondGroup: ProjectGroup = { id: "group-published", title: "已发布", icon: "article", iconColor: "#007aff", description: "" };

function sheet(id: string, groupId: string): WritingSheet {
  return {
    id,
    title: id,
    groupId,
    tags: [],
    targetWords: 1000,
    description: "",
    body: `# ${id}`,
    createdAt: "2026-07-19",
    updatedAt: "2026-07-19",
    properties: {},
  };
}

function project(id: string, sheets = [sheet(`${id}-draft`, firstGroup.id), sheet(`${id}-published`, secondGroup.id)]): WritingProject {
  return {
    id,
    title: id,
    status: "构思",
    projectGoal: { enabled: false, unit: "words", target: 0 },
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
  it("enters a project through its remembered group without selecting a sheet", () => {
    expect(selectionForProjectEntry(project("project-a"), { "project-a": secondGroup.id })).toEqual({
      activeNoteGroupId: "",
      activeProjectId: "project-a",
      activeGroupId: secondGroup.id,
      sidebarMode: "project",
      projectFilter: "active",
    });
  });

  it("defaults to the virtual all filter when entering a project without a remembered group", () => {
    expect(selectionForProjectEntry(project("project-a"), {})).toEqual({
      activeNoteGroupId: "",
      activeProjectId: "project-a",
      activeGroupId: PROJECT_ALL_GROUP_ID,
      sidebarMode: "project",
      projectFilter: "active",
    });
  });

  it("opens a note group and falls back to the first available group", () => {
    const notes = createDefaultNotesProject();
    expect(selectionForNoteGroup(notes.groups ?? [], "missing")).toMatchObject({
      activeProjectId: notes.id,
      activeGroupId: NOTES_QUICK_GROUP_ID,
      activeNoteGroupId: NOTES_QUICK_GROUP_ID,
      sidebarMode: "library",
    });
  });

  it("opens Inbox without replacing the current sheet and keeps the current rail mode", () => {
    expect(selectionForProjectFilter(snapshot({ sidebarMode: "project" }), "inbox")).toMatchObject({
      activeProjectId: INBOX_PROJECT_ID,
      activeGroupId: "inbox-default",
      activeNoteGroupId: "",
      projectFilter: "inbox",
      sidebarMode: "project",
    });
  });

  it("selects a project group and remembers it for the next project entry", () => {
    expect(selectionForProjectGroup(project("project-a"), secondGroup.id)).toEqual({
      activeGroupId: secondGroup.id,
      rememberedGroup: { projectId: "project-a", groupId: secondGroup.id },
    });
  });

  it("selects the virtual all filter without treating it as a stored project group", () => {
    expect(selectionForProjectGroup(project("project-a"), PROJECT_ALL_GROUP_ID)).toEqual({
      activeGroupId: PROJECT_ALL_GROUP_ID,
      rememberedGroup: { projectId: "project-a", groupId: PROJECT_ALL_GROUP_ID },
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
        selectedVisibleGroup: undefined,
        sidebarMode: "project",
        visibleProjectGroups: [secondGroup],
      }),
    ).toEqual({ activeGroupId: secondGroup.id, rememberedGroupId: secondGroup.id });
  });

  it("keeps the all filter selected without repairing the editor sheet", () => {
    const activeProject = project("project-a", [sheet("remaining", secondGroup.id)]);
    expect(
      resolveProjectSidebarRepair({
        activeProject,
        activeGroupId: PROJECT_ALL_GROUP_ID,
        selectedVisibleGroup: undefined,
        sidebarMode: "project",
        visibleProjectGroups: [firstGroup, secondGroup],
      }),
    ).toBeNull();
  });

  it("clears an editor sheet only after it disappears from the library", () => {
    const notes = createDefaultNotesProject();
    notes.sheets = [sheet("quick-note", NOTES_QUICK_GROUP_ID)];
    expect(
      resolveLibrarySheetRepair({
        projects: [notes],
        activeSheetId: "removed-note",
      }),
    ).toBe("");
  });

  it("moves the browsing project only when it is no longer visible", () => {
    const visible = project("project-b");
    expect(
      resolveFilteredProjectRepair({
        activeNoteGroupId: "",
        activeProjectId: "project-a",
        filteredProjects: [visible],
        projectFilter: "active",
      }),
    ).toEqual({
      activeProjectId: "project-b",
      activeGroupId: firstGroup.id,
    });
  });

  it("does not repair Inbox or trash smart-list selection", () => {
    const inbox = createDefaultInboxProject();
    expect(
      resolveFilteredProjectRepair({
        activeNoteGroupId: "",
        activeProjectId: inbox.id,
        filteredProjects: [project("project-b")],
        projectFilter: "inbox",
      }),
    ).toBeNull();
  });
});
