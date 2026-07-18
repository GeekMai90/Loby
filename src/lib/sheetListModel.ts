import type { ProjectGroup, SheetManualOrders, SheetSortPreference, SidebarMode, WritingProject, WritingSheet } from "../types";
import {
  filterProjects,
  filterSheets,
  getInboxProject,
  getNotesProject,
  getProjectFilterTitle,
  getSheetsForProjectFilter,
  getSheetsInGroup,
  getVisibleProjectGroups,
  isNotesProject,
  resolveProjectGroupId,
  type ProjectFilter,
} from "./projectModel";
import { DEFAULT_SHEET_SORT_PREFERENCE, moveIdByPosition, sortSheetList, type RailDropPosition } from "./sheetSorting";

export interface CreateSheetListContextOptions {
  projects: WritingProject[];
  activeProject: WritingProject | undefined;
  activeSheetId: string;
  activeGroupId: string;
  activeNoteGroupId: string;
  sidebarMode: SidebarMode;
  projectFilter: ProjectFilter;
  currentDay: string;
}

export interface CreateSheetListModelOptions extends CreateSheetListContextOptions {
  sheetSearch: string;
  sheetSortPreferences: Record<string, SheetSortPreference>;
  sheetManualOrders: SheetManualOrders;
}

export interface SheetListContext {
  inboxProject: WritingProject;
  notesProject: WritingProject;
  noteGroups: ProjectGroup[];
  selectedNoteGroup: ProjectGroup | undefined;
  visibleProjectGroups: ProjectGroup[];
  resolvedActiveGroupId: string;
  filteredProjects: WritingProject[];
  selectedVisibleGroup: ProjectGroup | undefined;
  title: string;
  sortPreferenceKey: string;
  sourceSheets: WritingSheet[];
  sheetProjectTitleById: Record<string, string>;
  manualReorderContextAllowed: boolean;
  sheetActionProject: WritingProject | undefined;
  sheetActionGroupId: string;
  sheetActionActiveSheet: WritingSheet | undefined;
}

export interface FilteredSheetListModel {
  sortPreference: SheetSortPreference;
  filteredSheets: WritingSheet[];
  activeSheetIndex: number;
  canManuallyReorderSheets: boolean;
}

export type SheetListModel = SheetListContext & FilteredSheetListModel;

export function createSheetListContext({
  projects,
  activeProject,
  activeSheetId,
  activeGroupId,
  activeNoteGroupId,
  sidebarMode,
  projectFilter,
  currentDay,
}: CreateSheetListContextOptions): SheetListContext {
  const inboxProject = getInboxProject(projects);
  const notesProject = getNotesProject(projects);
  const noteGroups = getVisibleProjectGroups(notesProject);
  const selectedNoteGroup = noteGroups.find((group) => group.id === activeNoteGroupId) ?? noteGroups[0];
  const visibleProjectGroups = activeProject ? getVisibleProjectGroups(activeProject) : [];
  const resolvedActiveGroupId = activeProject ? resolveProjectGroupId(activeProject, activeGroupId, activeSheetId) : "";
  const filteredProjects = filterProjects(projects, "", projectFilter === "archived");
  const selectedVisibleGroup = visibleProjectGroups.find((group) => group.id === activeGroupId) ?? visibleProjectGroups[0];
  const title =
    sidebarMode === "project"
      ? (selectedVisibleGroup?.title ?? activeProject?.title ?? "全部")
      : activeNoteGroupId
        ? (selectedNoteGroup?.title ?? "随手记")
        : getProjectFilterTitle(projectFilter);
  const sortPreferenceKey = createSheetSortPreferenceKey({
    sidebarMode,
    activeProjectId: activeProject?.id,
    activeNoteGroupId,
    projectFilter,
    selectedVisibleGroupId: selectedVisibleGroup?.id,
    resolvedActiveGroupId,
  });
  const sourceSheets = createSheetListSource({
    projects,
    activeProject,
    inboxProject,
    notesProject,
    selectedNoteGroup,
    selectedVisibleGroup,
    sidebarMode,
    activeNoteGroupId,
    projectFilter,
    currentDay,
  });
  const sheetProjectTitleById = createSheetProjectTitleMap(projects);
  const sheetActionProject = activeNoteGroupId ? notesProject : activeProject;

  return {
    inboxProject,
    notesProject,
    noteGroups,
    selectedNoteGroup,
    visibleProjectGroups,
    resolvedActiveGroupId,
    filteredProjects,
    selectedVisibleGroup,
    title,
    sortPreferenceKey,
    sourceSheets,
    sheetProjectTitleById,
    manualReorderContextAllowed: !(sidebarMode === "library" && !activeNoteGroupId && projectFilter === "trash"),
    sheetActionProject,
    sheetActionGroupId: activeNoteGroupId ? activeNoteGroupId : resolvedActiveGroupId,
    sheetActionActiveSheet: sheetActionProject?.sheets.find((sheet) => sheet.id === activeSheetId),
  };
}

interface CreateFilteredSheetListModelOptions {
  sourceSheets: WritingSheet[];
  sortPreferenceKey: string;
  activeSheetId: string;
  sheetSearch: string;
  sheetSortPreferences: Record<string, SheetSortPreference>;
  sheetManualOrders: SheetManualOrders;
  manualReorderContextAllowed: boolean;
}

