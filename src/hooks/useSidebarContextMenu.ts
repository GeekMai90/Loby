import { useState, type MouseEvent } from "react";
import {
  buildNoteGroupFolderPath,
  buildProjectFolderPath,
  buildSheetMarkdownPath,
  isNotesProject,
  normalizeProjects,
  type ProjectFilter,
  resolveProjectGroupId,
  resolveSavedProjectSelection,
} from "../lib/projectModel";
import { clearLibraryTrash, moveProjectToTrash, moveSheetToTrash, revealLocalPath, saveProjects } from "../lib/persistence";
import type { ProjectGroup, SidebarMode, WritingProject, WritingSheet } from "../types";
import { nowTimestamp } from "../lib/dates";

interface SidebarContextMenuState {
  path: string;
  label: string;
  kind: "project" | "note-group" | "sheet";
  projectId?: string;
  sheetId?: string;
  sheetIds?: string[];
}

interface UseSidebarContextMenuOptions {
  libraryPath: string;
  projects: WritingProject[];
  activeProjectId: string;
  activeSheetId: string;
  onProjectsChange: (projects: WritingProject[]) => void;
  onActiveProjectChange: (projectId: string) => void;
  onActiveSheetChange: (sheetId: string) => void;
  onActiveGroupChange: (groupId: string) => void;
  onSidebarModeChange: (mode: SidebarMode) => void;
  onProjectFilterChange: (filter: ProjectFilter) => void;
  onLibraryStatusChange: (status: string) => void;
  onSkipNextLibrarySave: () => void;
  onTrashChanged: () => void;
  onEditProject: (project: WritingProject) => void;
  onManageProjectFields: (project: WritingProject) => void;
  onFormatSheet: (projectId: string, sheetId: string) => void;
}

