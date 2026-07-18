import { DEFAULT_PROJECT_ICON, DEFAULT_PROJECT_ICON_COLOR } from "../constants/projectAppearance";
import type {
  ProjectGroup,
  ProjectWritingBrief,
  PublishingChecklistItem,
  SheetType,
  SidebarMode,
  WritingProject,
  WritingSheet,
} from "../types";
import { countWords } from "./text";
import { normalizeProjectPropertyModel } from "./documentProperties";

export type ProjectFilter = "active" | "inbox" | "recent" | "archived" | "trash";

export interface ProjectResourcePaths {
  project: string;
  assets: string;
  references: string;
  exports: string;
}

export const DEFAULT_CONTENT_GROUP_ID = "group-content";
export const DEFAULT_MATERIAL_GROUP_ID = "group-materials";
export const DEFAULT_USER_GROUP_ID = "group-default";
export const INBOX_PROJECT_ID = "inbox-root";
export const INBOX_GROUP_ID = "inbox-default";
export const NOTES_PROJECT_ID = "notes-root";
export const NOTES_QUICK_GROUP_ID = "notes-quick";
const LEGACY_NOTES_INBOX_GROUP_ID = "notes-inbox";

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
      title: "待整理",
      icon: DEFAULT_PROJECT_ICON,
      iconColor: DEFAULT_PROJECT_ICON_COLOR,
      description: "",
    },
  ];
}

export function createDefaultInboxProject(): WritingProject {
  return {
    id: INBOX_PROJECT_ID,
    title: "收件箱",
    icon: "inbox",
    iconColor: "#8e8e93",
    description: "用于存放尚未确定项目归属的文稿。",
    status: "构思",
    targetPlatform: "未指定",
    targetWords: 0,
    tags: [],
    updatedAt: "",
    groups: [
      {
        id: INBOX_GROUP_ID,
        title: "收件箱",
        icon: "inbox",
        iconColor: "#8e8e93",
        description: "已经准备继续写作，但尚未确定项目归属的文稿。",
      },
    ],
    sheets: [],
    publishingChecklist: [],
    exportHistory: [],
    writingBrief: DEFAULT_WRITING_BRIEF,
  };
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
        id: NOTES_QUICK_GROUP_ID,
        title: "随手记",
        icon: "notes",
        iconColor: "#8e8e93",
        description: "快速记录尚未确定是否发展成文稿的想法。",
      },
    ],
    sheets: [],
    publishingChecklist: [],
    exportHistory: [],
    writingBrief: DEFAULT_WRITING_BRIEF,
  };
}

export function isInboxProject(project: WritingProject | undefined): boolean {
  return project?.id === INBOX_PROJECT_ID;
}

export function isNotesProject(project: WritingProject | undefined): boolean {
  return project?.id === NOTES_PROJECT_ID;
}

export function getNotesProject(projects: WritingProject[]): WritingProject {
  return projects.find(isNotesProject) ?? createDefaultNotesProject();
}

export function getInboxProject(projects: WritingProject[]): WritingProject {
  return projects.find(isInboxProject) ?? createDefaultInboxProject();
}

export function resolveNewSheetTarget(options: {
  projects: WritingProject[];
  activeProject: WritingProject | undefined;
  activeGroupId: string;
  activeNoteGroupId: string;
  sidebarMode: SidebarMode;
}): { project: WritingProject; groupId: string } {
  const { projects, activeProject, activeGroupId, activeNoteGroupId, sidebarMode } = options;
  if (sidebarMode === "project" && activeProject && !isInboxProject(activeProject) && !isNotesProject(activeProject)) {
    return { project: activeProject, groupId: resolveProjectGroupId(activeProject, activeGroupId) };
  }
  if (activeNoteGroupId) {
    const notes = getNotesProject(projects);
    return {
      project: notes,
      groupId: getVisibleProjectGroups(notes).some((group) => group.id === activeNoteGroupId) ? activeNoteGroupId : NOTES_QUICK_GROUP_ID,
    };
  }
  return { project: getInboxProject(projects), groupId: INBOX_GROUP_ID };
}

