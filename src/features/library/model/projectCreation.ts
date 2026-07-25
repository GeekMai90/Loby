/**
 * [INPUT]: 依赖 写作库模块、shared 公共契约、编辑器模块
 * [OUTPUT]: 对外提供创建通用空项目的 createWritingProject，以及导入、选择、分组、排序和移动等公开能力
 * [POS]: 写作库 feature 的领域模型边界，项目创建只建立通用容器，文稿系统字段由编辑器模型独立提供
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import {
  DEFAULT_NEW_PROJECT_TITLE,
  DEFAULT_PROJECT_ICON,
  DEFAULT_PROJECT_ICON_COLOR,
  type NewProjectDraft,
} from "@/features/library/constants/projectAppearance";
import type {
  MetadataValue,
  ProjectGroup,
  DocumentPropertyDefinition,
  PropertyFieldType,
  WritingProject,
  WritingSheet,
} from "@/shared/types";
import { nowTimestamp, today } from "@/shared/lib/dates";
import { getDocumentPropertyDefinitions } from "@/features/editor/model/documentProperties";
import {
  createDefaultProjectGroups,
  DEFAULT_USER_GROUP_ID,
  DEFAULT_PUBLISHING_CHECKLIST,
  DEFAULT_WRITING_BRIEF,
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

export function createImportedProjectFromSheets(importedSheets: WritingSheet[]): WritingProject {
  const projectTitle = importedSheets.length === 1 ? importedSheets[0].title : `${importedSheets[0].title} 等 ${importedSheets.length} 篇`;
  const documentDefinitions = getDocumentPropertyDefinitions();
  const customDefinitions = inferImportedPropertyDefinitions(importedSheets, documentDefinitions);
  return normalizeProject({
    id: `project-import-${Date.now()}`,
    title: projectTitle,
    icon: DEFAULT_PROJECT_ICON,
    iconColor: DEFAULT_PROJECT_ICON_COLOR,
    status: "构思",
    projectGoal: { enabled: false, unit: "words", target: 0 },
    groups: createDefaultProjectGroups(),
    sheets: importedSheets,
    documentPropertyDefinitions: customDefinitions,
    updatedAt: nowTimestamp(),
    publishingChecklist: DEFAULT_PUBLISHING_CHECKLIST.map((item) => ({ ...item })),
    writingBrief: DEFAULT_WRITING_BRIEF,
    exportHistory: [],
  });
}

export function inferImportedPropertyDefinitions(
  sheets: WritingSheet[],
  existingDefinitions: DocumentPropertyDefinition[] = [],
): DocumentPropertyDefinition[] {
  const existingKeys = new Set(existingDefinitions.map((definition) => definition.key));
  const valuesByKey = new Map<string, MetadataValue[]>();
  for (const sheet of sheets) {
    for (const [key, value] of Object.entries(sheet.properties ?? {})) {
      if (existingKeys.has(key) || !isEditableImportedMetadataValue(value)) continue;
      valuesByKey.set(key, [...(valuesByKey.get(key) ?? []), value]);
    }
  }

  return Array.from(valuesByKey, ([key, values], index) => ({
    id: `imported-field-${index}-${safeImportedFieldId(key)}`,
    key,
    label: key,
    type: inferImportedFieldType(values),
  }));
}

function inferImportedFieldType(values: MetadataValue[]): PropertyFieldType {
  if (values.every((value) => typeof value === "boolean")) return "checkbox";
  if (values.every((value) => typeof value === "number")) return "number";
  if (values.every((value) => Array.isArray(value) && value.every((item) => typeof item === "string"))) return "tags";
  return "text";
}

function isEditableImportedMetadataValue(value: MetadataValue): boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
  );
}

function safeImportedFieldId(key: string): string {
  return key
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
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
  const movedSheet = { ...(preparedSheet ?? sheet), id: sheet.id, groupId, updatedAt: nowTimestamp() };
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
