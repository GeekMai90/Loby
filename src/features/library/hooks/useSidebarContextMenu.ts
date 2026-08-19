/**
 * [INPUT]: 依赖 React 运行时、写作库统一 flush 边界、写作库模块与 shared 公共契约
 * [OUTPUT]: 对外提供 SidebarContextMenuState 类型、项目/分组/文稿右键菜单协调、分组设置与分组删除后文稿迁移，以及含单篇文稿收藏/置顶/创建副本、功能栏直达、flush 后按稳定 ID 定位真实 Markdown 并打开/显示/回收的 useSidebarContextMenu
 * [POS]: 写作库 feature 的 React 协调边界；任何会读取或移动 Markdown 的动作先 flush 编辑器队列，再把真实路径交给 native，禁止用延迟 React 快照直接整库写盘，归档文稿只改变生命周期元数据
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useState, type MouseEvent } from "react";
import {
  buildNoteGroupFolderPath,
  buildProjectFolderPath,
  buildProjectGroupFolderPath,
  buildSheetMarkdownPath,
  DEFAULT_USER_GROUP_ID,
  isNotesProject,
  normalizeProjects,
  setSheetFavorite,
  setSheetPinned,
  type ProjectFilter,
  resolveProjectGroupId,
  resolveSavedProjectSelection,
} from "@/features/library/model/projectModel";
import { deleteProjectGroup } from "@/features/library/model/projectCreation";
import {
  clearLibraryTrash,
  moveProjectGroupFilesToDefault,
  moveProjectToTrash,
  moveSheetsToTrash,
  openLocalPath,
  revealLocalPath,
  resolveSheetPath,
} from "@/features/library/model/persistence";
import { isDesktopLibraryPath } from "@/features/library/model/libraryRegistry";
import type { DocumentRailTab, ProjectGroup, SidebarMode, WritingProject, WritingSheet } from "@/shared/types";
import { nowTimestamp } from "@/shared/lib/dates";
import { getFileManagerName } from "@/shared/lib/platform";

export interface SidebarContextMenuState {
  path: string;
  label: string;
  kind: "project" | "project-group" | "note-group" | "sheet";
  projectId?: string;
  groupId?: string;
  sheetId?: string;
  sheetIds?: string[];
}

interface UseSidebarContextMenuOptions {
  libraryPath: string;
  projects: WritingProject[];
  onProjectsChange: (projects: WritingProject[]) => void;
  onActiveProjectChange: (projectId: string) => void;
  activeProjectId: string;
  activeGroupId: string;
  onActiveSheetChange: (sheetId: string) => void;
  onActiveGroupChange: (groupId: string) => void;
  onSidebarModeChange: (mode: SidebarMode) => void;
  onProjectFilterChange: (filter: ProjectFilter) => void;
  onLibraryStatusChange: (status: string) => void;
  onSkipNextLibrarySave: () => void;
  onTrashChanged: () => void;
  onSheetTrashCompleted: (projects: WritingProject[], deletedSheetIds: string[]) => void;
  onEditProject: (project: WritingProject) => void;
  onEditProjectGroup: (project: WritingProject, group: ProjectGroup) => void;
  onManageDocumentProperties: (project: WritingProject) => void;
  onFormatSheet: (projectId: string, sheetId: string) => void;
  onDuplicateSheet: (projectId: string, sheetId: string) => void;
  onOpenSheetFunctionRail: (sheetId: string, tab: DocumentRailTab) => void;
  flushPendingSave: () => Promise<void>;
  persistProjectsImmediately: (projects: WritingProject[]) => Promise<void>;
}

export function useSidebarContextMenu({
  libraryPath,
  projects,
  onProjectsChange,
  onActiveProjectChange,
  activeProjectId,
  activeGroupId,
  onActiveSheetChange,
  onActiveGroupChange,
  onSidebarModeChange,
  onProjectFilterChange,
  onLibraryStatusChange,
  onSkipNextLibrarySave,
  onTrashChanged,
  onSheetTrashCompleted,
  onEditProject,
  onEditProjectGroup,
  onManageDocumentProperties,
  onFormatSheet,
  onDuplicateSheet,
  onOpenSheetFunctionRail,
  flushPendingSave,
  persistProjectsImmediately,
}: UseSidebarContextMenuOptions) {
  const [sidebarContextMenu, setSidebarContextMenu] = useState<SidebarContextMenuState | null>(null);
  const [projectPendingTrash, setProjectPendingTrash] = useState<WritingProject | null>(null);
  const [projectGroupPendingDelete, setProjectGroupPendingDelete] = useState<{
    project: WritingProject;
    group: ProjectGroup;
  } | null>(null);
  const [sheetPendingTrash, setSheetPendingTrash] = useState<Array<{ project: WritingProject; sheet: WritingSheet }> | null>(null);
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

  function openProjectGroupContextMenu(event: MouseEvent<HTMLElement>, project: WritingProject, group: ProjectGroup) {
    void event;
    if (group.id === DEFAULT_USER_GROUP_ID) return;
    const path = buildProjectGroupFolderPath(libraryPath, project, group);
    if (!path) {
      onLibraryStatusChange("当前分组还没有可打开的本地文件夹");
      return;
    }
    setSidebarContextMenu({
      path,
      label: group.title,
      kind: "project-group",
      projectId: project.id,
      groupId: group.id,
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
    if (!isDesktopLibraryPath(libraryPath)) {
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

  function editContextProjectGroup() {
    if (sidebarContextMenu?.kind !== "project-group" || !sidebarContextMenu.projectId || !sidebarContextMenu.groupId) return;
    const project = projects.find((item) => item.id === sidebarContextMenu.projectId);
    const group = project?.groups?.find((item) => item.id === sidebarContextMenu.groupId);
    if (!project || !group) return;
    setSidebarContextMenu(null);
    onEditProjectGroup(project, group);
  }

  function manageContextDocumentProperties() {
    if (!sidebarContextMenu?.projectId) return;
    const project = projects.find((item) => item.id === sidebarContextMenu.projectId);
    if (!project) return;
    setSidebarContextMenu(null);
    onManageDocumentProperties(project);
  }

  async function showSidebarContextTargetInFinder() {
    if (!sidebarContextMenu) return;
    const target = sidebarContextMenu;
    setSidebarContextMenu(null);
    const fileManagerName = getFileManagerName();
    onLibraryStatusChange(`正在${fileManagerName}中显示：${target.label}`);
    try {
      await flushPendingSave();
      const path = await resolveContextSheetPath(target);
      await revealLocalPath(path);
      onLibraryStatusChange(`已在${fileManagerName}中显示：${target.label}`);
    } catch (error) {
      onLibraryStatusChange(`在${fileManagerName}中显示失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function openContextSheetWithDefaultApplication() {
    if (sidebarContextMenu?.kind !== "sheet") return;
    const target = sidebarContextMenu;
    setSidebarContextMenu(null);
    onLibraryStatusChange(`正在使用默认应用打开：${target.label}`);
    try {
      await flushPendingSave();
      const path = await resolveContextSheetPath(target);
      await openLocalPath(path);
      onLibraryStatusChange(`已使用默认应用打开：${target.label}`);
    } catch (error) {
      onLibraryStatusChange(`使用默认应用打开失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function resolveContextSheetPath(target: SidebarContextMenuState): Promise<string> {
    if (target.kind !== "sheet" || !target.sheetId) return target.path;
    return resolveSheetPath(libraryPath, target.sheetId);
  }

  function requestDeleteProjectFromContextMenu() {
    if (!sidebarContextMenu?.projectId) return;
    const project = projects.find((item) => item.id === sidebarContextMenu.projectId);
    if (!project || isNotesProject(project)) return;
    setSidebarContextMenu(null);
    setProjectPendingTrash(project);
  }

  function requestDeleteProjectGroupFromContextMenu() {
    if (sidebarContextMenu?.kind !== "project-group" || !sidebarContextMenu.projectId || !sidebarContextMenu.groupId) return;
    if (sidebarContextMenu.groupId === DEFAULT_USER_GROUP_ID) return;
    const project = projects.find((item) => item.id === sidebarContextMenu.projectId);
    const group = project?.groups?.find((item) => item.id === sidebarContextMenu.groupId);
    if (!project || !group) return;
    setSidebarContextMenu(null);
    setProjectGroupPendingDelete({ project, group });
  }

  function requestDeleteSheetFromContextMenu() {
    if (!sidebarContextMenu?.projectId || !sidebarContextMenu.sheetId) return;
    const sheetIds = sidebarContextMenu.sheetIds ?? [sidebarContextMenu.sheetId];
    const entries = sheetIds.flatMap((sheetId) => {
      const project = projects.find((item) => item.sheets.some((sheet) => sheet.id === sheetId));
      const sheet = project?.sheets.find((item) => item.id === sheetId);
      return project && sheet ? [{ project, sheet }] : [];
    });
    if (entries.length === 0) return;
    setSidebarContextMenu(null);
    setSheetPendingTrash(entries);
  }

  function formatContextSheet() {
    if (!sidebarContextMenu?.projectId || !sidebarContextMenu.sheetId) return;
    const { projectId, sheetId } = sidebarContextMenu;
    setSidebarContextMenu(null);
    onFormatSheet(projectId, sheetId);
  }

  function duplicateContextSheet() {
    if (sidebarContextMenu?.kind !== "sheet" || !sidebarContextMenu.projectId || !sidebarContextMenu.sheetId) return;
    const { projectId, sheetId } = sidebarContextMenu;
    setSidebarContextMenu(null);
    onDuplicateSheet(projectId, sheetId);
  }

  function openContextSheetFunctionRail(tab: DocumentRailTab) {
    if (sidebarContextMenu?.kind !== "sheet" || !sidebarContextMenu.sheetId) return;
    if ((sidebarContextMenu.sheetIds?.length ?? 1) !== 1) return;
    const { sheetId } = sidebarContextMenu;
    setSidebarContextMenu(null);
    onOpenSheetFunctionRail(sheetId, tab);
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
                    current.id === sheet.id ? { ...current, archivedAt: archived ? now : "" } : current,
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

  function toggleContextFavorite() {
    if (sidebarContextMenu?.kind !== "sheet" || !sidebarContextMenu.projectId || !sidebarContextMenu.sheetId) return;
    const project = projects.find((item) => item.id === sidebarContextMenu.projectId);
    const sheet = project?.sheets.find((item) => item.id === sidebarContextMenu.sheetId);
    if (!sheet) return;
    const favorite = !sheet.favorite;
    setSidebarContextMenu(null);
    onProjectsChange(setSheetFavorite(projects, sheet.id, favorite));
    onLibraryStatusChange(favorite ? `已收藏文稿「${sheet.title}」` : `已取消收藏文稿「${sheet.title}」`);
  }

  function contextFavoriteLabel() {
    if (sidebarContextMenu?.kind !== "sheet" || !sidebarContextMenu.projectId || !sidebarContextMenu.sheetId) return "收藏";
    const project = projects.find((item) => item.id === sidebarContextMenu.projectId);
    const sheet = project?.sheets.find((item) => item.id === sidebarContextMenu.sheetId);
    return sheet?.favorite ? "取消收藏" : "收藏";
  }

  function toggleContextPinned() {
    if (sidebarContextMenu?.kind !== "sheet" || !sidebarContextMenu.projectId || !sidebarContextMenu.sheetId) return;
    const project = projects.find((item) => item.id === sidebarContextMenu.projectId);
    const sheet = project?.sheets.find((item) => item.id === sidebarContextMenu.sheetId);
    if (!sheet) return;
    const pinned = !sheet.pinned;
    setSidebarContextMenu(null);
    onProjectsChange(setSheetPinned(projects, sheet.id, pinned));
    onLibraryStatusChange(pinned ? `已置顶文稿「${sheet.title}」` : `已取消置顶文稿「${sheet.title}」`);
  }

  function contextPinnedLabel() {
    if (sidebarContextMenu?.kind !== "sheet" || !sidebarContextMenu.projectId || !sidebarContextMenu.sheetId) return "置顶";
    const project = projects.find((item) => item.id === sidebarContextMenu.projectId);
    const sheet = project?.sheets.find((item) => item.id === sidebarContextMenu.sheetId);
    return sheet?.pinned ? "取消置顶" : "置顶";
  }

  async function confirmMoveProjectToTrash() {
    if (!projectPendingTrash) return;
    onLibraryStatusChange(`正在将「${projectPendingTrash.title}」移入废纸篓...`);
    try {
      await flushPendingSave();
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

  async function confirmMoveProjectGroupToDefault() {
    if (!projectGroupPendingDelete) return;
    const pending = projectGroupPendingDelete;
    const project = projects.find((item) => item.id === pending.project.id);
    const group = project?.groups?.find((item) => item.id === pending.group.id);
    const defaultGroup = project?.groups?.find((item) => item.id === DEFAULT_USER_GROUP_ID);
    if (!project || !group || !defaultGroup) {
      onLibraryStatusChange("删除分组失败：找不到待整理分组。");
      return;
    }

    const sheetCount = project.sheets.filter((sheet) => sheet.groupId === group.id).length;
    onLibraryStatusChange(`正在删除分组「${group.title}」...`);
    try {
      await flushPendingSave();
      await moveProjectGroupFilesToDefault(libraryPath, project, group, defaultGroup);
      const nextProjects = normalizeProjects(projects.map((item) => (item.id === project.id ? deleteProjectGroup(item, group.id) : item)));
      await persistProjectsImmediately(nextProjects);
      onSkipNextLibrarySave();
      onProjectsChange(nextProjects);
      setProjectGroupPendingDelete(null);
      if (activeProjectId === project.id && activeGroupId === group.id) {
        onActiveGroupChange(defaultGroup.id);
      }
      onLibraryStatusChange(
        sheetCount > 0
          ? `已删除分组「${group.title}」，${sheetCount} 篇文稿已移到「${defaultGroup.title}」`
          : `已删除分组「${group.title}」`,
      );
    } catch (error) {
      onLibraryStatusChange(`删除分组失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function confirmMoveSheetToTrash() {
    if (!sheetPendingTrash) return;
    const pending = sheetPendingTrash;
    const first = pending[0];
    onLibraryStatusChange(
      pending.length > 1 ? `正在将 ${pending.length} 篇文稿移入废纸篓...` : `正在将「${first.sheet.title}」移入废纸篓...`,
    );
    try {
      await flushPendingSave();
      const deletedSheetIds = new Set(pending.map(({ sheet }) => sheet.id));
      const nextProjects = normalizeProjects(
        await moveSheetsToTrash(
          libraryPath,
          pending.map(({ project, sheet }) => ({
            projectId: project.id,
            projectTitle: project.title,
            sheetId: sheet.id,
            sheetTitle: sheet.title,
            groupId: sheet.groupId ?? "",
          })),
        ),
      );
      onSkipNextLibrarySave();
      onProjectsChange(nextProjects);
      onTrashChanged();
      setSheetPendingTrash(null);
      onSheetTrashCompleted(nextProjects, [...deletedSheetIds]);
      onLibraryStatusChange(pending.length > 1 ? `已将 ${pending.length} 篇文稿移入废纸篓` : `已将「${first.sheet.title}」移入废纸篓`);
    } catch (error) {
      onLibraryStatusChange(`删除文稿失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function confirmClearTrash() {
    if (!isDesktopLibraryPath(libraryPath)) return;
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
    projectGroupPendingDelete,
    sheetPendingTrash,
    trashClearPending,
    setProjectPendingTrash,
    setProjectGroupPendingDelete,
    setSheetPendingTrash,
    setTrashClearPending,
    closeSidebarContextMenu: () => setSidebarContextMenu(null),
    openProjectContextMenu,
    openProjectGroupContextMenu,
    openNoteGroupContextMenu,
    openSheetContextMenu,
    editContextProject,
    editContextProjectGroup,
    manageContextDocumentProperties,
    showSidebarContextTargetInFinder,
    openContextSheetWithDefaultApplication,
    requestDeleteProjectFromContextMenu,
    requestDeleteProjectGroupFromContextMenu,
    requestDeleteSheetFromContextMenu,
    formatContextSheet,
    duplicateContextSheet,
    openContextSheetFunctionRail,
    toggleContextFavorite,
    contextFavoriteLabel,
    toggleContextPinned,
    contextPinnedLabel,
    toggleContextArchive,
    contextArchiveLabel,
    confirmMoveProjectToTrash,
    confirmMoveProjectGroupToDefault,
    confirmMoveSheetToTrash,
    confirmClearTrash,
  };
}
