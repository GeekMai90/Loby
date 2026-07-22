/**
 * [INPUT]: 依赖 shared 公共契约、写作库模块
 * [OUTPUT]: 对外提供 LibraryRefreshSelection、ReconciledLibraryRefreshSelection、reconcileLibraryRefreshSelection
 * [POS]: 写作库 feature 的领域模型边界，集中 写作库 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { WritingProject } from "@/shared/types";
import {
  getNotesProject,
  PROJECT_ALL_GROUP_ID,
  resolveProjectGroupId,
  resolveSavedProjectSelection,
} from "@/features/library/model/projectModel";

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
