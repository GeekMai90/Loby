import { useEffect, useState } from "react";
import type { ProjectResourceFile, ProjectResourceText, WritingProject } from "../types";
import { listProjectResources, readProjectResourceText } from "../lib/codex";
import { importProjectResources, openLocalPath } from "../lib/persistence";

export function useProjectResources(activeProject: WritingProject | undefined, libraryPath: string) {
  const [projectResources, setProjectResources] = useState<ProjectResourceFile[]>([]);
  const [selectedResourcePaths, setSelectedResourcePaths] = useState<string[]>([]);
  const [resourceImportStatus, setResourceImportStatus] = useState("");
  const [resourcePreview, setResourcePreview] = useState<ProjectResourceText | null>(null);
  const [resourcePreviewBusy, setResourcePreviewBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!activeProject || !libraryPath.startsWith("/")) {
      setProjectResources([]);
      setSelectedResourcePaths([]);
      return;
    }

    listProjectResources(libraryPath, activeProject.id)
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
      const imported = await importProjectResources(libraryPath, activeProject.id, target);
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
