import {
  DEFAULT_PROJECT_ICON,
  DEFAULT_PROJECT_ICON_COLOR,
} from "../constants/projectAppearance";
import type {
  ProjectGroup,
  ProjectStatus,
  ProjectWritingBrief,
  PublishingChecklistItem,
  SheetType,
  WritingProject,
  WritingSheet,
} from "../types";
import { countWords } from "./text";

export type ProjectFilter = "active" | "today" | "published" | "archived";

export interface ProjectResourcePaths {
  project: string;
  assets: string;
  references: string;
  exports: string;
}

export const PROJECT_STATUS_FLOW: ProjectStatus[] = ["构思", "初稿", "修改中", "待配图", "待发布", "已发布", "已归档"];
export const DEFAULT_CONTENT_GROUP_ID = "group-content";
export const DEFAULT_MATERIAL_GROUP_ID = "group-materials";
export const DEFAULT_USER_GROUP_ID = "group-default";

export const DEFAULT_WRITING_BRIEF: ProjectWritingBrief = {
  audience: "",
  thesis: "",
  tone: "",
  publishingNotes: "",
};

export const DEFAULT_PUBLISHING_CHECKLIST: PublishingChecklistItem[] = [
  { id: "title", label: "标题已确认", done: false },
  { id: "cover", label: "封面已准备", done: false },
  { id: "summary", label: "摘要已准备", done: false },
  { id: "body-images", label: "正文配图已检查", done: false },
  { id: "platform-format", label: "平台格式已适配", done: false },
];

export function createDefaultProjectGroups(): ProjectGroup[] {
  return [
    {
      id: DEFAULT_USER_GROUP_ID,
      title: "默认组",
      icon: DEFAULT_PROJECT_ICON,
      iconColor: DEFAULT_PROJECT_ICON_COLOR,
      description: "",
    },
  ];
}

export function getDefaultGroupIdForSheetType(_type: SheetType): string {
  return DEFAULT_USER_GROUP_ID;
}

export function normalizeProjects(projects: WritingProject[]): WritingProject[] {
  return projects.map(normalizeProject);
}

export function normalizeProject(project: WritingProject): WritingProject {
  const groups = ensureProjectGroups(project);
  const visibleGroups = groups.filter((group) => !isSystemProjectGroupId(group.id));
  const fallbackGroupId = visibleGroups[0]?.id ?? DEFAULT_USER_GROUP_ID;
  const groupIds = new Set(groups.map((group) => group.id));
  return {
    ...project,
    icon: project.icon || DEFAULT_PROJECT_ICON,
    iconColor: project.iconColor || DEFAULT_PROJECT_ICON_COLOR,
    groups: visibleGroups,
    sheets: project.sheets.map((sheet) => ({
      ...sheet,
      groupId:
        sheet.groupId && groupIds.has(sheet.groupId) && !isSystemProjectGroupId(sheet.groupId)
          ? sheet.groupId
          : fallbackGroupId,
    })),
  };
}

export function ensureProjectGroups(project: WritingProject): ProjectGroup[] {
  const byId = new Map<string, ProjectGroup>();
  for (const group of project.groups ?? []) {
    byId.set(group.id, {
      ...group,
      title: group.title.trim() || "未命名分组",
      icon: group.icon || DEFAULT_PROJECT_ICON,
      iconColor: group.iconColor || DEFAULT_PROJECT_ICON_COLOR,
    });
  }
  for (const sheet of project.sheets) {
    const groupId = sheet.groupId;
    if (groupId && !isSystemProjectGroupId(groupId) && groupId !== DEFAULT_USER_GROUP_ID && !byId.has(groupId)) {
      byId.set(groupId, {
        id: groupId,
        title: "未命名分组",
        icon: DEFAULT_PROJECT_ICON,
        iconColor: DEFAULT_PROJECT_ICON_COLOR,
      });
    }
  }
  if (Array.from(byId.values()).every((group) => isSystemProjectGroupId(group.id))) {
    for (const group of createDefaultProjectGroups()) byId.set(group.id, group);
  }
  return Array.from(byId.values());
}

export function getProjectGroups(project: WritingProject): ProjectGroup[] {
  return ensureProjectGroups(project);
}

export function getVisibleProjectGroups(project: WritingProject): ProjectGroup[] {
  return getProjectGroups(project).filter((group) => !isSystemProjectGroupId(group.id));
}

export function isSystemProjectGroupId(groupId: string): boolean {
  return groupId === DEFAULT_CONTENT_GROUP_ID || groupId === DEFAULT_MATERIAL_GROUP_ID;
}

export function resolveProjectGroupId(project: WritingProject, preferredGroupId: string, sheetId = ""): string {
  const groups = getVisibleProjectGroups(project);
  if (preferredGroupId && groups.some((group) => group.id === preferredGroupId)) return preferredGroupId;
  const sheet = project.sheets.find((item) => item.id === sheetId);
  if (sheet?.groupId && groups.some((group) => group.id === sheet.groupId)) return sheet.groupId;
  const firstSheetGroupId = project.sheets[0]?.groupId;
  if (firstSheetGroupId && groups.some((group) => group.id === firstSheetGroupId)) return firstSheetGroupId;
  return groups[0]?.id ?? DEFAULT_USER_GROUP_ID;
}

export function getSheetsInGroup(project: WritingProject, groupId: string): WritingSheet[] {
  return project.sheets.filter((sheet) => (sheet.groupId || getDefaultGroupIdForSheetType(sheet.type)) === groupId);
}

