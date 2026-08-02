/**
 * [INPUT]: 依赖 React 运行时、shared 公共契约、写作库模块
 * [OUTPUT]: 对外提供 useWorkspaceNavigation；项目、分组与分类导航只更新浏览上下文，不自动替换当前编辑文稿
 * [POS]: 写作库 feature 的 React 协调边界，封装浏览范围切换、副作用与用户主动选择文稿的动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { ProjectGroup, SidebarMode, WritingProject } from "@/shared/types";
import { type ProjectFilter } from "@/features/library/model/projectModel";
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
} from "@/features/library/model/workspaceSelection";

interface UseWorkspaceNavigationOptions {
  selection: WorkspaceSelectionSnapshot;
  projects: WritingProject[];
  activeProject?: WritingProject;
  noteGroups: ProjectGroup[];
  visibleProjectGroups: ProjectGroup[];
  selectedVisibleGroup?: ProjectGroup;
  filteredProjects: WritingProject[];
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
    noteGroups,
    visibleProjectGroups,
    selectedVisibleGroup,
    filteredProjects,
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
      projects,
      activeSheetId,
    });
    if (nextSheetId !== undefined) onActiveSheetChange(nextSheetId);
  }, [activeSheetId, onActiveSheetChange, projects]);

  useEffect(() => {
    const repair = resolveProjectSidebarRepair({
      activeProject,
      activeGroupId,
      selectedVisibleGroup,
      sidebarMode,
      visibleProjectGroups,
    });
    if (!repair) return;
    if (repair.activeGroupId !== undefined) onActiveGroupChange(repair.activeGroupId);
    if (repair.rememberedGroupId && activeProject) {
      onActiveGroupIdsByProjectChange((current) => ({
        ...current,
        [activeProject.id]: repair.rememberedGroupId ?? "",
      }));
    }
  }, [
    activeProject,
    activeGroupId,
    selectedVisibleGroup,
    sidebarMode,
    visibleProjectGroups,
    onActiveGroupChange,
    onActiveGroupIdsByProjectChange,
  ]);

  useEffect(() => {
    const repair = resolveFilteredProjectRepair({
      activeNoteGroupId,
      activeProjectId,
      filteredProjects,
      projectFilter,
    });
    if (!repair) return;
    if (repair.activeProjectId !== undefined) onActiveProjectChange(repair.activeProjectId);
    if (repair.activeGroupId !== undefined) onActiveGroupChange(repair.activeGroupId);
  }, [activeNoteGroupId, activeProjectId, filteredProjects, projectFilter, onActiveGroupChange, onActiveProjectChange]);

  function enterProject(project: WritingProject) {
    onShowSheetListRail();
    applySelection(selectionForProjectEntry(project, activeGroupIdsByProject));
    onResetSheetFilters();
  }

  function selectProjectFilter(filter: ProjectFilter) {
    onShowSheetListRail();
    applySelection(selectionForProjectFilter(selection, filter));
    onResetSheetFilters();
  }

  function selectNoteGroup(groupId: string) {
    onShowSheetListRail();
    const update = selectionForNoteGroup(noteGroups, groupId);
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
    const update = selectionForSheet(projects, sheetId, selection, activeNoteGroupId);
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
