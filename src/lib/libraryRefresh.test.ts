import { describe, expect, it } from "vitest";
import { createDefaultNotesProject, normalizeProjects, PROJECT_ALL_GROUP_ID } from "./projectModel";
import { reconcileLibraryRefreshSelection } from "./libraryRefresh";
import { seedProjects } from "../seed";
import type { WritingProject } from "../types";

describe("reconcileLibraryRefreshSelection", () => {
  it("keeps the active project while falling back from removed sheet and group", () => {
    const projects = normalizeProjects(structuredClone(seedProjects));
    const activeProject = projects[0]!;
    activeProject.groups = [
      { id: "group-current", title: "当前组", icon: "folder", iconColor: "#000000" },
      { id: "group-fallback", title: "保留组", icon: "folder", iconColor: "#000000" },
    ];
    activeProject.sheets = [{ ...activeProject.sheets[0]!, groupId: "group-fallback" }];

    expect(
      reconcileLibraryRefreshSelection(projects, {
        activeProjectId: activeProject.id,
        activeSheetId: "removed-sheet",
        activeGroupId: "removed-group",
        activeNoteGroupId: "",
      }),
    ).toEqual({
      activeProjectId: activeProject.id,
      activeSheetId: "",
      activeGroupId: "group-fallback",
      resetSidebarMode: false,
      clearActiveNoteGroup: false,
    });
  });

  it("restores the first available selection when the active project was removed", () => {
    const projects = normalizeProjects(structuredClone(seedProjects)).slice(1);
    const firstProject = projects[0]!;

    const result = reconcileLibraryRefreshSelection(projects, {
      activeProjectId: "removed-project",
      activeSheetId: "removed-sheet",
      activeGroupId: "removed-group",
      activeNoteGroupId: "",
    });

    expect(result.activeProjectId).toBe(firstProject.id);
    expect(result.activeSheetId).toBe(firstProject.sheets[0]?.id);
    expect(result.resetSidebarMode).toBe(true);
  });

  it("preserves the virtual all filter across external library refreshes", () => {
    const projects = normalizeProjects(structuredClone(seedProjects));
    const activeProject = projects[0]!;

    expect(
      reconcileLibraryRefreshSelection(projects, {
        activeProjectId: activeProject.id,
        activeSheetId: activeProject.sheets[0]!.id,
        activeGroupId: PROJECT_ALL_GROUP_ID,
        activeNoteGroupId: "",
      }).activeGroupId,
    ).toBe(PROJECT_ALL_GROUP_ID);
  });

  it("clears only a note-group selection that disappeared externally", () => {
    const notes = createDefaultNotesProject();
    notes.groups = [{ id: "notes-kept", title: "保留", icon: "inbox", iconColor: "#000000" }];
    const projects = normalizeProjects([...structuredClone(seedProjects), notes]);
    const activeProject = projects[0]!;

    expect(
      reconcileLibraryRefreshSelection(projects, {
        activeProjectId: activeProject.id,
        activeSheetId: activeProject.sheets[0]!.id,
        activeGroupId: activeProject.groups![0]!.id,
        activeNoteGroupId: "notes-removed",
      }).clearActiveNoteGroup,
    ).toBe(true);

    expect(
      reconcileLibraryRefreshSelection(projects, {
        activeProjectId: activeProject.id,
        activeSheetId: activeProject.sheets[0]!.id,
        activeGroupId: activeProject.groups![0]!.id,
        activeNoteGroupId: "notes-kept",
      }).clearActiveNoteGroup,
    ).toBe(false);
  });

  it("finds a retained selection in a large library without mutating the project list", () => {
    const projectTemplate = structuredClone(seedProjects[0]!);
    const projects: WritingProject[] = Array.from({ length: 2_000 }, (_, index) => ({
      ...structuredClone(projectTemplate),
      id: `project-${index}`,
      sheets: projectTemplate.sheets.map((sheet, sheetIndex) => ({
        ...structuredClone(sheet),
        id: `project-${index}-sheet-${sheetIndex}`,
      })),
    }));
    const snapshot = structuredClone(projects);

    const result = reconcileLibraryRefreshSelection(projects, {
      activeProjectId: "project-1999",
      activeSheetId: "project-1999-sheet-3",
      activeGroupId: "",
      activeNoteGroupId: "",
    });

    expect(result.activeProjectId).toBe("project-1999");
    expect(result.activeSheetId).toBe("project-1999-sheet-3");
    expect(projects).toEqual(snapshot);
  });
});
