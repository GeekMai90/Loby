/**
 * [INPUT]: 依赖 React、写作库导入模型与 native 持久化适配、目标项目状态和应用级选择回调
 * [OUTPUT]: 对外提供 useMarkdownImport 及 MarkdownImportController
 * [POS]: 写作库导入的 React 协调边界，串联来源选择、只读扫描、附件补充、图片复制与一次显式项目保存
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useMemo, useState } from "react";
import type { WritingProject } from "@/shared/types";
import {
  chooseMarkdownImportFiles,
  chooseMarkdownImportFolder,
  importMarkdownImages,
  scanMarkdownImport,
  type MarkdownImportScan,
} from "@/features/library/model/persistence";
import {
  buildMarkdownImportResult,
  summarizeMarkdownImportMetadata,
  type MarkdownImportBuildResult,
} from "@/features/library/model/importMarkdown";
import { INBOX_PROJECT_ID, isNotesProject } from "@/features/library/model/projectModel";

export type MarkdownImportPhase = "idle" | "scanning" | "ready" | "importing" | "finished";

export interface MarkdownImportController {
  open: boolean;
  busy: boolean;
  phase: MarkdownImportPhase;
  targetProjectId: string;
  targetProjects: WritingProject[];
  scan: MarkdownImportScan | null;
  result: MarkdownImportBuildResult | null;
  error: string;
  metadataSummary: ReturnType<typeof summarizeMarkdownImportMetadata>;
  openImport: (targetProjectId?: string) => void;
  closeImport: () => void;
  resetSource: () => void;
  setTargetProjectId: (projectId: string) => void;
  selectFiles: () => Promise<void>;
  selectFolder: () => Promise<void>;
  chooseAttachmentFolder: () => Promise<void>;
  confirmImport: () => Promise<void>;
}

interface UseMarkdownImportOptions {
  libraryPath: string;
  projects: WritingProject[];
  onProjectsChange: (projects: WritingProject[]) => void;
  onSkipNextLibrarySave: () => void;
  persistProjectsImmediately: (projects: WritingProject[]) => Promise<void>;
  onActiveProjectChange: (projectId: string) => void;
  onActiveGroupChange: (groupId: string) => void;
  onActiveSheetChange: (sheetId: string) => void;
  onLibraryStatusChange: (status: string) => void;
}

const EMPTY_METADATA_SUMMARY = { preservedKeys: [], droppedKeys: [] };

export function useMarkdownImport({
  libraryPath,
  projects,
  onProjectsChange,
  onSkipNextLibrarySave,
  persistProjectsImmediately,
  onActiveProjectChange,
  onActiveGroupChange,
  onActiveSheetChange,
  onLibraryStatusChange,
}: UseMarkdownImportOptions): MarkdownImportController {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<MarkdownImportPhase>("idle");
  const [targetProjectId, setTargetProjectIdState] = useState(INBOX_PROJECT_ID);
  const [scan, setScan] = useState<MarkdownImportScan | null>(null);
  const [result, setResult] = useState<MarkdownImportBuildResult | null>(null);
  const [error, setError] = useState("");
  const targetProjects = useMemo(() => projects.filter((project) => !isNotesProject(project)), [projects]);
  const targetProject = targetProjects.find((project) => project.id === targetProjectId) ?? targetProjects[0];
  const metadataSummary = useMemo(
    () => (scan && targetProject ? summarizeMarkdownImportMetadata(scan, targetProject) : EMPTY_METADATA_SUMMARY),
    [scan, targetProject],
  );
  const busy = phase === "scanning" || phase === "importing";

  function openImport(preferredProjectId = INBOX_PROJECT_ID) {
    if (targetProjects.length === 0) {
      onLibraryStatusChange("请先创建或打开一个写作文件夹，再导入 Markdown。");
      return;
    }
    const fallbackId = targetProjects.find((project) => project.id === preferredProjectId)?.id ?? targetProjects[0]?.id ?? INBOX_PROJECT_ID;
    setTargetProjectIdState(fallbackId);
    setScan(null);
    setResult(null);
    setError("");
    setPhase("idle");
    setOpen(true);
  }

  function closeImport() {
    if (busy) return;
    setOpen(false);
    setScan(null);
    setResult(null);
    setError("");
    setPhase("idle");
  }

  function setTargetProjectId(projectId: string) {
    if (busy) return;
    setTargetProjectIdState(projectId);
    setResult(null);
    if (scan) setPhase("ready");
  }

  function resetSource() {
    if (busy) return;
    setScan(null);
    setResult(null);
    setError("");
    setPhase("idle");
  }

  async function scanSources(sourcePaths: string[], attachmentPath?: string) {
    if (sourcePaths.length === 0) return;
    setError("");
    setResult(null);
    setPhase("scanning");
    try {
      const nextScan = await scanMarkdownImport(sourcePaths, attachmentPath);
      setScan(nextScan);
      setPhase("ready");
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : String(scanError));
      setPhase(scan ? "ready" : "idle");
    }
  }

  async function selectFiles() {
    try {
      await scanSources(await chooseMarkdownImportFiles());
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : String(selectionError));
    }
  }

  async function selectFolder() {
    try {
      const selected = await chooseMarkdownImportFolder();
      await scanSources(selected ? [selected] : []);
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : String(selectionError));
    }
  }

  async function chooseAttachmentFolder() {
    if (!scan) return;
    try {
      const selected = await chooseMarkdownImportFolder("补充 Obsidian 附件目录");
      if (selected) await scanSources(scan.sourcePaths, selected);
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : String(selectionError));
    }
  }

  async function confirmImport() {
    if (!scan || !targetProject || phase !== "ready") return;
    setError("");
    setPhase("importing");
    onLibraryStatusChange("正在导入 Markdown 文稿和图片…");
    try {
      const verifiedScan = await scanMarkdownImport(scan.sourcePaths, scan.attachmentRoot || undefined);
      setScan(verifiedScan);
      const imageSources = verifiedScan.documents.flatMap((document) =>
        document.imageReferences.flatMap((reference) =>
          reference.status === "resolved" && reference.sourcePath ? [reference.sourcePath] : [],
        ),
      );
      const transfers = await importMarkdownImages(libraryPath, imageSources);
      const importResult = buildMarkdownImportResult(verifiedScan, targetProject, libraryPath, transfers);
      const nextProjects = projects.map((project) => (project.id === targetProject.id ? importResult.project : project));
      await persistProjectsImmediately(nextProjects);
      onSkipNextLibrarySave();
      onProjectsChange(nextProjects);
      const firstSheet = importResult.importedSheets[0];
      if (firstSheet) {
        onActiveProjectChange(targetProject.id);
        onActiveGroupChange(firstSheet.groupId ?? "");
        onActiveSheetChange(firstSheet.id);
      }
      setResult(importResult);
      setPhase("finished");
      onLibraryStatusChange(
        importResult.importedSheets.length > 0 ? `已导入 ${importResult.importedSheets.length} 篇文稿` : "没有需要导入的新文稿",
      );
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : String(importError);
      setError(message);
      setPhase("ready");
      onLibraryStatusChange(`导入失败：${message}`);
    }
  }

  return {
    open,
    busy,
    phase,
    targetProjectId,
    targetProjects,
    scan,
    result,
    error,
    metadataSummary,
    openImport,
    closeImport,
    resetSource,
    setTargetProjectId,
    selectFiles,
    selectFolder,
    chooseAttachmentFolder,
    confirmImport,
  };
}