export function getProjectGroupCounts(project: WritingProject): Map<string, number> {
  const counts = new Map<string, number>();
  for (const group of getVisibleProjectGroups(project)) counts.set(group.id, 0);
  for (const sheet of project.sheets) {
    const groupId = sheet.groupId || getDefaultGroupIdForSheetType(sheet.type);
    if (isSystemProjectGroupId(groupId)) continue;
    counts.set(groupId, (counts.get(groupId) ?? 0) + 1);
  }
  return counts;
}

export function getProjectGroupWordCounts(project: WritingProject): Map<string, number> {
  const counts = new Map<string, number>();
  for (const group of getVisibleProjectGroups(project)) counts.set(group.id, 0);
  for (const sheet of project.sheets) {
    const groupId = sheet.groupId || getDefaultGroupIdForSheetType(sheet.type);
    if (isSystemProjectGroupId(groupId)) continue;
    counts.set(groupId, (counts.get(groupId) ?? 0) + countWords(sheet.body));
  }
  return counts;
}

export function ensureGroupExists(groups: ProjectGroup[], groupId: string, title: string): ProjectGroup[] {
  if (groups.some((group) => group.id === groupId)) return groups;
  return [...groups, { id: groupId, title, icon: DEFAULT_PROJECT_ICON, iconColor: DEFAULT_PROJECT_ICON_COLOR }];
}

export function ensureMaterialGroup(project: WritingProject): ProjectGroup {
  return getVisibleProjectGroups(project)[0] ?? createDefaultProjectGroups()[0];
}

export function getPublishingChecklist(project: WritingProject): PublishingChecklistItem[] {
  const existing = project.publishingChecklist ?? [];
  const byId = new Map(existing.map((item) => [item.id, item]));
  const mergedDefaults = DEFAULT_PUBLISHING_CHECKLIST.map((item) => ({
    ...item,
    done: byId.get(item.id)?.done ?? item.done,
  }));
  const customItems = existing.filter((item) => !DEFAULT_PUBLISHING_CHECKLIST.some((defaultItem) => defaultItem.id === item.id));
  return [...mergedDefaults, ...customItems];
}

export function getWritingBrief(project: WritingProject): ProjectWritingBrief {
  return {
    ...DEFAULT_WRITING_BRIEF,
    ...(project.writingBrief ?? {}),
  };
}

export function resolveSavedProjectSelection(
  projects: WritingProject[],
  savedProjectId: string,
  savedSheetId: string,
): { projectId: string; sheetId: string } {
  const project = projects.find((item) => item.id === savedProjectId) ?? projects[0];
  const sheet = project?.sheets.find((item) => item.id === savedSheetId) ?? project?.sheets[0];
  return {
    projectId: project?.id ?? "",
    sheetId: sheet?.id ?? "",
  };
}

export function filterProjects(projects: WritingProject[], search: string): WritingProject[] {
  const normalizedSearch = search.trim().toLowerCase();
  return projects.filter((project) => {
    if (project.status === "已归档") return false;
    if (!normalizedSearch) return true;
    const writingBrief = getWritingBrief(project);
    const searchable = [
      project.title,
      project.description,
      project.status,
      project.targetPlatform,
      writingBrief.audience,
      writingBrief.thesis,
      writingBrief.tone,
      writingBrief.publishingNotes,
      project.tags.join(" "),
      ...project.sheets.map((sheet) => `${sheet.title} ${sheet.summary} ${sheet.status} ${sheet.type}`),
    ]
      .join(" ")
      .toLowerCase();
    return searchable.includes(normalizedSearch);
  });
}

export function sortProjects(projects: WritingProject[]): WritingProject[] {
  return [...projects].sort((a, b) => {
    return projectUpdatedValue(b) - projectUpdatedValue(a);
  });
}

function projectUpdatedValue(project: WritingProject): number {
  const values = [
    Date.parse(project.updatedAt),
    ...project.sheets.map((sheet) => Date.parse(sheet.updatedAt)),
  ].filter((value) => !Number.isNaN(value));
  return values.length > 0 ? Math.max(...values) : 0;
}

export function buildProjectResourcePaths(libraryPath: string, projectId: string): ProjectResourcePaths | null {
  if (!libraryPath.startsWith("/")) return null;
  const project = `${libraryPath}/projects/${projectId}`;
  return {
    project,
    assets: `${project}/assets`,
    references: `${project}/references`,
    exports: `${project}/exports`,
  };
}

export function buildSheetMarkdownPath(libraryPath: string, projectId: string, sheetId: string): string {
  return `${libraryPath}/projects/${projectId}/sheets/${sheetId}.md`;
}

export function getNextProjectStatus(status: ProjectStatus): ProjectStatus | null {
  const index = PROJECT_STATUS_FLOW.indexOf(status);
  if (index < 0 || index >= PROJECT_STATUS_FLOW.length - 1) return null;
  return PROJECT_STATUS_FLOW[index + 1];
}

export function getProjectFilterTitle(filter: ProjectFilter): string {
  if (filter === "today") return "今日写作";
  if (filter === "published") return "已发布";
  if (filter === "archived") return "已归档";
  return "全部";
}

export function getSheetsForProjectFilter(sheets: WritingSheet[], filter: ProjectFilter, currentDay: string): WritingSheet[] {
  if (filter === "today") return sheets.filter((sheet) => sheet.updatedAt === currentDay);
  if (filter === "published") return sheets.filter((sheet) => sheet.status === "已发布");
  if (filter === "archived") return sheets.filter((sheet) => sheet.status === "已归档");
  return sheets;
}

export function filterSheets(sheets: WritingSheet[], search: string): WritingSheet[] {
  const normalizedSearch = search.trim().toLowerCase();
  return sheets.filter((sheet) => {
    if (!normalizedSearch) return true;
    return [sheet.title, sheet.summary, sheet.type, sheet.status, sheet.body]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch);
  });
}
