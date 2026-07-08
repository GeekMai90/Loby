import { useEffect, useState, type MouseEvent } from "react";
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
import { clearLibraryTrash, moveProjectToTrash, revealLocalPath, saveProjects } from "../lib/persistence";
import type { ProjectGroup, SidebarMode, WritingProject } from "../types";

interface SidebarContextMenuState {
  x: number;
  y: number;
  path: string;
  label: string;
  kind: "project" | "note-group" | "sheet";
  projectId?: string;
}

interface UseSidebarContextMenuOptions {
  libraryPath: string;
  projects: WritingProject[];
  onProjectsChange: (projects: WritingProject[]) => void;
  onActiveProjectChange: (projectId: string) => void;
  onActiveSheetChange: (sheetId: string) => void;
  onActiveGroupChange: (groupId: string) => void;
  onSidebarModeChange: (mode: SidebarMode) => void;
  onProjectFilterChange: (filter: ProjectFilter) => void;
  onLibraryStatusChange: (status: string) => void;
  onSkipNextLibrarySave: () => void;
  onEditProject: (project: WritingProject) => void;
}

export function useSidebarContextMenu({
  libraryPath,
  projects,
  onProjectsChange,
  onActiveProjectChange,
  onActiveSheetChange,
  onActiveGroupChange,
  onSidebarModeChange,
  onProjectFilterChange,
  onLibraryStatusChange,
  onSkipNextLibrarySave,
  onEditProject,
}: UseSidebarContextMenuOptions) {
  const [sidebarContextMenu, setSidebarContextMenu] = useState<SidebarContextMenuState | null>(null);
  const [projectPendingTrash, setProjectPendingTrash] = useState<WritingProject | null>(null);
  const [trashClearPending, setTrashClearPending] = useState(false);

  useEffect(() => {
    if (!sidebarContextMenu) return;
    function closeMenu() {
      setSidebarContextMenu(null);
    }
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeMenu);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeMenu);
      window.removeEventListener("resize", closeMenu);
    };
  }, [sidebarContextMenu]);

  function openProjectContextMenu(event: MouseEvent<HTMLElement>, project: WritingProject) {
    event.preventDefault();
    event.stopPropagation();
    const path = buildProjectFolderPath(libraryPath, project);
    if (!path) {
      onLibraryStatusChange("当前项目还没有可打开的本地文件夹");
      return;
    }
    setSidebarContextMenu({
      x: event.clientX,
      y: event.clientY,
      path,
      label: project.title,
      kind: "project",
      projectId: project.id,
    });
  }

  function openNoteGroupContextMenu(event: MouseEvent<HTMLElement>, group: ProjectGroup) {
    event.preventDefault();
    event.stopPropagation();
    const path = buildNoteGroupFolderPath(libraryPath, group);
    if (!path) {
      onLibraryStatusChange("当前笔记分组还没有可打开的本地文件夹");
      return;
    }
    setSidebarContextMenu({
      x: event.clientX,
      y: event.clientY,
      path,
      label: group.title,
      kind: "note-group",
    });
  }

  function openSheetContextMenu(event: MouseEvent<HTMLElement>, sheetId: string) {
    event.preventDefault();
    event.stopPropagation();
    if (!libraryPath.startsWith("/")) {
      onLibraryStatusChange("当前文稿还没有可显示的本地 Markdown 文件");
      return;
    }
    const ownerProject = projects.find((project) => project.sheets.some((sheet) => sheet.id === sheetId));
    const sheet = ownerProject?.sheets.find((item) => item.id === sheetId);
    if (!ownerProject || !sheet) return;
    const path = buildSheetMarkdownPath(libraryPath, ownerProject, sheet);
    setSidebarContextMenu({
      x: event.clientX,
      y: event.clientY,
      path,
      label: sheet.title || "无标题",
      kind: "sheet",
    });
  }

  function editContextProject() {
    if (!sidebarContextMenu?.projectId) return;
    const project = projects.find((item) => item.id === sidebarContextMenu.projectId);
    if (!project) return;
    setSidebarContextMenu(null);
    onEditProject(project);
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

  async function confirmClearTrash() {
    if (!libraryPath.startsWith("/")) return;
    onLibraryStatusChange("正在清空废纸篓...");
    try {
      const nextProjects = await clearLibraryTrash(libraryPath);
      const normalizedProjects = normalizeProjects(nextProjects);
      onSkipNextLibrarySave();
      onProjectsChange(normalizedProjects);
      setTrashClearPending(false);
      onLibraryStatusChange("已清空废纸篓");
    } catch (error) {
      onLibraryStatusChange(`清空废纸篓失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    sidebarContextMenu,
    projectPendingTrash,
    trashClearPending,
    setProjectPendingTrash,
    setTrashClearPending,
    openProjectContextMenu,
    openNoteGroupContextMenu,
    openSheetContextMenu,
    editContextProject,
    showSidebarContextTargetInFinder,
    requestDeleteProjectFromContextMenu,
    confirmMoveProjectToTrash,
    confirmClearTrash,
  };
}
