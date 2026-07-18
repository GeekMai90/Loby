import type { ProjectGroup, SidebarMode, WritingProject } from "../types";
import {
  getSheetsInGroup,
  getVisibleProjectGroups,
  INBOX_GROUP_ID,
  INBOX_PROJECT_ID,
  isNotesProject,
  NOTES_PROJECT_ID,
  resolveProjectGroupId,
  type ProjectFilter,
} from "./projectModel";

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
  const selectedGroup = groups.find((group) => group.id === savedGroupId) ?? groups[0];
  const firstSheet = selectedGroup ? getSheetsInGroup(project, selectedGroup.id)[0] : project.sheets[0];
  return {
    activeNoteGroupId: "",
    activeProjectId: project.id,
    activeGroupId: selectedGroup?.id ?? "",
    activeSheetId: firstSheet?.id ?? "",
    sidebarMode: "project",
    projectFilter: "active",
  };
}

export function selectionForProjectFilter(
  current: WorkspaceSelectionSnapshot,
  filter: ProjectFilter,
  inboxProject: WritingProject,
): WorkspaceSelectionUpdate {
  if (filter !== "inbox") {
    return { activeNoteGroupId: "", projectFilter: filter };
  }
  return {
    activeNoteGroupId: "",
    activeProjectId: INBOX_PROJECT_ID,
    activeGroupId: INBOX_GROUP_ID,
    activeSheetId: inboxProject.sheets.find((sheet) => !sheet.archivedAt)?.id ?? "",
    projectFilter: filter,
    sidebarMode: current.sidebarMode,
  };
}

export function selectionForNoteGroup(
  notesProject: WritingProject,
  noteGroups: ProjectGroup[],
  groupId: string,
): WorkspaceSelectionUpdate | null {
  const group = noteGroups.find((item) => item.id === groupId) ?? noteGroups[0];
  if (!group) return null;
  return {
    sidebarMode: "library",
    activeProjectId: NOTES_PROJECT_ID,
    activeGroupId: group.id,
    activeNoteGroupId: group.id,
    activeSheetId: getSheetsInGroup(notesProject, group.id)[0]?.id ?? "",
  };
}

export function selectionForProjectGroup(project: WritingProject, groupId: string): WorkspaceSelectionUpdate {
  return {
    activeGroupId: groupId,
    activeSheetId: getSheetsInGroup(project, groupId)[0]?.id ?? "",
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

export function resolveLibrarySheetRepair(options: {
  activeProject: WritingProject | undefined;
  activeSheetId: string;
  activeNoteGroupId: string;
  notesProject: WritingProject;
  selectedNoteGroupId: string;
  sidebarMode: SidebarMode;
}): string | undefined {
  if (!options.activeProject || options.sidebarMode === "project" || !options.activeSheetId) return undefined;
  if (options.activeNoteGroupId) {
    const groupSheets = options.selectedNoteGroupId ? getSheetsInGroup(options.notesProject, options.selectedNoteGroupId) : [];
    return groupSheets.some((sheet) => sheet.id === options.activeSheetId) ? undefined : (groupSheets[0]?.id ?? "");
  }
  return options.activeProject.sheets.some((sheet) => sheet.id === options.activeSheetId)
    ? undefined
    : (options.activeProject.sheets[0]?.id ?? "");
}

export interface ProjectSidebarRepair {
  activeGroupId?: string;
  activeSheetId?: string;
  rememberedGroupId?: string;
}

export function resolveProjectSidebarRepair(options: {
  activeProject: WritingProject | undefined;
  activeGroupId: string;
  activeSheetId: string;
  selectedVisibleGroup: ProjectGroup | undefined;
  sidebarMode: SidebarMode;
  visibleProjectGroups: ProjectGroup[];
}): ProjectSidebarRepair | null {
  const { activeProject } = options;
  if (!activeProject) return null;
  if (options.sidebarMode !== "project") {
    const groupId = resolveProjectGroupId(activeProject, options.activeGroupId, options.activeSheetId);
    return groupId && groupId !== options.activeGroupId ? { activeGroupId: groupId } : null;
  }

  const nextGroup = options.selectedVisibleGroup ?? options.visibleProjectGroups[0];
  if (!nextGroup) {
    return options.activeGroupId || options.activeSheetId ? { activeGroupId: "", activeSheetId: "" } : null;
  }
  const nextGroupSheets = getSheetsInGroup(activeProject, nextGroup.id);
  if (nextGroup.id !== options.activeGroupId) {
    return {
      activeGroupId: nextGroup.id,
      activeSheetId: nextGroupSheets[0]?.id ?? "",
      rememberedGroupId: nextGroup.id,
    };
  }
  if (!options.activeSheetId || nextGroupSheets.some((sheet) => sheet.id === options.activeSheetId)) return null;
  return { activeSheetId: nextGroupSheets[0]?.id ?? "" };
}

export function resolveFilteredProjectRepair(options: {
  activeNoteGroupId: string;
  activeProjectId: string;
  activeSheetId: string;
  filteredProjects: WritingProject[];
  projectFilter: ProjectFilter;
  sourceSheetIds: Set<string>;
}): WorkspaceSelectionUpdate | null {
  if (options.activeNoteGroupId || options.projectFilter === "inbox" || options.projectFilter === "trash") return null;
  if (!options.activeSheetId || options.sourceSheetIds.has(options.activeSheetId)) return null;
  if (options.filteredProjects.length === 0 || options.filteredProjects.some((project) => project.id === options.activeProjectId))
    return null;
  const project = options.filteredProjects[0];
  const sheetId = project.sheets[0]?.id ?? "";
  return {
    activeProjectId: project.id,
    activeSheetId: sheetId,
    activeGroupId: resolveProjectGroupId(project, "", sheetId),
  };
}
