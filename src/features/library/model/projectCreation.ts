/**
 * [INPUT]: 依赖 写作库模块、shared 公共契约、编辑器模块
 * [OUTPUT]: 对外提供创建带新文稿目标默认值的通用空项目 createWritingProject、创建可辨识且标题同步的文稿副本，以及分组创建/编辑/删除、选择、排序和移动等公开能力
 * [POS]: 写作库 feature 的领域模型边界；项目创建不生成内容，只通过编辑器模型建立文稿创建默认值，文稿副本获得独立身份、命名与发布历史边界，移动文稿保留其内容更新时间
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
import { extractFirstHeadingTitle } from "@/shared/lib/markdownTitle";
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
import { createSheetId } from "@/features/library/model/documentId";
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

export interface DuplicateSheetOptions {
  id?: string;
  now?: string;
  sourceSheet?: WritingSheet;
}

export interface DuplicateSheetResult {
  project: WritingProject;
  sheet: WritingSheet;
}

const DUPLICATE_TITLE_PATTERN = /^(.*?)[（(]副本(?:\s+(\d+))?[）)]$/;

function getSheetNamingTitle(sheet: WritingSheet) {
  return extractFirstHeadingTitle(sheet.body).trim() || sheet.title.trim() || "未命名新文稿";
}

function getDuplicateTitleBase(title: string) {
  const normalizedTitle = title.trim() || "未命名新文稿";
  return normalizedTitle.match(DUPLICATE_TITLE_PATTERN)?.[1]?.trim() || normalizedTitle;
}

function createUniqueDuplicateTitle(project: WritingProject, source: WritingSheet) {
  const baseTitle = getDuplicateTitleBase(getSheetNamingTitle(source));
  const usedTitles = new Set(project.sheets.flatMap((sheet) => [sheet.title.trim(), getSheetNamingTitle(sheet)]).filter(Boolean));
  const firstTitle = `${baseTitle}（副本）`;
  if (!usedTitles.has(firstTitle)) return firstTitle;

  for (let index = 2; ; index += 1) {
    const numberedTitle = `${baseTitle}（副本 ${index}）`;
    if (!usedTitles.has(numberedTitle)) return numberedTitle;
  }
}

function renameFirstHeading(body: string, title: string) {
  if (!extractFirstHeadingTitle(body)) return body;
  return body.replace(/^(#\s+)(.+?)(\s+#+\s*)?$/m, (_match, prefix: string, _heading: string, closing = "") => {
    return `${prefix}${title}${closing}`;
  });
}

export function duplicateSheetInProject(
  project: WritingProject,
  sourceSheetId: string,
  options: DuplicateSheetOptions = {},
): DuplicateSheetResult | null {
  const sourceIndex = project.sheets.findIndex((sheet) => sheet.id === sourceSheetId);
  const indexedSource = sourceIndex >= 0 ? project.sheets[sourceIndex] : undefined;
  const source = options.sourceSheet?.id === sourceSheetId ? options.sourceSheet : indexedSource;
  if (!source || sourceIndex < 0) return null;

  const now = options.now ?? nowTimestamp();
  const duplicateTitle = createUniqueDuplicateTitle(project, source);
  const duplicate: WritingSheet = {
    ...source,
    id: options.id ?? createSheetId(),
    title: duplicateTitle,
    tags: [...(source.tags ?? [])],
    properties: structuredClone(source.properties ?? {}),
    body: renameFirstHeading(source.body, duplicateTitle),
    createdAt: now,
    updatedAt: now,
    versions: [],
    publications: undefined,
  };
  const sheets = project.sheets.slice();
  sheets[sourceIndex] = source;
  sheets.splice(sourceIndex + 1, 0, duplicate);
  const normalizedProject = normalizeProject({ ...project, updatedAt: now, sheets });
  const normalizedSheet = normalizedProject.sheets.find((sheet) => sheet.id === duplicate.id) ?? duplicate;
  return { project: normalizedProject, sheet: normalizedSheet };
}

export function addProjectGroup(project: WritingProject, group: ProjectGroup): WritingProject {
  return {
    ...project,
    groups: [...(project.groups ?? []).filter((item) => !isSystemProjectGroupId(item.id)), group],
    updatedAt: today(),
  };
}

export function updateProjectGroup(project: WritingProject, groupId: string, draft: NewProjectDraft): WritingProject {
  if (groupId === DEFAULT_USER_GROUP_ID) return project;
  if (!(project.groups ?? []).some((group) => group.id === groupId)) return project;

  return normalizeProject({
    ...project,
    groups: (project.groups ?? []).map((group) =>
      group.id === groupId
        ? {
            ...group,
            title: draft.title.trim() || "无标题",
            icon: draft.icon || DEFAULT_PROJECT_ICON,
            iconColor: draft.iconColor || DEFAULT_PROJECT_ICON_COLOR,
          }
        : group,
    ),
    updatedAt: today(),
  });
}

export function deleteProjectGroup(project: WritingProject, groupId: string): WritingProject {
  if (groupId === DEFAULT_USER_GROUP_ID || isSystemProjectGroupId(groupId)) return project;

  const groups = project.groups ?? [];
  const defaultGroup = groups.find((group) => group.id === DEFAULT_USER_GROUP_ID);
  if (!defaultGroup || !groups.some((group) => group.id === groupId)) return project;

  return normalizeProject({
    ...project,
    groups: groups.filter((group) => group.id !== groupId),
    sheets: project.sheets.map((sheet) => (sheet.groupId === groupId ? { ...sheet, groupId: defaultGroup.id } : sheet)),
    publishingBinding: project.publishingBinding
      ? {
          ...project.publishingBinding,
          groupMappings: project.publishingBinding.groupMappings.filter((mapping) => mapping.groupId !== groupId),
        }
      : undefined,
    updatedAt: today(),
  });
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
