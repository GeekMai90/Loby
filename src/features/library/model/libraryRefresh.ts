/**
 * [INPUT]: 依赖 shared 公共契约、写作库模块
 * [OUTPUT]: 对外提供 LibraryRefreshSelection、ReconciledLibraryRefreshSelection、reconcileLibraryRefreshSelection
 * [POS]: 写作库 feature 的领域模型边界，刷新时分别恢复浏览项目与全库当前编辑文稿，不因当前项目变化丢失编辑上下文
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
  const activeSheetProject = projects.find((project) => project.sheets.some((sheet) => sheet.id === selection.activeSheetId));
  const activeSheet = activeSheetProject?.sheets.find((sheet) => sheet.id === selection.activeSheetId);
  const activeGroupExists =
    selection.activeGroupId === PROJECT_ALL_GROUP_ID ||
    (activeProject?.groups?.some((group) => group.id === selection.activeGroupId) ?? false);
  const activeNoteGroupExists = getNotesProject(projects).groups?.some((group) => group.id === selection.activeNoteGroupId) ?? false;

  if (activeProject) {
    return {
      activeProjectId: activeProject.id,
      activeSheetId: activeSheet?.id ?? "",
      activeGroupId: activeGroupExists
        ? selection.activeGroupId
        : resolveProjectGroupId(activeProject, "", activeSheetProject?.id === activeProject.id ? (activeSheet?.id ?? "") : ""),
      resetSidebarMode: false,
      clearActiveNoteGroup: Boolean(selection.activeNoteGroupId) && !activeNoteGroupExists,
    };
  }

  const restoredSelection = resolveSavedProjectSelection(projects, "", "");
  const restoredProject = projects.find((project) => project.id === restoredSelection.projectId);
  const restoredSheetProject = projects.find((project) => project.sheets.some((sheet) => sheet.id === selection.activeSheetId));
  const restoredSheet = restoredSheetProject?.sheets.find((sheet) => sheet.id === selection.activeSheetId);
  return {
    activeProjectId: restoredSelection.projectId,
    activeSheetId: restoredSheet?.id ?? restoredSelection.sheetId,
    activeGroupId:
      restoredProject && restoredSheetProject?.id === restoredProject.id
        ? resolveProjectGroupId(restoredProject, "", restoredSheet?.id ?? "")
        : restoredProject
          ? resolveProjectGroupId(restoredProject, "", "")
          : "",
    resetSidebarMode: true,
    clearActiveNoteGroup: Boolean(selection.activeNoteGroupId) && !activeNoteGroupExists,
  };
}
