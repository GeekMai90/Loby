import type { WritingProject } from "../types";
import { getNotesProject, PROJECT_ALL_GROUP_ID, resolveProjectGroupId, resolveSavedProjectSelection } from "./projectModel";

export interface LibraryRefreshSelection {
  activeProjectId: string;
  activeSheetId: string;
  activeGroupId: string;
  activeNoteGroupId: string;
}

export interface ReconciledLibraryRefreshSelection {
  activeProjectId: string;
  activeSheetId: string;
  activeGroupId: string;
  resetSidebarMode: boolean;
  clearActiveNoteGroup: boolean;
}

export function reconcileLibraryRefreshSelection(
  projects: WritingProject[],
  selection: LibraryRefreshSelection,
): ReconciledLibraryRefreshSelection {
  const activeProject = projects.find((project) => project.id === selection.activeProjectId);
  const activeSheet = activeProject?.sheets.find((sheet) => sheet.id === selection.activeSheetId);
  const activeGroupExists =
    selection.activeGroupId === PROJECT_ALL_GROUP_ID ||
    (activeProject?.groups?.some((group) => group.id === selection.activeGroupId) ?? false);
  const activeNoteGroupExists = getNotesProject(projects).groups?.some((group) => group.id === selection.activeNoteGroupId) ?? false;

  if (activeProject) {
    return {
      activeProjectId: activeProject.id,
      activeSheetId: activeSheet?.id ?? "",
      activeGroupId: activeGroupExists ? selection.activeGroupId : resolveProjectGroupId(activeProject, "", activeSheet?.id ?? ""),
      resetSidebarMode: false,
      clearActiveNoteGroup: Boolean(selection.activeNoteGroupId) && !activeNoteGroupExists,
    };
  }

  const restoredSelection = resolveSavedProjectSelection(projects, "", "");
  const restoredProject = projects.find((project) => project.id === restoredSelection.projectId);
  return {
    activeProjectId: restoredSelection.projectId,
    activeSheetId: restoredSelection.sheetId,
    activeGroupId: restoredProject ? resolveProjectGroupId(restoredProject, "", restoredSelection.sheetId) : "",
    resetSidebarMode: true,
    clearActiveNoteGroup: Boolean(selection.activeNoteGroupId) && !activeNoteGroupExists,
  };
}