export function createFilteredSheetListModel({
  sourceSheets,
  sortPreferenceKey,
  activeSheetId,
  sheetSearch,
  sheetSortPreferences,
  sheetManualOrders,
  manualReorderContextAllowed,
}: CreateFilteredSheetListModelOptions): FilteredSheetListModel {
  const sortPreference = sheetSortPreferences[sortPreferenceKey] ?? DEFAULT_SHEET_SORT_PREFERENCE;
  const matchingSheets = filterSheets(sourceSheets, sheetSearch);
  const filteredSheets = sortSheetList(
    matchingSheets,
    sortPreference.mode,
    sortPreference.direction,
    sheetManualOrders[sortPreferenceKey] ?? [],
  );
  return {
    sortPreference,
    filteredSheets,
    activeSheetIndex: filteredSheets.findIndex((sheet) => sheet.id === activeSheetId),
    canManuallyReorderSheets: sortPreference.mode === "manual" && sheetSearch.trim() === "" && manualReorderContextAllowed,
  };
}

export function createSheetListModel(options: CreateSheetListModelOptions): SheetListModel {
  const context = createSheetListContext(options);
  const filteredList = createFilteredSheetListModel({
    sourceSheets: context.sourceSheets,
    sortPreferenceKey: context.sortPreferenceKey,
    activeSheetId: options.activeSheetId,
    sheetSearch: options.sheetSearch,
    sheetSortPreferences: options.sheetSortPreferences,
    sheetManualOrders: options.sheetManualOrders,
    manualReorderContextAllowed: context.manualReorderContextAllowed,
  });
  return { ...context, ...filteredList };
}

export function updateSheetSortPreferences(
  current: Record<string, SheetSortPreference>,
  preferenceKey: string,
  nextPreference: Partial<SheetSortPreference>,
): Record<string, SheetSortPreference> {
  const currentPreference = current[preferenceKey] ?? DEFAULT_SHEET_SORT_PREFERENCE;
  const updatedPreference = { ...currentPreference, ...nextPreference };
  if (currentPreference.mode === updatedPreference.mode && currentPreference.direction === updatedPreference.direction) {
    return current;
  }
  return { ...current, [preferenceKey]: updatedPreference };
}

export function updateVisibleSheetManualOrder(
  current: SheetManualOrders,
  preferenceKey: string,
  visibleSheetIds: string[],
  sourceSheetId: string,
  targetSheetId: string,
  position: RailDropPosition,
): SheetManualOrders {
  const savedOrder = current[preferenceKey] ?? [];
  const visibleSheetIdSet = new Set(visibleSheetIds);
  const savedVisibleIds = savedOrder.filter((sheetId) => visibleSheetIdSet.has(sheetId));
  const savedVisibleIdSet = new Set(savedVisibleIds);
  const missingVisibleIds = visibleSheetIds.filter((sheetId) => !savedVisibleIdSet.has(sheetId));
  const baseOrder = [...savedVisibleIds, ...missingVisibleIds];
  const nextOrder = moveIdByPosition(baseOrder, sourceSheetId, targetSheetId, position);
  if (nextOrder.join("|") === baseOrder.join("|")) return current;
  return { ...current, [preferenceKey]: nextOrder };
}

interface SheetSortPreferenceKeyOptions {
  sidebarMode: SidebarMode;
  activeProjectId: string | undefined;
  activeNoteGroupId: string;
  projectFilter: ProjectFilter;
  selectedVisibleGroupId: string | undefined;
  resolvedActiveGroupId: string;
}

function createSheetSortPreferenceKey({
  sidebarMode,
  activeProjectId,
  activeNoteGroupId,
  projectFilter,
  selectedVisibleGroupId,
  resolvedActiveGroupId,
}: SheetSortPreferenceKeyOptions): string {
  if (sidebarMode === "project") {
    return `project:${activeProjectId ?? "unknown"}:group:${selectedVisibleGroupId ?? resolvedActiveGroupId ?? "default"}`;
  }
  if (activeNoteGroupId) return `notes:${activeNoteGroupId}`;
  return `library:${projectFilter}`;
}

interface SheetListSourceOptions {
  projects: WritingProject[];
  activeProject: WritingProject | undefined;
  inboxProject: WritingProject;
  notesProject: WritingProject;
  selectedNoteGroup: ProjectGroup | undefined;
  selectedVisibleGroup: ProjectGroup | undefined;
  sidebarMode: SidebarMode;
  activeNoteGroupId: string;
  projectFilter: ProjectFilter;
  currentDay: string;
}

function createSheetListSource({
  projects,
  activeProject,
  inboxProject,
  notesProject,
  selectedNoteGroup,
  selectedVisibleGroup,
  sidebarMode,
  activeNoteGroupId,
  projectFilter,
  currentDay,
}: SheetListSourceOptions): WritingSheet[] {
  if (!activeProject) return [];
  if (sidebarMode === "project") {
    return selectedVisibleGroup ? getSheetsInGroup(activeProject, selectedVisibleGroup.id) : [];
  }
  if (activeNoteGroupId) {
    return selectedNoteGroup ? getSheetsInGroup(notesProject, selectedNoteGroup.id) : [];
  }
  if (projectFilter === "inbox") return inboxProject.sheets.filter((sheet) => !sheet.archivedAt && sheet.status !== "已归档");
  const librarySheets = projects.flatMap((project) =>
    project.sheets.map((sheet) => (project.archivedAt && !sheet.archivedAt ? { ...sheet, archivedAt: project.archivedAt } : sheet)),
  );
  return getSheetsForProjectFilter(librarySheets, projectFilter, currentDay);
}

function createSheetProjectTitleMap(projects: WritingProject[]): Record<string, string> {
  const titles: Record<string, string> = {};
  for (const project of projects) {
    if (isNotesProject(project)) {
      const groups = new Map(getVisibleProjectGroups(project).map((group) => [group.id, group.title]));
      for (const sheet of project.sheets) titles[sheet.id] = groups.get(sheet.groupId ?? "") ?? "笔记";
      continue;
    }
    for (const sheet of project.sheets) titles[sheet.id] = project.title;
  }
  return titles;
}
