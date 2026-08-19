/**
 * [INPUT]: 依赖 React、editor 实时文稿物化、library 手动版本模型与立即持久化能力、shared 设置/日期/Toast 契约
 * [OUTPUT]: 对外提供 useManualDocumentSave，协调保存基线、并发门禁、可选中文排版、历史版本生成、项目写回与用户反馈
 * [POS]: app 组合层的主动保存协调边界；连接 editor 与 library 但不接管自动保存队列或领域版本规则
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useCallback, useEffect, useRef } from "react";
import { createManualSaveVersion, manualSaveNeedsVersion, resolveManualSaveBaseline } from "@/features/library/model/sheetVersions";
import { showAppToast } from "@/shared/lib/appToast";
import { nowTimestamp, today } from "@/shared/lib/dates";
import type { MarkdownFormattingSettings, WritingProject, WritingSheet } from "@/shared/types";

const MANUAL_SAVE_TOAST_ID = "manual-document-save";

interface UseManualDocumentSaveOptions {
  persistenceReady: boolean;
  libraryPath: string;
  projects: WritingProject[];
  project: WritingProject | undefined;
  sheet: WritingSheet | undefined;
  blocked: boolean;
  markdownFormatting: MarkdownFormattingSettings;
  materializeLatestSheet: (sheet: WritingSheet) => WritingSheet;
  onProjectsChange: (projects: WritingProject[]) => void;
  flushPendingSave: () => Promise<void>;
  persistDocumentImmediately: (project: WritingProject, sheet: WritingSheet, projects: WritingProject[]) => Promise<void>;
  onLibraryStatusChange: (status: string) => void;
}

export function useManualDocumentSave({
  persistenceReady,
  libraryPath,
  projects,
  project,
  sheet,
  blocked,
  markdownFormatting,
  materializeLatestSheet,
  onProjectsChange,
  flushPendingSave,
  persistDocumentImmediately,
  onLibraryStatusChange,
}: UseManualDocumentSaveOptions) {
  const baselinesRef = useRef(new Map<string, string>());
  const libraryPathRef = useRef("");
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    if (!persistenceReady || !libraryPath || !sheet) return;
    if (libraryPathRef.current !== libraryPath) {
      libraryPathRef.current = libraryPath;
      baselinesRef.current.clear();
    }
    if (!baselinesRef.current.has(sheet.id)) {
      baselinesRef.current.set(sheet.id, resolveManualSaveBaseline(sheet));
    }
  }, [libraryPath, persistenceReady, sheet]);

  const saveActiveDocument = useCallback(async () => {
    if (!project || !sheet || blocked || saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    try {
      const formatter = markdownFormatting.formatOnSave
        ? (await import("@/features/editor/model/markdownFormatting")).formatMarkdownDocument
        : null;
      const liveBody = materializeLatestSheet(sheet).body;
      const baseline = baselinesRef.current.get(sheet.id) ?? resolveManualSaveBaseline(sheet);
      const savedBody = formatter ? formatter(liveBody, markdownFormatting) : liveBody;
      if (!manualSaveNeedsVersion(baseline, liveBody, savedBody)) {
        await flushPendingSave();
        onLibraryStatusChange("当前文稿没有需要保存的修改");
        showAppToast({
          variant: "info",
          title: "无需保存",
          description: "当前文稿没有修改",
          id: MANUAL_SAVE_TOAST_ID,
        });
        return;
      }

      const savedSheet = createManualSaveVersion(sheet, savedBody, nowTimestamp());
      const nextProjects = projects.map((currentProject) =>
        currentProject.id === project.id
          ? {
              ...currentProject,
              updatedAt: today(),
              sheets: currentProject.sheets.map((currentSheet) => (currentSheet.id === sheet.id ? savedSheet : currentSheet)),
            }
          : currentProject,
      );

      onProjectsChange(nextProjects);
      await persistDocumentImmediately(project, savedSheet, nextProjects);
      baselinesRef.current.set(sheet.id, savedBody);
      const formattedOnSave = formatter !== null && savedBody !== liveBody;
      onLibraryStatusChange(formattedOnSave ? "已优化中文排版、保存文稿并生成历史版本" : "已保存文稿并生成历史版本");
      showAppToast({
        variant: "success",
        title: formattedOnSave ? "排版并保存完成" : "保存完成",
        description: formattedOnSave ? "已优化中文排版并生成历史版本" : "已生成历史版本",
        id: MANUAL_SAVE_TOAST_ID,
      });
    } catch {
      onLibraryStatusChange("当前文稿保存失败");
      showAppToast({
        variant: "error",
        title: "保存失败",
        description: "请稍后重试",
        id: MANUAL_SAVE_TOAST_ID,
      });
    } finally {
      saveInFlightRef.current = false;
    }
  }, [
    blocked,
    flushPendingSave,
    markdownFormatting,
    materializeLatestSheet,
    onLibraryStatusChange,
    onProjectsChange,
    persistDocumentImmediately,
    project,
    projects,
    sheet,
  ]);

  return { saveActiveDocument };
}
