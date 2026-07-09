import { DEFAULT_PROJECT_ICON, DEFAULT_PROJECT_ICON_COLOR } from "../constants/projectAppearance";
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

export type ProjectFilter = "active" | "today" | "published" | "archived" | "trash";

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
export const NOTES_PROJECT_ID = "notes-root";
export const NOTES_INBOX_GROUP_ID = "notes-inbox";

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

export function createDefaultNotesProject(): WritingProject {
  return {
    id: NOTES_PROJECT_ID,
    title: "笔记",
    icon: "inbox",
    iconColor: "#8e8e93",
    description: "用于收集暂未归入项目的笔记、想法和短文本。",
    status: "构思",
    targetPlatform: "未指定",
    targetWords: 0,
    tags: ["笔记"],
    updatedAt: "",
    groups: [
      {
        id: NOTES_INBOX_GROUP_ID,
        title: "收件箱",
        icon: "inbox",
        iconColor: "#8e8e93",
        description: "笔记和想法的起点，可以先创建文稿，稍后再整理。",
      },
    ],
    sheets: [],
    publishingChecklist: [],
    exportHistory: [],
    writingBrief: DEFAULT_WRITING_BRIEF,
  };
}

export function isNotesProject(project: WritingProject | undefined): boolean {
  return project?.id === NOTES_PROJECT_ID;
}

export function getNotesProject(projects: WritingProject[]): WritingProject {
  return projects.find(isNotesProject) ?? createDefaultNotesProject();
}

export function getDefaultGroupIdForSheetType(_type: SheetType): string {
  return DEFAULT_USER_GROUP_ID;
}

export function normalizeProjects(projects: WritingProject[]): WritingProject[] {
  const normalized = projects.map(normalizeProject);
  if (!normalized.some(isNotesProject)) {
    return [...normalized, normalizeProject(createDefaultNotesProject())];
  }
  return normalized;
}

export function normalizeProject(project: WritingProject): WritingProject {
  const groups = ensureProjectGroups(project);
  const visibleGroups = groups.filter((group) => !isSystemProjectGroupId(group.id));
  const fallbackGroupId = visibleGroups[0]?.id ?? (isNotesProject(project) ? NOTES_INBOX_GROUP_ID : DEFAULT_USER_GROUP_ID);
  const groupIds = new Set(groups.map((group) => group.id));
  return {
    ...project,
    icon: project.icon || DEFAULT_PROJECT_ICON,
    iconColor: project.iconColor || DEFAULT_PROJECT_ICON_COLOR,
    groups: visibleGroups,
    sheets: dedupeSheetsById(project.sheets).map((sheet) => {
      const createdAt = sheet.createdAt || deriveSheetCreatedAt(sheet) || sheet.updatedAt || "";
      return {
        ...sheet,
        createdAt,
        groupId: sheet.groupId && groupIds.has(sheet.groupId) && !isSystemProjectGroupId(sheet.groupId) ? sheet.groupId : fallbackGroupId,
      };
    }),
  };
}

function deriveSheetCreatedAt(sheet: WritingSheet): string {
  const match = sheet.id.match(/(?:sheet|version|import)-(\d{10,})/);
  if (!match) return "";
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return "";
  const timestamp = value > 1_000_000_000_000 ? value : value * 1000;
  return new Date(timestamp).toISOString();
}

export function dedupeSheetsById(sheets: WritingSheet[]): WritingSheet[] {
  const seen = new Set<string>();
  return sheets.filter((sheet) => {
    if (seen.has(sheet.id)) return false;
    seen.add(sheet.id);
    return true;
  });
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
  if (isNotesProject(project) && !byId.has(NOTES_INBOX_GROUP_ID)) {
    const inbox = createDefaultNotesProject().groups?.[0];
    if (inbox) byId.set(inbox.id, inbox);
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
  const project = projects.find((item) => item.id === savedProjectId) ?? projects.find((item) => !isNotesProject(item)) ?? projects[0];
  const sheet = project?.sheets.find((item) => item.id === savedSheetId) ?? project?.sheets[0];
  return {
    projectId: project?.id ?? "",
    sheetId: sheet?.id ?? "",
  };
}

export function filterProjects(projects: WritingProject[], search: string): WritingProject[] {
  const normalizedSearch = search.trim().toLowerCase();
  return projects.filter((project) => {
    if (isNotesProject(project)) return false;
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

export function buildProjectResourcePaths(libraryPath: string, project: WritingProject): ProjectResourcePaths | null {
  if (!libraryPath.startsWith("/")) return null;
  if (isNotesProject(project)) return null;
  const projectPath = `${libraryPath}/projects/${safeVisiblePathSegment(project.title, project.id)}`;
  return {
    project: projectPath,
    assets: `${projectPath}/assets`,
    references: `${projectPath}/references`,
    exports: `${projectPath}/exports`,
  };
}

export function buildProjectFolderPath(libraryPath: string, project: WritingProject): string | null {
  if (!libraryPath.startsWith("/") || isNotesProject(project)) return null;
  return `${libraryPath}/projects/${safeVisiblePathSegment(project.title, project.id)}`;
}

export function buildNoteGroupFolderPath(libraryPath: string, group: ProjectGroup): string | null {
  if (!libraryPath.startsWith("/")) return null;
  return `${libraryPath}/notes/${safeVisiblePathSegment(group.title, group.id)}`;
}

export function buildSheetMarkdownPath(libraryPath: string, project: WritingProject, sheet: WritingSheet): string {
  const group = getVisibleProjectGroups(project).find((item) => item.id === sheet.groupId) ?? getVisibleProjectGroups(project)[0];
  const groupSegment = safeVisiblePathSegment(group?.title ?? "默认组", group?.id ?? sheet.groupId ?? "group");
  const sheetSegment = safeVisiblePathSegment(sheet.title, sheet.id);
  if (isNotesProject(project)) {
    return `${libraryPath}/notes/${groupSegment}/${sheetSegment}.md`;
  }
  return `${libraryPath}/projects/${safeVisiblePathSegment(project.title, project.id)}/${groupSegment}/${sheetSegment}.md`;
}

export function safeVisiblePathSegment(title: string, fallback: string): string {
  const sanitized = title
    .trim()
    .replace(/[/\\:*?"<>|\0]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[.-]+|[.-]+$/g, "");
  return sanitized || fallback.replace(/[^a-zA-Z0-9_-]/g, "-") || "untitled";
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
  if (filter === "trash") return "废纸篓";
  return "全部";
}

export function getSheetsForProjectFilter(sheets: WritingSheet[], filter: ProjectFilter, currentDay: string): WritingSheet[] {
  const uniqueSheets = dedupeSheetsById(sheets);
  if (filter === "trash") return [];
  if (filter === "today") return uniqueSheets.filter((sheet) => sheet.updatedAt.slice(0, 10) === currentDay);
  if (filter === "published") return uniqueSheets.filter((sheet) => sheet.status === "已发布");
  if (filter === "archived") return uniqueSheets.filter((sheet) => sheet.status === "已归档");
  return uniqueSheets;
}

export function filterSheets(sheets: WritingSheet[], search: string): WritingSheet[] {
  const normalizedSearch = search.trim().toLowerCase();
  return sheets.filter((sheet) => {
    if (!normalizedSearch) return true;
    return [sheet.title, sheet.summary, sheet.type, sheet.status, sheet.body].join(" ").toLowerCase().includes(normalizedSearch);
  });
}