export function useSidebarContextMenu({
  libraryPath,
  projects,
  activeProjectId,
  activeSheetId,
  onProjectsChange,
  onActiveProjectChange,
  onActiveSheetChange,
  onActiveGroupChange,
  onSidebarModeChange,
  onProjectFilterChange,
  onLibraryStatusChange,
  onSkipNextLibrarySave,
  onTrashChanged,
  onEditProject,
  onManageProjectFields,
  onFormatSheet,
}: UseSidebarContextMenuOptions) {
  const [sidebarContextMenu, setSidebarContextMenu] = useState<SidebarContextMenuState | null>(null);
  const [projectPendingTrash, setProjectPendingTrash] = useState<WritingProject | null>(null);
  const [sheetPendingTrash, setSheetPendingTrash] = useState<{ project: WritingProject; sheet: WritingSheet } | null>(null);
  const [trashClearPending, setTrashClearPending] = useState(false);

  function openProjectContextMenu(event: MouseEvent<HTMLElement>, project: WritingProject) {
    void event;
    const path = buildProjectFolderPath(libraryPath, project);
    if (!path) {
      onLibraryStatusChange("当前项目还没有可打开的本地文件夹");
      return;
    }
    setSidebarContextMenu({
      path,
      label: project.title,
      kind: "project",
      projectId: project.id,
    });
  }

  function openNoteGroupContextMenu(event: MouseEvent<HTMLElement>, group: ProjectGroup) {
    void event;
    const path = buildNoteGroupFolderPath(libraryPath, group);
    if (!path) {
      onLibraryStatusChange("当前笔记分组还没有可打开的本地文件夹");
      return;
    }
    setSidebarContextMenu({
      path,
      label: group.title,
      kind: "note-group",
    });
  }

  function openSheetContextMenu(event: MouseEvent<HTMLElement>, sheetId: string, sheetIds: string[] = [sheetId]) {
    void event;
    if (!libraryPath.startsWith("/")) {
      onLibraryStatusChange("当前文稿还没有可显示的本地 Markdown 文件");
      return;
    }
    const ownerProject = projects.find((project) => project.sheets.some((sheet) => sheet.id === sheetId));
    const sheet = ownerProject?.sheets.find((item) => item.id === sheetId);
    if (!ownerProject || !sheet) return;
    const path = buildSheetMarkdownPath(libraryPath, ownerProject, sheet);
    setSidebarContextMenu({
      path,
      label: sheet.title || "无标题",
      kind: "sheet",
      projectId: ownerProject.id,
      sheetId: sheet.id,
      sheetIds: Array.from(new Set([sheet.id, ...sheetIds])),
    });
  }

  function editContextProject() {
    if (!sidebarContextMenu?.projectId) return;
    const project = projects.find((item) => item.id === sidebarContextMenu.projectId);
    if (!project) return;
    setSidebarContextMenu(null);
    onEditProject(project);
  }

  function manageContextProjectFields() {
    if (!sidebarContextMenu?.projectId) return;
    const project = projects.find((item) => item.id === sidebarContextMenu.projectId);
    if (!project) return;
    setSidebarContextMenu(null);
    onManageProjectFields(project);
  }

  async function showSidebarContextTargetInFinder() {
    if (!sidebarContextMenu) return;
    const target = sidebarContextMenu;
    setSidebarContextMenu(null);
    onLibraryStatusChange(`正在访达中显示：${target.label}`);
    try {
      await saveProjects(projects, libraryPath);
      await revealLocalPath(target.path);
      onLibraryStatusChange(`已在访达中显示：${target.label}`);
    } catch (error) {
      onLibraryStatusChange(`在访达中显示失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function requestDeleteProjectFromContextMenu() {
    if (!sidebarContextMenu?.projectId) return;
    const project = projects.find((item) => item.id === sidebarContextMenu.projectId);
    if (!project || isNotesProject(project)) return;
    setSidebarContextMenu(null);
    setProjectPendingTrash(project);
  }

  function requestDeleteSheetFromContextMenu() {
    if (!sidebarContextMenu?.projectId || !sidebarContextMenu.sheetId) return;
    const project = projects.find((item) => item.id === sidebarContextMenu.projectId);
    const sheet = project?.sheets.find((item) => item.id === sidebarContextMenu.sheetId);
    if (!project || !sheet) return;
    setSidebarContextMenu(null);
    setSheetPendingTrash({ project, sheet });
  }

  function formatContextSheet() {
    if (!sidebarContextMenu?.projectId || !sidebarContextMenu.sheetId) return;
    const { projectId, sheetId } = sidebarContextMenu;
    setSidebarContextMenu(null);
    onFormatSheet(projectId, sheetId);
  }

  function toggleContextCompletion() {
    if (!sidebarContextMenu?.projectId || !sidebarContextMenu.sheetId) return;
    const target = sidebarContextMenu;
    const project = projects.find((item) => item.id === target.projectId);
    const sheet = project?.sheets.find((item) => item.id === target.sheetId);
    if (!project || !sheet) return;
    const now = nowTimestamp();
    const completed = !sheet.completedAt;
    setSidebarContextMenu(null);
    onProjectsChange(
      normalizeProjects(
        projects.map((item) =>
          item.id === project.id
            ? {
                ...item,
                updatedAt: now,
                sheets: item.sheets.map((current) =>
                  current.id === sheet.id ? { ...current, completedAt: completed ? now : "", updatedAt: now } : current,
                ),
              }
            : item,
        ),
      ),
    );
    onLibraryStatusChange(completed ? `已标记「${sheet.title}」为完成` : `已取消「${sheet.title}」的完成标记`);
  }

  function contextCompletionLabel() {
    if (!sidebarContextMenu?.projectId || !sidebarContextMenu.sheetId) return "标记为完成";
    const sheet = projects
      .find((item) => item.id === sidebarContextMenu.projectId)
      ?.sheets.find((item) => item.id === sidebarContextMenu.sheetId);
    return sheet?.completedAt ? "标记为未完成" : "标记为完成";
  }

  function canToggleContextCompletion() {
    if (!sidebarContextMenu?.projectId || !sidebarContextMenu.sheetId) return false;
    return Boolean(
      projects.find((item) => item.id === sidebarContextMenu.projectId)?.sheets.find((item) => item.id === sidebarContextMenu.sheetId),
    );
  }

  function toggleContextArchive() {
    if (!sidebarContextMenu?.projectId) return;
    const target = sidebarContextMenu;
    const now = nowTimestamp();
    const project = projects.find((item) => item.id === target.projectId);
    if (!project) return;
    setSidebarContextMenu(null);
    if (target.kind === "project") {
      const archived = !project.archivedAt;
      onProjectsChange(
        normalizeProjects(
          projects.map((item) => (item.id === project.id ? { ...item, archivedAt: archived ? now : "", updatedAt: now } : item)),
        ),
      );
      onLibraryStatusChange(archived ? `已归档项目「${project.title}」` : `已恢复项目「${project.title}」`);
      return;
    }
    if (target.kind === "sheet" && target.sheetId) {
      const sheet = project.sheets.find((item) => item.id === target.sheetId);
      if (!sheet) return;
      const archived = !sheet.archivedAt;
      onProjectsChange(
        normalizeProjects(
          projects.map((item) =>
            item.id === project.id
              ? {
                  ...item,
                  updatedAt: now,
                  sheets: item.sheets.map((current) =>
                    current.id === sheet.id ? { ...current, archivedAt: archived ? now : "", updatedAt: now } : current,
                  ),
                }
              : item,
          ),
        ),
      );
      onLibraryStatusChange(archived ? `已归档文稿「${sheet.title}」` : `已恢复文稿「${sheet.title}」`);
    }
  }

  function contextArchiveLabel() {
    if (!sidebarContextMenu?.projectId) return "归档";
    const project = projects.find((item) => item.id === sidebarContextMenu.projectId);
    if (!project) return "归档";
    if (sidebarContextMenu.kind === "project") return project.archivedAt ? "恢复项目" : "归档项目";
    const sheet = project.sheets.find((item) => item.id === sidebarContextMenu.sheetId);
    return sheet?.archivedAt ? "恢复文稿" : "归档文稿";
  }

  async function confirmMoveProjectToTrash() {
    if (!projectPendingTrash) return;
    onLibraryStatusChange(`正在将「${projectPendingTrash.title}」移入废纸篓...`);
    try {
      const nextProjects = await moveProjectToTrash(libraryPath, projectPendingTrash);
      const normalizedProjects = normalizeProjects(nextProjects);
      const restoredSelection = resolveSavedProjectSelection(normalizedProjects, "", "");
      const restoredProject = normalizedProjects.find((project) => project.id === restoredSelection.projectId);
      onSkipNextLibrarySave();
      onProjectsChange(normalizedProjects);
      onTrashChanged();
      setProjectPendingTrash(null);
      onActiveProjectChange(restoredSelection.projectId);
      onActiveSheetChange(restoredSelection.sheetId);
      onActiveGroupChange(restoredProject ? resolveProjectGroupId(restoredProject, "", restoredSelection.sheetId) : "");
      onSidebarModeChange("library");
      onProjectFilterChange("active");
      onLibraryStatusChange(`已将「${projectPendingTrash.title}」移入废纸篓`);
    } catch (error) {
      onLibraryStatusChange(`删除项目失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function confirmMoveSheetToTrash() {
    if (!sheetPendingTrash) return;
    const { project, sheet } = sheetPendingTrash;
    onLibraryStatusChange(`正在将「${sheet.title}」移入废纸篓...`);
    try {
      await saveProjects(projects, libraryPath);
      const nextProjects = normalizeProjects(await moveSheetToTrash(libraryPath, project, sheet));
      const nextProject = nextProjects.find((item) => item.id === project.id);
      const nextSheet = nextProject?.sheets.find((item) => !item.archivedAt) ?? nextProject?.sheets[0];
      onSkipNextLibrarySave();
      onProjectsChange(nextProjects);
      onTrashChanged();
      setSheetPendingTrash(null);
      if (activeProjectId === project.id && activeSheetId === sheet.id) {
        onActiveProjectChange(nextProject?.id ?? resolveSavedProjectSelection(nextProjects, "", "").projectId);
        onActiveSheetChange(nextSheet?.id ?? "");
        onActiveGroupChange(nextSheet?.groupId ?? "");
      }
      onLibraryStatusChange(`已将「${sheet.title}」移入废纸篓`);
    } catch (error) {
      onLibraryStatusChange(`删除文稿失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function confirmClearTrash() {
    if (!libraryPath.startsWith("/")) return;
    onLibraryStatusChange("正在清空废纸篓...");
    try {
      const nextProjects = await clearLibraryTrash(libraryPath);
      const normalizedProjects = normalizeProjects(nextProjects);
      onSkipNextLibrarySave();
      onProjectsChange(normalizedProjects);
      onTrashChanged();
      setTrashClearPending(false);
      onLibraryStatusChange("已将废纸篓内容移入系统废纸篓");
    } catch (error) {
      onLibraryStatusChange(`清空废纸篓失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    sidebarContextMenu,
    projectPendingTrash,
    sheetPendingTrash,
    trashClearPending,
    setProjectPendingTrash,
    setSheetPendingTrash,
    setTrashClearPending,
    closeSidebarContextMenu: () => setSidebarContextMenu(null),
    openProjectContextMenu,
    openNoteGroupContextMenu,
    openSheetContextMenu,
    editContextProject,
    manageContextProjectFields,
    showSidebarContextTargetInFinder,
    requestDeleteProjectFromContextMenu,
    requestDeleteSheetFromContextMenu,
    formatContextSheet,
    toggleContextCompletion,
    contextCompletionLabel,
    canToggleContextCompletion,
    toggleContextArchive,
    contextArchiveLabel,
    confirmMoveProjectToTrash,
    confirmMoveSheetToTrash,
    confirmClearTrash,
  };
}
