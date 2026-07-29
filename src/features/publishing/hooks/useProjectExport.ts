/**
 * [INPUT]: 依赖 React 运行时、shared 公共契约、发布模块、写作库标准 Markdown 图片 bundle、编辑器模块
 * [OUTPUT]: 对外提供 useProjectExport，导出时将兼容图片引用统一投影为可移植的标准 Markdown
 * [POS]: 发布 feature 的 React 协调边界，封装项目导出状态、副作用与用户动作，不拥有源文稿格式迁移
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";
import type { ExportHistoryItem, WritingProject } from "@/shared/types";
import { ExportPanel } from "@/features/publishing/components/ExportPanel";
import { nowTimestamp, today } from "@/shared/lib/dates";
import {
  compileHtml,
  compileMarkdown,
  compilePlainText,
  compileWechatHtml,
  compileXhsDraft,
  getPublishableSheets,
} from "@/features/publishing/model/export";
import { copyTextToClipboard, downloadText, openPrintPreview } from "@/features/publishing/model/exportBrowser";
import {
  analyzeImageDependencies,
  buildImageExportBundle,
  rewriteSheetImageReferencesForBundle,
  type ImageDependencySummary,
} from "@/features/library/model/imageAssets";
import {
  allExportSheetIds,
  getSelectedExportSheets,
  moveExportSheetId,
  pruneExportSelection,
  toggleExportSheetId,
} from "@/features/publishing/model/exportSelection";
import { openLocalPath, saveProjectExport, saveProjectExportBundle } from "@/features/library/model/persistence";
import { DEFAULT_USER_GROUP_ID, getPublishingChecklist } from "@/features/library/model/projectModel";
import { countWords, slugifyTitle } from "@/shared/lib/text";
import { createSheetWithProjectDefaults } from "@/features/editor/model/documentProperties";

const MAX_EXPORT_HISTORY_ITEMS = 30;

interface UseProjectExportParams {
  project: WritingProject | undefined;
  libraryPath: string;
  activeGroupId: string;
  knownResourcePaths: string[];
  updateProject: (projectId: string, updater: (project: WritingProject) => WritingProject) => void;
  onSelectSheet: (sheetId: string) => void;
  onShowInfo: () => void;
  onResourceChanged: () => void;
}

export function useProjectExport({
  project,
  libraryPath,
  activeGroupId,
  knownResourcePaths,
  updateProject,
  onSelectSheet,
  onShowInfo,
  onResourceChanged,
}: UseProjectExportParams) {
  const [selectedSheetIds, setSelectedSheetIds] = useState<string[]>([]);
  const [selectionProjectId, setSelectionProjectId] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [compiledHtml, setCompiledHtml] = useState("");
  const [htmlBusy, setHtmlBusy] = useState(false);
  const publishableSheets = useMemo(() => (project ? getPublishableSheets(project) : []), [project]);
  const publishableSheetSignature = publishableSheets.map((sheet) => sheet.id).join("|");
  const selectedSheets = useMemo(() => getSelectedExportSheets(publishableSheets, selectedSheetIds), [publishableSheets, selectedSheetIds]);
  const markdown = useMemo(() => (project ? compileMarkdown(project, selectedSheets) : ""), [project, selectedSheets]);
  const plainText = useMemo(() => (project ? compilePlainText(project, selectedSheets) : ""), [project, selectedSheets]);
  const wechatHtml = useMemo(() => (project ? compileWechatHtml(project, selectedSheets) : ""), [project, selectedSheets]);
  const xhsDraft = useMemo(() => (project ? compileXhsDraft(project, selectedSheets) : ""), [project, selectedSheets]);
  const imageSummary = useMemo<ImageDependencySummary>(
    () =>
      project
        ? analyzeImageDependencies(libraryPath, project, selectedSheets, knownResourcePaths)
        : { total: 0, local: 0, external: 0, bundled: 0, missing: [] },
    [knownResourcePaths, libraryPath, project, selectedSheets],
  );

  useEffect(() => {
    let cancelled = false;
    if (!project) {
      setCompiledHtml("");
      setHtmlBusy(false);
      return;
    }

    setHtmlBusy(true);
    compileHtml(project, selectedSheets)
      .then((html) => {
        if (!cancelled) setCompiledHtml(html);
      })
      .catch((error) => {
        if (!cancelled) setCompiledHtml(`<!-- HTML export failed: ${error instanceof Error ? error.message : String(error)} -->`);
      })
      .finally(() => {
        if (!cancelled) setHtmlBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [project, selectedSheets]);

  useEffect(() => {
    if (!project) return;
    const ids = allExportSheetIds(publishableSheets);
    if (selectionProjectId !== project.id) {
      setSelectedSheetIds(ids);
      setSelectionProjectId(project.id);
      setSaveStatus("");
      return;
    }
    setSelectedSheetIds((current) => pruneExportSelection(current, publishableSheets));
  }, [project, selectionProjectId, publishableSheetSignature, publishableSheets]);

  function removeSheetFromSelection(sheetId: string) {
    setSelectedSheetIds((current) => current.filter((id) => id !== sheetId));
  }

  function toggleSheet(sheetId: string) {
    setSelectedSheetIds((current) => toggleExportSheetId(current, sheetId));
  }

  function moveSheet(sheetId: string, direction: -1 | 1) {
    setSelectedSheetIds((current) => moveExportSheetId(current, sheetId, direction));
  }

  function createPublishVersionSheet() {
    if (!project || selectedSheets.length === 0) return;
    const id = `sheet-${Date.now()}`;
    const now = nowTimestamp();
    const wordCount = selectedSheets.reduce((total, sheet) => total + countWords(sheet.body), 0);
    const sheet = createSheetWithProjectDefaults(project, {
      id,
      title: `${project.title}｜发布版本 ${today()}`,
      groupId: activeGroupId || DEFAULT_USER_GROUP_ID,
      targetWords: Math.max(wordCount, 1),
      description: `由 ${selectedSheets.length} 张稿件卡片组合生成：${selectedSheets.map((item) => item.title).join("、")}`,
      body: markdown,
      updatedAt: now,
    });

    updateProject(project.id, (currentProject) => ({
      ...currentProject,
      updatedAt: nowTimestamp(),
      sheets: [...currentProject.sheets, sheet],
    }));
    onSelectSheet(id);
    onShowInfo();
  }

  function togglePublishingChecklistItem(itemId: string) {
    if (!project) return;
    updateProject(project.id, (currentProject) => {
      const checklist = getPublishingChecklist(currentProject).map((item) => (item.id === itemId ? { ...item, done: !item.done } : item));
      return {
        ...currentProject,
        publishingChecklist: checklist,
        updatedAt: nowTimestamp(),
      };
    });
  }

  async function saveCompiledExportFile(
    suffix: string,
    content: string,
    label: string,
    contentReady = true,
    bundleFormat?: "markdown" | "html",
  ) {
    if (!project || selectedSheets.length === 0) return;
    if (!contentReady) {
      setSaveStatus(`${label} 还在生成中，请稍后再保存。`);
      return;
    }

    const baseName = slugifyTitle(project.title) || "loby-export";
    const filename = `${baseName}${suffix}`;
    setSaveStatus(`正在保存 ${label}...`);
    try {
      const bundle = bundleFormat
        ? buildImageExportBundle(libraryPath, project, selectedSheets, { knownResourcePaths })
        : { assets: [], missing: [] };
      const shouldSaveBundle = bundleFormat && bundle.assets.length > 0;
      let savedPath = "";
      let savedFilename = filename;
      if (shouldSaveBundle) {
        const directoryName = `${baseName}-${bundleFormat}-bundle`;
        const bundledContent =
          bundleFormat === "markdown"
            ? compileMarkdown(project, selectedSheets, {
                transformSheetBody: (sheet) => rewriteSheetImageReferencesForBundle(sheet.body, libraryPath, project, sheet, bundle.assets),
              })
            : await compileHtml(project, selectedSheets, {
                transformSheetBody: (sheet) => rewriteSheetImageReferencesForBundle(sheet.body, libraryPath, project, sheet, bundle.assets),
              });
        savedPath = await saveProjectExportBundle(
          libraryPath,
          project,
          directoryName,
          [{ relativePath: filename, content: bundledContent }],
          bundle.assets,
        );
        savedFilename = directoryName;
        setSaveStatus(`已保存：${savedPath}，包含 ${bundle.assets.length} 张图片。`);
      } else {
        savedPath = await saveProjectExport(libraryPath, project, filename, content);
        setSaveStatus(`已保存：${savedPath}`);
      }
      const exportedAt = new Date().toISOString();
      const wordCount = selectedSheets.reduce((total, sheet) => total + countWords(sheet.body), 0);
      updateProject(project.id, (currentProject) => ({
        ...currentProject,
        updatedAt: nowTimestamp(),
        exportHistory: [
          {
            id: `export-${Date.now()}`,
            label,
            filename: savedFilename,
            path: savedPath,
            exportedAt,
            sheetCount: selectedSheets.length,
            wordCount,
            targetPlatform: label,
          },
          ...(currentProject.exportHistory ?? []),
        ].slice(0, MAX_EXPORT_HISTORY_ITEMS),
      }));
      onResourceChanged();
    } catch (error) {
      setSaveStatus(`保存失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function copyCompiledExport(content: string, label: string, contentReady = true) {
    if (selectedSheets.length === 0) return;
    if (!contentReady) {
      setSaveStatus(`${label} 还在生成中，请稍后再复制。`);
      return;
    }

    try {
      await copyTextToClipboard(content);
      setSaveStatus(`已复制 ${label} 到剪贴板。`);
    } catch (error) {
      setSaveStatus(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function openCompiledPrintPreview() {
    if (selectedSheets.length === 0) return;
    if (htmlBusy) {
      setSaveStatus("HTML 还在生成中，请稍后再打开打印预览。");
      return;
    }

    const opened = openPrintPreview(project?.title ?? "落笔导出", compiledHtml);
    setSaveStatus(opened ? "已打开打印/PDF 预览窗口。" : "打开失败：浏览器或系统阻止了弹出窗口。");
  }

  async function openExportHistoryItem(item: ExportHistoryItem) {
    setSaveStatus(`正在打开 ${item.filename}...`);
    try {
      await openLocalPath(item.path);
      setSaveStatus(`已打开：${item.filename}`);
    } catch (error) {
      setSaveStatus(`打开失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const exportPanelProps: ComponentProps<typeof ExportPanel> = {
    project: project as WritingProject,
    publishableSheets,
    selectedSheetIds,
    markdown,
    html: compiledHtml,
    htmlBusy,
    plainText,
    wechatHtml,
    xhsDraft,
    imageSummary,
    saveStatus,
    onToggleSheet: toggleSheet,
    onMoveSheet: moveSheet,
    onTogglePublishingChecklistItem: togglePublishingChecklistItem,
    onSelectAll: () => setSelectedSheetIds(allExportSheetIds(publishableSheets)),
    onSelectNone: () => setSelectedSheetIds([]),
    onCreatePublishVersion: createPublishVersionSheet,
    onDownloadMarkdown: () => downloadText(`${slugifyTitle(project?.title ?? "") || "loby-export"}.md`, markdown),
    onDownloadHtml: () =>
      downloadText(`${slugifyTitle(project?.title ?? "") || "loby-export"}.html`, compiledHtml, "text/html;charset=utf-8"),
    onDownloadPlainText: () => downloadText(`${slugifyTitle(project?.title ?? "") || "loby-export"}.txt`, plainText),
    onDownloadWechatHtml: () =>
      downloadText(`${slugifyTitle(project?.title ?? "") || "loby-export"}-wechat.html`, wechatHtml, "text/html;charset=utf-8"),
    onDownloadXhsDraft: () => downloadText(`${slugifyTitle(project?.title ?? "") || "loby-export"}-xhs.md`, xhsDraft),
    onSaveMarkdown: () => saveCompiledExportFile(".md", markdown, "Markdown", true, "markdown"),
    onSaveHtml: () => saveCompiledExportFile(".html", compiledHtml, "HTML", !htmlBusy, "html"),
    onSavePlainText: () => saveCompiledExportFile(".txt", plainText, "纯文本"),
    onSaveWechatHtml: () => saveCompiledExportFile("-wechat.html", wechatHtml, "公众号 HTML"),
    onSaveXhsDraft: () => saveCompiledExportFile("-xhs.md", xhsDraft, "小红书草稿"),
    onCopyMarkdown: () => copyCompiledExport(markdown, "Markdown"),
    onCopyHtml: () => copyCompiledExport(compiledHtml, "HTML", !htmlBusy),
    onCopyWechatHtml: () => copyCompiledExport(wechatHtml, "公众号 HTML"),
    onCopyXhsDraft: () => copyCompiledExport(xhsDraft, "小红书草稿"),
    onOpenPrintPreview: openCompiledPrintPreview,
  };

  return {
    exportPanelProps,
    openExportHistoryItem,
    removeSheetFromSelection,
  };
}
