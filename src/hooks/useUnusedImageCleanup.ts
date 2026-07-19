import { useCallback, useRef, useState } from "react";
import type { UnusedImageCandidate, WritingProject } from "../types";
import { showAppToast } from "../lib/appToast";
import { scanUnusedLibraryImages, trashUnusedLibraryImages } from "../lib/persistence";

interface UseUnusedImageCleanupOptions {
  libraryPath: string;
  persistenceReady: boolean;
  projects: WritingProject[];
  persistProjectsImmediately: (projects: WritingProject[]) => Promise<void>;
  onLibraryStatusChange: (status: string) => void;
  onTrashChanged: () => void;
}

export function useUnusedImageCleanup({
  libraryPath,
  persistenceReady,
  projects,
  persistProjectsImmediately,
  onLibraryStatusChange,
  onTrashChanged,
}: UseUnusedImageCleanupOptions) {
  const [candidates, setCandidates] = useState<UnusedImageCandidate[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const startScan = useCallback(async () => {
    if (!persistenceReady || !libraryPath || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    onLibraryStatusChange("正在扫描未使用的图片...");
    try {
      await persistProjectsImmediately(projects);
      const nextCandidates = await scanUnusedLibraryImages(libraryPath);
      setCandidates(nextCandidates);
      setSelectedPaths(new Set(nextCandidates.map((candidate) => candidate.path)));
      if (nextCandidates.length === 0) {
        onLibraryStatusChange("没有发现未使用的图片");
        showAppToast({ variant: "success", title: "无需清理", description: "没有发现未使用的图片" });
      } else {
        onLibraryStatusChange(`发现 ${nextCandidates.length} 张未使用的图片`);
        setDialogOpen(true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onLibraryStatusChange(`扫描未使用图片失败：${message}`);
      showAppToast({ variant: "error", title: "扫描失败", description: "请稍后重试" });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [libraryPath, onLibraryStatusChange, persistProjectsImmediately, persistenceReady, projects]);

  const confirmCleanup = useCallback(async () => {
    if (selectedPaths.size === 0 || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    onLibraryStatusChange("正在将未使用的图片移入废纸篓...");
    try {
      const result = await trashUnusedLibraryImages(libraryPath, [...selectedPaths]);
      setDialogOpen(false);
      setCandidates([]);
      setSelectedPaths(new Set());
      onTrashChanged();
      const skipped = result.skippedCount > 0 ? `，另有 ${result.skippedCount} 张因引用或文件状态变化被保留` : "";
      const description = `已将 ${result.movedCount} 张图片移入废纸篓${skipped}`;
      onLibraryStatusChange(description);
      showAppToast({ variant: "success", title: "清理完成", description });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onLibraryStatusChange(`清理未使用图片失败：${message}`);
      showAppToast({ variant: "error", title: "清理失败", description: "请稍后重试" });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [libraryPath, onLibraryStatusChange, onTrashChanged, selectedPaths]);

  function closeDialog() {
    if (!busyRef.current) setDialogOpen(false);
  }

  function togglePath(path: string, selected: boolean) {
    setSelectedPaths((current) => {
      const next = new Set(current);
      if (selected) next.add(path);
      else next.delete(path);
      return next;
    });
  }

  function selectAll(selected: boolean) {
    setSelectedPaths(selected ? new Set(candidates.map((candidate) => candidate.path)) : new Set());
  }

  return {
    candidates,
    selectedPaths,
    dialogOpen,
    busy,
    startScan,
    confirmCleanup,
    closeDialog,
    togglePath,
    selectAll,
  };
}