export function getDefaultGroupIdForSheetType(_type: SheetType): string {
  return DEFAULT_USER_GROUP_ID;
}

export function normalizeProjects(projects: WritingProject[]): WritingProject[] {
  const seen = new Set<string>();
  const normalized = projects.map(normalizeProject).filter((project) => {
    if (seen.has(project.id)) return false;
    seen.add(project.id);
    return true;
  });
  const withInbox = normalized.some(isInboxProject) ? normalized : [...normalized, normalizeProject(createDefaultInboxProject())];
  return withInbox.some(isNotesProject) ? withInbox : [...withInbox, normalizeProject(createDefaultNotesProject())];
}

export function normalizeProject(project: WritingProject): WritingProject {
  project = normalizeProjectPropertyModel(project);
  project = migrateDefaultGroups(project);
  const groups = ensureProjectGroups(project);
  const visibleGroups = groups.filter((group) => !isSystemProjectGroupId(group.id));
  const fallbackGroupId =
    visibleGroups[0]?.id ??
    (isInboxProject(project) ? INBOX_GROUP_ID : isNotesProject(project) ? NOTES_QUICK_GROUP_ID : DEFAULT_USER_GROUP_ID);
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

function migrateDefaultGroups(project: WritingProject): WritingProject {
  if (isNotesProject(project)) {
    return {
      ...project,
      groups: (project.groups ?? []).map((group) =>
        group.id === LEGACY_NOTES_INBOX_GROUP_ID || group.id === DEFAULT_USER_GROUP_ID
          ? { ...group, id: NOTES_QUICK_GROUP_ID, title: "随手记", icon: "notes" }
          : group.id === NOTES_QUICK_GROUP_ID
            ? { ...group, title: "随手记", icon: "notes" }
            : group,
      ),
      sheets: project.sheets.map((sheet) =>
        sheet.groupId === LEGACY_NOTES_INBOX_GROUP_ID ? { ...sheet, groupId: NOTES_QUICK_GROUP_ID } : sheet,
      ),
    };
  }
  if (isInboxProject(project)) {
    return {
      ...project,
      groups: createDefaultInboxProject().groups,
      sheets: project.sheets.map((sheet) => ({ ...sheet, groupId: INBOX_GROUP_ID })),
    };
  }
  return {
    ...project,
    groups: (project.groups ?? []).map((group) => (group.id === DEFAULT_USER_GROUP_ID ? { ...group, title: "待整理" } : group)),
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
  if (isInboxProject(project) && !byId.has(INBOX_GROUP_ID)) {
    const inbox = createDefaultInboxProject().groups?.[0];
    if (inbox) byId.set(inbox.id, inbox);
  }
  if (isNotesProject(project) && !byId.has(NOTES_QUICK_GROUP_ID)) {
    const quickNotes = createDefaultNotesProject().groups?.[0];
    if (quickNotes) byId.set(quickNotes.id, quickNotes);
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

export function getSheetsInGroup(project: WritingProject, groupId: string, includeArchived = false): WritingSheet[] {
  return project.sheets.filter(
    (sheet) => (sheet.groupId || getDefaultGroupIdForSheetType(sheet.type)) === groupId && (includeArchived || !sheet.archivedAt),
  );
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
  const project =
    projects.find((item) => item.id === savedProjectId) ??
    projects.find((item) => !isNotesProject(item) && !isInboxProject(item)) ??
    projects.find(isInboxProject) ??
    projects[0];
  const sheet = project?.sheets.find((item) => item.id === savedSheetId) ?? project?.sheets[0];
  return {
    projectId: project?.id ?? "",
    sheetId: sheet?.id ?? "",
  };
}

export function filterProjects(projects: WritingProject[], search: string, archived = false): WritingProject[] {
  const normalizedSearch = search.trim().toLowerCase();
  return projects.filter((project) => {
    if (isNotesProject(project) || isInboxProject(project)) return false;
    if (Boolean(project.archivedAt || project.status === "已归档") !== archived) return false;
    if (!normalizedSearch) return true;
    const writingBrief = getWritingBrief(project);
    const searchable = [
      project.title,
      project.description,
      writingBrief.audience,
      writingBrief.thesis,
      writingBrief.tone,
      writingBrief.publishingNotes,
      project.tags.join(" "),
      ...project.sheets.map((sheet) => `${sheet.title} ${sheet.summary} ${sheet.type} ${metadataSearchText(sheet.properties)}`),
    ]
      .join(" ")
      .toLowerCase();
    return searchable.includes(normalizedSearch);
  });
}

export function buildProjectResourcePaths(libraryPath: string, project: WritingProject): ProjectResourcePaths | null {
  if (!libraryPath.startsWith("/")) return null;
  if (isNotesProject(project) || isInboxProject(project)) return null;
  const projectPath = `${libraryPath}/projects/${safeVisiblePathSegment(project.title, project.id)}`;
  return {
    project: projectPath,
    assets: `${projectPath}/assets`,
    references: `${projectPath}/references`,
    exports: `${projectPath}/exports`,
  };
}

export function buildProjectFolderPath(libraryPath: string, project: WritingProject): string | null {
  if (!libraryPath.startsWith("/") || isNotesProject(project) || isInboxProject(project)) return null;
  return `${libraryPath}/projects/${safeVisiblePathSegment(project.title, project.id)}`;
}

export function buildNoteGroupFolderPath(libraryPath: string, group: ProjectGroup): string | null {
  if (!libraryPath.startsWith("/")) return null;
  return `${libraryPath}/notes/${safeVisiblePathSegment(group.title, group.id)}`;
}

export function buildSheetMarkdownPath(libraryPath: string, project: WritingProject, sheet: WritingSheet): string {
  const group = getVisibleProjectGroups(project).find((item) => item.id === sheet.groupId) ?? getVisibleProjectGroups(project)[0];
  const groupSegment = safeVisiblePathSegment(group?.title ?? "待整理", group?.id ?? sheet.groupId ?? "group");
  const sheetSegment = safeVisiblePathSegment(sheet.title, sheet.id);
  if (isInboxProject(project)) {
    return `${libraryPath}/inbox/${sheetSegment}.md`;
  }
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

export function getProjectFilterTitle(filter: ProjectFilter): string {
  if (filter === "inbox") return "收件箱";
  if (filter === "recent") return "最近 7 天";
  if (filter === "archived") return "已归档";
  if (filter === "trash") return "废纸篓";
  return "全部";
}

export function getSheetsForProjectFilter(sheets: WritingSheet[], filter: ProjectFilter, currentDay: string): WritingSheet[] {
  const uniqueSheets = dedupeSheetsById(sheets);
  if (filter === "trash") return [];
  if (filter === "recent") {
    const firstDay = shiftDateKey(currentDay, -6);
    return uniqueSheets.filter((sheet) => {
      if (sheet.archivedAt || sheet.status === "已归档") return false;
      const updatedDay = sheet.updatedAt.slice(0, 10);
      return updatedDay >= firstDay && updatedDay <= currentDay;
    });
  }
  if (filter === "archived") return uniqueSheets.filter((sheet) => Boolean(sheet.archivedAt || sheet.status === "已归档"));
  return uniqueSheets.filter((sheet) => !sheet.archivedAt && sheet.status !== "已归档");
}

function shiftDateKey(dateKey: string, offsetDays: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function filterSheets(sheets: WritingSheet[], search: string): WritingSheet[] {
  const normalizedSearch = search.trim().toLowerCase();
  return sheets.filter((sheet) => {
    if (!normalizedSearch) return true;
    return [sheet.title, sheet.summary, sheet.type, metadataSearchText(sheet.properties), sheet.body]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch);
  });
}

function metadataSearchText(properties: WritingSheet["properties"]): string {
  return Object.values(properties ?? {})
    .map((value) => (typeof value === "string" ? value : JSON.stringify(value)))
    .join(" ");
}
