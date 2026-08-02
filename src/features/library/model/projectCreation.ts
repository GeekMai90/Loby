/**
 * [INPUT]: 依赖 写作库模块、shared 公共契约、编辑器模块
 * [OUTPUT]: 对外提供创建带新文稿目标默认值的通用空项目 createWritingProject，以及选择、分组、排序和移动等公开能力
 * [POS]: 写作库 feature 的领域模型边界；项目创建不生成内容，只通过编辑器模型建立文稿创建默认值，移动文稿保留其内容更新时间
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import {
  DEFAULT_NEW_PROJECT_TITLE,
  DEFAULT_PROJECT_ICON,
  DEFAULT_PROJECT_ICON_COLOR,
  type NewProjectDraft,
} from "@/features/library/constants/projectAppearance";
import type { ProjectGroup, WritingProject, WritingSheet } from "@/shared/types";
import { nowTimestamp, today } from "@/shared/lib/dates";
import { applyDefinitionDefaultsToSheet } from "@/features/editor/model/documentProperties";
import {
  createDefaultProjectGroups,
  DEFAULT_USER_GROUP_ID,
  getVisibleProjectGroups,
  INBOX_GROUP_ID,
  isInboxProject,
  isNotesProject,
  isSystemProjectGroupId,
  NOTES_QUICK_GROUP_ID,
  normalizeProject,
  PROJECT_ALL_GROUP_ID,
} from "@/features/library/model/projectModel";
import { moveItemById, type RailDropPosition } from "@/features/library/model/sheetSorting";

export function createWritingProject(draft: NewProjectDraft): WritingProject {
  const timestamp = Date.now();
  const now = nowTimestamp();
  const projectTitle = draft.title.trim() || DEFAULT_NEW_PROJECT_TITLE;
  const goalTarget = Math.max(0, Math.round(draft.goalTarget ?? 0));
  const goalEnabled = Boolean(draft.goalEnabled) && goalTarget > 0;
  const goalUnit = draft.goalUnit ?? "words";
  const project: WritingProject = {
    id: `project-${timestamp}`,
    title: projectTitle,
    icon: draft.icon || DEFAULT_PROJECT_ICON,
    iconColor: draft.iconColor || DEFAULT_PROJECT_ICON_COLOR,
    status: "构思",
    projectGoal: { enabled: goalEnabled, unit: goalUnit, target: goalTarget },
    documentPropertyDefinitions: [],
    updatedAt: now,
    groups: createDefaultProjectGroups(),
    sheets: [],
  };

  return normalizeProject(project);
}

export function getInitialProjectSelection(project: WritingProject) {
  const firstSheet = project.sheets.find((sheet) => !sheet.archivedAt);
  return {
    groupId: PROJECT_ALL_GROUP_ID,
    sheetId: firstSheet?.id ?? project.sheets[0]?.id ?? "",
  };
}

export function createProjectGroupDraft(targetProject: WritingProject, draft: NewProjectDraft): ProjectGroup {
  const title = draft.title.trim() || "无标题";
  const isNotesGroup = isNotesProject(targetProject);
  return {
    id: `${isNotesGroup ? "note-group" : "group"}-${Date.now()}`,
    title,
    icon: draft.icon || DEFAULT_PROJECT_ICON,
    iconColor: draft.iconColor || DEFAULT_PROJECT_ICON_COLOR,
    description: "",
  };
}

export function addProjectGroup(project: WritingProject, group: ProjectGroup): WritingProject {
  return {
    ...project,
    groups: [...(project.groups ?? []).filter((item) => !isSystemProjectGroupId(item.id)), group],
    updatedAt: today(),
  };
}

export function reorderProjectGroupsForRail(
  project: WritingProject,
  sourceGroupId: string,
  targetGroupId: string,
  position: RailDropPosition,
): WritingProject {
  const visibleGroups = (project.groups ?? []).filter((group) => !isSystemProjectGroupId(group.id));
  if (isInboxProject(project)) return project;
  if (isNotesProject(project)) {
    if (sourceGroupId === NOTES_QUICK_GROUP_ID || targetGroupId === NOTES_QUICK_GROUP_ID) return project;
    const defaultGroup = visibleGroups.find((group) => group.id === NOTES_QUICK_GROUP_ID);
    const reorderableGroups = visibleGroups.filter((group) => group.id !== NOTES_QUICK_GROUP_ID);
    const reorderedGroups = moveItemById(reorderableGroups, sourceGroupId, targetGroupId, position);
    return {
      ...project,
      groups: defaultGroup ? [defaultGroup, ...reorderedGroups] : reorderedGroups,
      updatedAt: today(),
    };
  }
  if (sourceGroupId === DEFAULT_USER_GROUP_ID || targetGroupId === DEFAULT_USER_GROUP_ID) return project;
  const defaultGroup = visibleGroups.find((group) => group.id === DEFAULT_USER_GROUP_ID);
  const reorderableGroups = visibleGroups.filter((group) => group.id !== DEFAULT_USER_GROUP_ID);
  return {
    ...project,
    groups: defaultGroup ? [defaultGroup, ...moveItemById(reorderableGroups, sourceGroupId, targetGroupId, position)] : reorderableGroups,
    updatedAt: today(),
  };
}

export interface SheetMoveTarget {
  projectId: string;
  groupId?: string;
}

export function resolveSheetMoveGroupId(project: WritingProject, preferredGroupId = ""): string {
  const groups = getVisibleProjectGroups(project);
  if (preferredGroupId && groups.some((group) => group.id === preferredGroupId)) return preferredGroupId;
  if (isInboxProject(project)) return INBOX_GROUP_ID;
  if (isNotesProject(project)) return NOTES_QUICK_GROUP_ID;
  return groups.find((group) => group.id === DEFAULT_USER_GROUP_ID)?.id ?? groups[0]?.id ?? DEFAULT_USER_GROUP_ID;
}

export function moveSheetBetweenProjects(
  projects: WritingProject[],
  sheetId: string,
  target: SheetMoveTarget,
  preparedSheet?: WritingSheet,
): WritingProject[] {
  const sourceProject = projects.find((project) => project.sheets.some((sheet) => sheet.id === sheetId));
  const targetProject = projects.find((project) => project.id === target.projectId);
  const sheet = sourceProject?.sheets.find((item) => item.id === sheetId);
  if (!sourceProject || !targetProject || !sheet) return projects;
  const groupId = resolveSheetMoveGroupId(targetProject, target.groupId);
  if (sourceProject.id === targetProject.id && sheet.groupId === groupId) return projects;
  const relocatedSheet = { ...(preparedSheet ?? sheet), id: sheet.id, groupId };
  const movedSheet =
    sourceProject.id === targetProject.id
      ? relocatedSheet
      : applyDefinitionDefaultsToSheet(relocatedSheet, targetProject.documentPropertyDefinitions ?? []);
  return projects.map((project) => {
    if (sourceProject.id === targetProject.id && project.id === sourceProject.id) {
      return normalizeProject({
        ...project,
        updatedAt: nowTimestamp(),
        sheets: project.sheets.map((item) => (item.id === sheetId ? movedSheet : item)),
      });
    }
    if (project.id === sourceProject.id) {
      return normalizeProject({ ...project, updatedAt: nowTimestamp(), sheets: project.sheets.filter((item) => item.id !== sheetId) });
    }
    if (project.id === targetProject.id) {
      return normalizeProject({ ...project, updatedAt: nowTimestamp(), sheets: [...project.sheets, movedSheet] });
    }
    return project;
  });
}
