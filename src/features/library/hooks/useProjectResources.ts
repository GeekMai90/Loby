/**
 * [INPUT]: 依赖 Tauri API、React 运行时、shared 公共契约、AI 助手模块、写作库模块
 * [OUTPUT]: 对外提供 useProjectResources
 * [POS]: 写作库 feature 的React 协调边界，封装 写作库 状态、副作用与用户动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { listen } from "@tauri-apps/api/event";
import type { Window } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import type { ProjectResourceFile, ProjectResourceText, WritingProject } from "@/shared/types";
import { listProjectResources, readProjectResourceText } from "@/features/assistant/model/agentRuntime";
import { hasProjectResourceChanges, type LibraryFileChangePayload } from "@/features/library/model/libraryFileChanges";
import { importProjectResources, openLocalPath } from "@/features/library/model/persistence";
import { isDesktopLibraryPath } from "@/features/library/model/libraryRegistry";

export function useProjectResources(activeProject: WritingProject | undefined, libraryPath: string, appWindow: Window | null) {
  const [projectResources, setProjectResources] = useState<ProjectResourceFile[]>([]);
  const [selectedResourcePaths, setSelectedResourcePaths] = useState<string[]>([]);
  const [resourceImportStatus, setResourceImportStatus] = useState("");
  const [resourcePreview, setResourcePreview] = useState<ProjectResourceText | null>(null);
  const [resourcePreviewBusy, setResourcePreviewBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!appWindow || !isDesktopLibraryPath(libraryPath)) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;

    listen<LibraryFileChangePayload>("loby://library-files-changed", (event) => {
      if (hasProjectResourceChanges(event.payload.paths)) {
        setRefreshKey((current) => current + 1);
      }
    }).then((handler) => {
      if (disposed) handler();
      else unlisten = handler;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [appWindow, libraryPath]);

  useEffect(() => {
    let cancelled = false;
    if (!activeProject || !isDesktopLibraryPath(libraryPath)) {
      setProjectResources([]);
      setSelectedResourcePaths([]);
      return;
    }

    listProjectResources(libraryPath, activeProject)
      .then((resources) => {
        if (cancelled) return;
        setProjectResources(resources);
        setSelectedResourcePaths((current) => current.filter((path) => resources.some((resource) => resource.path === path)));
        setResourcePreview((current) => (current && resources.some((resource) => resource.path === current.path) ? current : null));
      })
      .catch(() => {
        if (cancelled) return;
        setProjectResources([]);
        setSelectedResourcePaths([]);
        setResourcePreview(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activeProject, libraryPath, refreshKey]);

  useEffect(() => {
    setResourceImportStatus("");
  }, [activeProject?.id]);

  function refresh() {
    setRefreshKey((current) => current + 1);
  }

  async function importTarget(target: "assets" | "references") {
    if (!activeProject) return;
    const label = target === "assets" ? "素材" : "参考文件";
    setResourceImportStatus(`正在导入${label}...`);
    try {
      const imported = await importProjectResources(libraryPath, activeProject, target);
      if (imported.length === 0) {
        setResourceImportStatus("没有选择文件。");
        return;
      }
      setSelectedResourcePaths((current) => Array.from(new Set([...current, ...imported.map((resource) => resource.path)])));
      setResourceImportStatus(`已导入 ${imported.length} 个${label}。`);
      refresh();
    } catch (error) {
      setResourceImportStatus(`导入失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function openResourcePath(path: string, label: string) {
    setResourceImportStatus(`正在打开${label}...`);
    try {
      await openLocalPath(path);
      setResourceImportStatus(`已打开${label}。`);
    } catch (error) {
      setResourceImportStatus(`打开失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function previewResource(resource: ProjectResourceFile) {
    setResourcePreviewBusy(true);
    setResourceImportStatus(`正在预览 ${resource.name}...`);
    try {
      const [preview] = await readProjectResourceText(libraryPath, [resource.path]);
      setResourcePreview(
        preview ?? {
          path: resource.path,
          name: resource.name,
          status: "missing",
          content: "",
          sizeBytes: resource.sizeBytes,
          truncated: false,
        },
      );
      setResourceImportStatus(`已加载 ${resource.name} 的预览。`);
    } catch (error) {
      setResourcePreview({
        path: resource.path,
        name: resource.name,
        status: `read-failed: ${error instanceof Error ? error.message : String(error)}`,
        content: "",
        sizeBytes: resource.sizeBytes,
        truncated: false,
      });
      setResourceImportStatus(`预览失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setResourcePreviewBusy(false);
    }
  }

  return {
    projectResources,
    selectedResourcePaths,
    resourceImportStatus,
    resourcePreview,
    resourcePreviewBusy,
    setSelectedResourcePaths,
    clearResourcePreview: () => setResourcePreview(null),
    importTarget,
    openResourcePath,
    previewResource,
    refresh,
  };
}
