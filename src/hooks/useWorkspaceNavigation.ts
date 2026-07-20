import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { ProjectGroup, SidebarMode, WritingProject, WritingSheet } from "../types";
import { type ProjectFilter } from "../lib/projectModel";
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
  type WorkspaceSelectionUpdate,
} from "../lib/workspaceSelection";

interface UseWorkspaceNavigationOptions {
  selection: WorkspaceSelectionSnapshot;
  projects: WritingProject[];
  activeProject?: WritingProject;
  inboxProject: WritingProject;
  notesProject: WritingProject;
  noteGroups: ProjectGroup[];
  selectedNoteGroupId?: string;
  visibleProjectGroups: ProjectGroup[];
  selectedVisibleGroup?: ProjectGroup;
  filteredProjects: WritingProject[];
  sourceSheets: WritingSheet[];
  onActiveProjectChange: (projectId: string) => void;
  onActiveSheetChange: (sheetId: string) => void;
  onActiveGroupChange: (groupId: string) => void;
  onActiveNoteGroupChange: (groupId: string) => void;
  onSidebarModeChange: (mode: SidebarMode) => void;
  onProjectFilterChange: (filter: ProjectFilter) => void;
  onActiveGroupIdsByProjectChange: Dispatch<SetStateAction<Record<string, string>>>;
  onShowSheetListRail: () => void;
  onResetSheetFilters: () => void;
}

export function useWorkspaceNavigation(options: UseWorkspaceNavigationOptions) {
  const {
    selection,
    projects,
    activeProject,
    inboxProject,
    notesProject,
    noteGroups,
    selectedNoteGroupId,
    visibleProjectGroups,
    selectedVisibleGroup,
    filteredProjects,
    sourceSheets,
    onActiveProjectChange,
    onActiveSheetChange,
    onActiveGroupChange,
    onActiveNoteGroupChange,
    onSidebarModeChange,
    onProjectFilterChange,
    onActiveGroupIdsByProjectChange,
    onShowSheetListRail,
    onResetSheetFilters,
  } = options;
  const { activeProjectId, activeSheetId, activeGroupId, activeNoteGroupId, sidebarMode, projectFilter, activeGroupIdsByProject } =
    selection;

  function applySelection(update: WorkspaceSelectionUpdate) {
    if (update.activeProjectId !== undefined) onActiveProjectChange(update.activeProjectId);
    if (update.activeSheetId !== undefined) onActiveSheetChange(update.activeSheetId);
    if (update.activeGroupId !== undefined) onActiveGroupChange(update.activeGroupId);
    if (update.activeNoteGroupId !== undefined) onActiveNoteGroupChange(update.activeNoteGroupId);
    if (update.sidebarMode !== undefined) onSidebarModeChange(update.sidebarMode);
    if (update.projectFilter !== undefined) onProjectFilterChange(update.projectFilter);
    const rememberedGroup = update.rememberedGroup;
    if (rememberedGroup) {
      onActiveGroupIdsByProjectChange((current) => ({
        ...current,
        [rememberedGroup.projectId]: rememberedGroup.groupId,
      }));
    }
  }

  useEffect(() => {
    const nextSheetId = resolveLibrarySheetRepair({
      activeProject,
      activeSheetId,
      activeNoteGroupId,
      notesProject,
      selectedNoteGroupId: selectedNoteGroupId ?? "",
      sidebarMode,
    });
    if (nextSheetId !== undefined) onActiveSheetChange(nextSheetId);
  }, [activeNoteGroupId, activeProject, activeSheetId, notesProject, selectedNoteGroupId, sidebarMode, onActiveSheetChange]);

  useEffect(() => {
    const repair = resolveProjectSidebarRepair({
      activeProject,
      activeGroupId,
      activeSheetId,
      selectedVisibleGroup,
      sidebarMode,
      visibleProjectGroups,
    });
    if (!repair) return;
    if (repair.activeGroupId !== undefined) onActiveGroupChange(repair.activeGroupId);
    if (repair.activeSheetId !== undefined) onActiveSheetChange(repair.activeSheetId);
    if (repair.rememberedGroupId && activeProject) {
      onActiveGroupIdsByProjectChange((current) => ({
        ...current,
        [activeProject.id]: repair.rememberedGroupId ?? "",
      }));
    }
  }, [
    activeProject,
    activeGroupId,
    activeSheetId,
    selectedVisibleGroup,
    sidebarMode,
    visibleProjectGroups,
    onActiveGroupChange,
    onActiveGroupIdsByProjectChange,
    onActiveSheetChange,
  ]);

  useEffect(() => {
    const repair = resolveFilteredProjectRepair({
      activeNoteGroupId,
      activeProjectId,
      activeSheetId,
      filteredProjects,
      projectFilter,
      sourceSheetIds: new Set(sourceSheets.map((sheet) => sheet.id)),
    });
    if (!repair) return;
    if (repair.activeProjectId !== undefined) onActiveProjectChange(repair.activeProjectId);
    if (repair.activeSheetId !== undefined) onActiveSheetChange(repair.activeSheetId);
    if (repair.activeGroupId !== undefined) onActiveGroupChange(repair.activeGroupId);
  }, [
    activeNoteGroupId,
    activeProjectId,
    activeSheetId,
    filteredProjects,
    projectFilter,
    sourceSheets,
    onActiveGroupChange,
    onActiveProjectChange,
    onActiveSheetChange,
  ]);

  function enterProject(project: WritingProject) {
    onShowSheetListRail();
    applySelection(selectionForProjectEntry(project, activeGroupIdsByProject));
    onResetSheetFilters();
  }

  function selectProjectFilter(filter: ProjectFilter) {
    onShowSheetListRail();
    applySelection(selectionForProjectFilter(selection, filter, inboxProject));
    onResetSheetFilters();
  }

  function selectNoteGroup(groupId: string) {
    onShowSheetListRail();
    const update = selectionForNoteGroup(notesProject, noteGroups, groupId);
    if (!update) return;
    applySelection(update);
    onResetSheetFilters();
  }

  function selectProjectGroup(groupId: string) {
    if (!activeProject) return;
    onShowSheetListRail();
    applySelection(selectionForProjectGroup(activeProject, groupId));
    onResetSheetFilters();
  }

  function selectSheet(sheetId: string) {
    const update = selectionForSheet(projects, sheetId, selection, selectedNoteGroupId);
    if (update) applySelection(update);
  }

  return {
    enterProject,
    selectProjectFilter,
    selectNoteGroup,
    selectProjectGroup,
    selectSheet,
  };
}
