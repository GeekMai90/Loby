/**
 * [INPUT]: 依赖 shared 公共契约、写作库模块
 * [OUTPUT]: 对外提供工作区选择快照、只改变浏览范围的导航转换与写作库刷新后的文稿选择修复能力
 * [POS]: 写作库 feature 的领域模型边界，集中区分项目浏览上下文与当前编辑文稿，避免导航动作替换编辑器内容
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { ProjectGroup, SidebarMode, WritingProject } from "@/shared/types";
import {
  getVisibleProjectGroups,
  INBOX_GROUP_ID,
  INBOX_PROJECT_ID,
  isNotesProject,
  NOTES_PROJECT_ID,
  PROJECT_ALL_GROUP_ID,
  resolveProjectGroupId,
  type ProjectFilter,
} from "@/features/library/model/projectModel";

export interface WorkspaceSelectionSnapshot {
  activeProjectId: string;
  activeSheetId: string;
  activeGroupId: string;
  activeNoteGroupId: string;
  sidebarMode: SidebarMode;
  projectFilter: ProjectFilter;
  activeGroupIdsByProject: Record<string, string>;
}

export type WorkspaceSelectionUpdate = Partial<Omit<WorkspaceSelectionSnapshot, "activeGroupIdsByProject">> & {
  rememberedGroup?: { projectId: string; groupId: string };
};

export function selectionForProjectEntry(
  project: WritingProject,
  activeGroupIdsByProject: Record<string, string>,
): WorkspaceSelectionUpdate {
  const groups = getVisibleProjectGroups(project);
  const savedGroupId = activeGroupIdsByProject[project.id];
  const selectedGroupId =
    savedGroupId === PROJECT_ALL_GROUP_ID || groups.some((group) => group.id === savedGroupId) ? savedGroupId : PROJECT_ALL_GROUP_ID;
  return {
    activeNoteGroupId: "",
    activeProjectId: project.id,
    activeGroupId: selectedGroupId,
    sidebarMode: "project",
    projectFilter: "active",
  };
}

export function selectionForProjectFilter(current: WorkspaceSelectionSnapshot, filter: ProjectFilter): WorkspaceSelectionUpdate {
  if (filter !== "inbox") {
    return { activeNoteGroupId: "", projectFilter: filter };
  }
  return {
    activeNoteGroupId: "",
    activeProjectId: INBOX_PROJECT_ID,
    activeGroupId: INBOX_GROUP_ID,
    projectFilter: filter,
    sidebarMode: current.sidebarMode,
  };
}

export function selectionForNoteGroup(noteGroups: ProjectGroup[], groupId: string): WorkspaceSelectionUpdate | null {
  const group = noteGroups.find((item) => item.id === groupId) ?? noteGroups[0];
  if (!group) return null;
  return {
    sidebarMode: "library",
    activeProjectId: NOTES_PROJECT_ID,
    activeGroupId: group.id,
    activeNoteGroupId: group.id,
  };
}

export function selectionForProjectGroup(project: WritingProject, groupId: string): WorkspaceSelectionUpdate {
  return {
    activeGroupId: groupId,
    rememberedGroup: { projectId: project.id, groupId },
  };
}

export function selectionForSheet(
  projects: WritingProject[],
  sheetId: string,
  current: WorkspaceSelectionSnapshot,
  selectedNoteGroupId = "",
): WorkspaceSelectionUpdate | null {
  const ownerProject = projects.find((project) => project.sheets.some((sheet) => sheet.id === sheetId));
  if (!ownerProject) return null;
  const ownerSheet = ownerProject.sheets.find((sheet) => sheet.id === sheetId);
  const update: WorkspaceSelectionUpdate = { activeSheetId: sheetId };

  if (ownerProject.id !== current.activeProjectId) {
    update.activeProjectId = ownerProject.id;
    if (ownerSheet?.groupId) {
      update.activeGroupId = ownerSheet.groupId;
      update.rememberedGroup = { projectId: ownerProject.id, groupId: ownerSheet.groupId };
    }
  }

  if (current.sidebarMode === "library" && !current.activeNoteGroupId) {
    update.activeNoteGroupId = "";
    update.sidebarMode = "library";
    return update;
  }
  if (isNotesProject(ownerProject)) {
    update.activeNoteGroupId = ownerSheet?.groupId ?? selectedNoteGroupId;
    update.sidebarMode = "library";
  } else {
    update.activeNoteGroupId = "";
  }
  return update;
}

export function resolveLibrarySheetRepair(options: { projects: WritingProject[]; activeSheetId: string }): string | undefined {
  if (!options.activeSheetId) return undefined;
  return options.projects.some((project) => project.sheets.some((sheet) => sheet.id === options.activeSheetId)) ? undefined : "";
}

export interface ProjectSidebarRepair {
  activeGroupId?: string;
  rememberedGroupId?: string;
}

export function resolveProjectSidebarRepair(options: {
  activeProject: WritingProject | undefined;
  activeGroupId: string;
  selectedVisibleGroup: ProjectGroup | undefined;
  sidebarMode: SidebarMode;
  visibleProjectGroups: ProjectGroup[];
}): ProjectSidebarRepair | null {
  const { activeProject } = options;
  if (!activeProject) return null;
  if (options.sidebarMode !== "project") {
    const groupId = resolveProjectGroupId(activeProject, options.activeGroupId, "");
    return groupId && groupId !== options.activeGroupId ? { activeGroupId: groupId } : null;
  }

  if (options.activeGroupId === PROJECT_ALL_GROUP_ID) {
    return null;
  }

  const nextGroup = options.selectedVisibleGroup ?? options.visibleProjectGroups[0];
  if (!nextGroup) {
    return options.activeGroupId ? { activeGroupId: "" } : null;
  }
  if (nextGroup.id !== options.activeGroupId) {
    return {
      activeGroupId: nextGroup.id,
      rememberedGroupId: nextGroup.id,
    };
  }
  return null;
}

export function resolveFilteredProjectRepair(options: {
  activeNoteGroupId: string;
  activeProjectId: string;
  filteredProjects: WritingProject[];
  projectFilter: ProjectFilter;
}): WorkspaceSelectionUpdate | null {
  if (options.activeNoteGroupId || options.projectFilter === "inbox" || options.projectFilter === "trash") return null;
  if (options.filteredProjects.length === 0 || options.filteredProjects.some((project) => project.id === options.activeProjectId))
    return null;
  const project = options.filteredProjects[0];
  return {
    activeProjectId: project.id,
    activeGroupId: resolveProjectGroupId(project, "", ""),
  };
}
