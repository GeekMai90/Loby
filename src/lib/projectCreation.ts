import {
  DEFAULT_NEW_PROJECT_TITLE,
  DEFAULT_PROJECT_ICON,
  DEFAULT_PROJECT_ICON_COLOR,
  type NewProjectDraft,
} from "../constants/projectAppearance";
import { PROJECT_TEMPLATES } from "../constants/projectTemplates";
import type { MetadataValue, ProjectGroup, ProjectPropertyDefinition, PropertyFieldType, WritingProject, WritingSheet } from "../types";
import { nowTimestamp, today } from "./dates";
import { applyProjectArticleGoalTarget, createDefaultPropertyDefinitions, createSheetWithProjectDefaults } from "./documentProperties";
import {
  createDefaultProjectGroups,
  DEFAULT_USER_GROUP_ID,
  DEFAULT_PUBLISHING_CHECKLIST,
  DEFAULT_WRITING_BRIEF,
  getSheetsInGroup,
  getVisibleProjectGroups,
  INBOX_GROUP_ID,
  isInboxProject,
  isNotesProject,
  isSystemProjectGroupId,
  NOTES_QUICK_GROUP_ID,
  normalizeProject,
} from "./projectModel";
import { moveItemById, type RailDropPosition } from "./sheetSorting";

export function createProjectFromTemplate(templateId = "blank", draft?: NewProjectDraft): WritingProject {
  const template = PROJECT_TEMPLATES.find((item) => item.id === templateId) ?? PROJECT_TEMPLATES[0];
  const timestamp = Date.now();
  const now = nowTimestamp();
  const projectTitle = draft?.title.trim() || DEFAULT_NEW_PROJECT_TITLE;
  const goalTarget = Math.max(0, Math.round(draft?.goalTarget ?? template.targetWords));
  const goalEnabled = (draft ? Boolean(draft.goalEnabled) : template.targetWords > 0) && goalTarget > 0;
  const goalUnit = draft?.goalUnit ?? "words";
  const articleGoalTarget = draft?.articleGoalEnabled === false ? 0 : Math.max(0, Math.round(draft?.articleGoalTarget ?? 1000));
  const project: WritingProject = {
    id: `project-${timestamp}`,
    title: projectTitle,
    icon: draft?.icon ?? DEFAULT_PROJECT_ICON,
    iconColor: draft?.iconColor ?? DEFAULT_PROJECT_ICON_COLOR,
    description: template.projectDescription,
    status: "构思",
    targetPlatform: template.targetPlatform,
    targetWords: goalEnabled && goalUnit === "words" ? goalTarget : 0,
    projectGoal: { enabled: goalEnabled, unit: goalUnit, target: goalTarget },
    tags: template.tags,
    propertyDefinitions: template.propertyDefinitions.map((definition) => ({
      ...definition,
      options: definition.options?.map((option) => ({ ...option })),
    })),
    updatedAt: now,
    groups: createDefaultProjectGroups(),
    sheets: [],
  };

  project.sheets = template.sheets.map((sheet, index) =>
    createSheetWithProjectDefaults(project, {
      ...sheet,
      id: `sheet-${timestamp}-${index}`,
      groupId: sheet.groupId ?? DEFAULT_USER_GROUP_ID,
      updatedAt: now,
      properties: { tags: [...template.tags] },
    }),
  );

  return normalizeProject(applyProjectArticleGoalTarget(project, articleGoalTarget));
}

export function createImportedProjectFromSheets(importedSheets: WritingSheet[], fileCount: number): WritingProject {
  const projectTitle = importedSheets.length === 1 ? importedSheets[0].title : `${importedSheets[0].title} 等 ${importedSheets.length} 篇`;
  const defaultDefinitions = createDefaultPropertyDefinitions({ sheets: importedSheets, targetPlatform: "未指定" });
  return normalizeProject({
    id: `project-import-${Date.now()}`,
    title: projectTitle,
    icon: DEFAULT_PROJECT_ICON,
    iconColor: DEFAULT_PROJECT_ICON_COLOR,
    description: `从 ${fileCount} 个 Markdown/text 文件创建。`,
    status: "构思",
    targetPlatform: "未指定",
    targetWords: Math.max(
      1000,
      importedSheets.reduce((total, sheet) => total + sheet.targetWords, 0),
    ),
    tags: ["导入"],
    groups: createDefaultProjectGroups(),
    sheets: importedSheets,
    propertyDefinitions: [...defaultDefinitions, ...inferImportedPropertyDefinitions(importedSheets, defaultDefinitions)],
    updatedAt: nowTimestamp(),
    publishingChecklist: DEFAULT_PUBLISHING_CHECKLIST.map((item) => ({ ...item })),
    writingBrief: DEFAULT_WRITING_BRIEF,
    exportHistory: [],
  });
}

export function inferImportedPropertyDefinitions(
  sheets: WritingSheet[],
  existingDefinitions: ProjectPropertyDefinition[] = [],
): ProjectPropertyDefinition[] {
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
    showWhenEmpty: false,
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
  const firstGroup = getVisibleProjectGroups(project)[0];
  const firstSheet = firstGroup ? getSheetsInGroup(project, firstGroup.id)[0] : project.sheets[0];
  return {
    groupId: firstGroup?.id ?? "",
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
