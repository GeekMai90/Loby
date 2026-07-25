/**
 * [INPUT]: 依赖 React 运行时、shared 公共契约、写作库模块
 * [OUTPUT]: 对外提供 useLibraryTrash
 * [POS]: 写作库 feature 的React 协调边界，封装 写作库 状态、副作用与用户动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useMemo, useState } from "react";
import type { TrashEntry, WritingProject, WritingSheet } from "@/shared/types";
import { deleteTrashEntry, listLibraryTrash, restoreTrashEntry } from "@/features/library/model/persistence";
import { normalizeProjects } from "@/features/library/model/projectModel";

interface UseLibraryTrashOptions {
  enabled: boolean;
  libraryPath: string;
  onLibraryStatusChange: (status: string) => void;
  onProjectsRestored: (projects: WritingProject[]) => void;
  onRestoreSelection: (entry: TrashEntry, projects: WritingProject[]) => void;
  onSkipNextLibrarySave: () => void;
}

export function useLibraryTrash({
  enabled,
  libraryPath,
  onLibraryStatusChange,
  onProjectsRestored,
  onRestoreSelection,
  onSkipNextLibrarySave,
}: UseLibraryTrashOptions) {
  const [entries, setEntries] = useState<TrashEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setSelectedEntryId("");
      return;
    }
    let cancelled = false;
    listLibraryTrash(libraryPath)
      .then((nextEntries) => {
        if (!cancelled) setEntries(nextEntries);
      })
      .catch((error) => {
        if (!cancelled) onLibraryStatusChange(`读取废纸篓失败：${error instanceof Error ? error.message : String(error)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, libraryPath, onLibraryStatusChange, refreshVersion]);

  const selectedEntry = enabled ? entries.find((entry) => entry.id === selectedEntryId) : undefined;
  const sheets = useMemo<WritingSheet[]>(
    () =>
      entries.map((entry) => ({
        id: `trash:${entry.id}`,
        title: entry.title,
        groupId: entry.groupId,
        status: "构思",
        tags: [],
        targetWords: 0,
        description:
          entry.kind === "project" ? "已删除项目" : entry.kind === "image" ? "未使用的图片" : `来自 ${entry.projectTitle || "写作文件夹"}`,
        body: entry.body,
        createdAt: "",
        updatedAt: entry.deletedAt ? new Date(entry.deletedAt * 1000).toISOString() : "",
        properties: {},
      })),
    [entries],
  );

  const projectTitleBySheetId = useMemo(
    () =>
      Object.fromEntries(entries.map((entry) => [`trash:${entry.id}`, entry.projectTitle || (entry.kind === "image" ? "图片" : "废纸篓")])),
    [entries],
  );

  async function restoreSelectedEntry() {
    if (!selectedEntry) return;
    setActionBusy(true);
    try {
      const restoredProjects = normalizeProjects(await restoreTrashEntry(libraryPath, selectedEntry.id));
      onSkipNextLibrarySave();
      onProjectsRestored(restoredProjects);
      setEntries(await listLibraryTrash(libraryPath));
      setSelectedEntryId("");
      onRestoreSelection(selectedEntry, restoredProjects);
      const kindLabel = selectedEntry.kind === "project" ? "项目" : selectedEntry.kind === "image" ? "图片" : "文稿";
      onLibraryStatusChange(`已恢复${kindLabel}「${selectedEntry.title}」`);
    } catch (error) {
      onLibraryStatusChange(`恢复失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setActionBusy(false);
    }
  }

  async function permanentlyDeleteSelectedEntry() {
    if (!selectedEntry) return;
    if (!window.confirm(`永久删除「${selectedEntry.title}」？此操作不可撤销。`)) return;
    setActionBusy(true);
    try {
      setEntries(await deleteTrashEntry(libraryPath, selectedEntry.id));
      setSelectedEntryId("");
      onLibraryStatusChange(`已永久删除「${selectedEntry.title}」`);
    } catch (error) {
      onLibraryStatusChange(`永久删除失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setActionBusy(false);
    }
  }

  return {
    entries,
    selectedEntry,
    selectedEntryId,
    sheets,
    projectTitleBySheetId,
    actionBusy,
    setSelectedEntryId,
    restoreSelectedEntry,
    permanentlyDeleteSelectedEntry,
    refresh: () => setRefreshVersion((version) => version + 1),
  };
}
