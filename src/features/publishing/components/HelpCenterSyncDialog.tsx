/**
 * [INPUT]: 依赖 shadcn 对话框、HelpCenterSyncView、文稿图片/分组元数据、项目发布绑定、应用级 GitHub 文档站目标与 native 同步 API
 * [OUTPUT]: 对外提供 HelpCenterSyncDialog，承载已绑定目标的单篇同步、项目增量发布、发布前摘要补全、安全远端清理、结果链接与错误恢复
 * [POS]: publishing feature 的文档站同步控制器；项目设置负责绑定，摘要预检归共享发布模型，纯视图复用墨问发布的固定几何、打字机与进度反馈
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { HelpCenterSyncView, type HelpCenterSyncState } from "@/features/publishing/components/HelpCenterSyncView";
import { parseImageReferences } from "@/features/library/model/imageAssets";
import { DEFAULT_USER_GROUP_ID } from "@/features/library/model/projectModel";
import {
  applyHelpCenterSyncResult,
  helpCenterDocumentSyncState,
  normalizeProjectPublishingBinding,
  prepareHelpCenterSyncInput,
  validateProjectDocsBinding,
} from "@/features/publishing/model/helpCenter";
import { isDesktopPublishingAvailable, syncHelpCenter, type HelpCenterSyncResult } from "@/features/publishing/model/api";
import { githubErrorNeedsSettings } from "@/features/publishing/model/githubErrors";
import { helpCenterProgressPresentation } from "@/features/publishing/model/progress";
import { ensureProjectDocumentSummaries } from "@/features/publishing/model/summaryPreflight";
import type { GitHubDocsPublishingTarget } from "@/features/publishing/model/publishingTargets";
import { formatDateTime } from "@/shared/lib/formatters";
import type { DocumentSummaryGenerator, WritingProject, WritingSheet } from "@/shared/types";

interface HelpCenterSyncDialogProps {
  open: boolean;
  libraryPath: string;
  project: WritingProject;
  target: GitHubDocsPublishingTarget;
  sheetId?: string;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
  onGenerateSummary?: DocumentSummaryGenerator;
  onProjectChange: (project: WritingProject) => void;
}

export function HelpCenterSyncDialog({
  open,
  libraryPath,
  project,
  target,
  sheetId,
  onOpenChange,
  onOpenSettings,
  onGenerateSummary,
  onProjectChange,
}: HelpCenterSyncDialogProps) {
  const [state, setState] = useState<HelpCenterSyncState>("ready");
  const [deleteMissing, setDeleteMissing] = useState(false);
  const [progress, setProgress] = useState(8);
  const [progressLabel, setProgressLabel] = useState("正在检查 GitHub 连接与仓库权限…");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<HelpCenterSyncResult | null>(null);
  const binding = normalizeProjectPublishingBinding(project, target);
  const selectedSheet = sheetId ? project.sheets.find((sheet) => sheet.id === sheetId) : undefined;
  const savedPublication = selectedSheet?.publications?.[target.id];
  const documentSyncState = selectedSheet ? helpCenterDocumentSyncState(libraryPath, project, selectedSheet, target) : "unpublished";
  const validationError = validateProjectDocsBinding(binding, target);
  const enabledGroupCount = binding.groupMappings.filter((mapping) => mapping.enabled).length;
  const enabledGroupIds = new Set(binding.groupMappings.filter((mapping) => mapping.enabled).map((mapping) => mapping.groupId));
  const publishableSheetCount = project.sheets.filter(
    (sheet) => !sheet.archivedAt && enabledGroupIds.has(sheet.groupId || DEFAULT_USER_GROUP_ID),
  ).length;
  const mode = sheetId ? "document" : "project";
  const busy = state === "syncing";
  const title = selectedSheet?.title || project.title;
  const imageCount = selectedSheet ? parseImageReferences(selectedSheet.body).length : 0;
  const detail = selectedSheet
    ? `${selectedSheet.body.length} 个字符 · ${imageCount} 张图片`
    : `${publishableSheetCount} 篇文稿 · ${enabledGroupCount} 个已启用目录`;
  const publishingDirectory = binding.groupMappings.find(
    (mapping) => mapping.groupId === (selectedSheet?.groupId || DEFAULT_USER_GROUP_ID),
  )?.directory;
  const summaryRows = selectedSheet
    ? [
        { label: "GitHub 仓库", value: `${target.repository} · ${target.branch}` },
        { label: "发布目录", value: publishingDirectory || "尚未配置" },
        {
          label: "同步状态",
          value:
            documentSyncState === "unpublished" || !savedPublication
              ? "尚未同步"
              : documentSyncState === "current"
                ? `已是最新 · ${formatDateTime(savedPublication.lastPublishedAt)}`
                : `有修改 · 上次同步 ${formatDateTime(savedPublication.lastPublishedAt)}`,
        },
      ]
    : [
        { label: "GitHub 仓库", value: `${target.repository} · ${target.branch}` },
        { label: "发布范围", value: "当前项目的全部可发布文稿" },
        { label: "同步方式", value: "新增文稿并更新已有文稿" },
      ];
  const documentUrl = sheetId ? result?.documents.find((document) => document.sourceId === sheetId)?.url || "" : "";
  const actionLabel = selectedSheet
    ? documentSyncState === "current"
      ? "已同步"
      : documentSyncState === "modified"
        ? "更新"
        : "同步"
    : "发布";

  useEffect(() => {
    if (!open) return;
    setState("ready");
    setDeleteMissing(false);
    setProgress(8);
    setProgressLabel("正在检查 GitHub 连接与仓库权限…");
    setErrorMessage("");
    setResult(null);
  }, [open, sheetId, target.id]);

  async function synchronize() {
    if (!isDesktopPublishingAvailable()) {
      setErrorMessage("请在落笔桌面应用中完成 GitHub 同步。");
      setState("error");
      return;
    }
    if (validationError) {
      setErrorMessage(validationError);
      setState("error");
      return;
    }
    setState("syncing");
    setProgress(8);
    setProgressLabel("正在检查 GitHub 连接与仓库权限…");
    setErrorMessage("");
    setResult(null);
    try {
      const nextProject = { ...project, publishingBinding: binding };
      const shouldEnsureSummary = (sheet: WritingSheet) =>
        !sheet.archivedAt && (!sheetId || sheet.id === sheetId) && enabledGroupIds.has(sheet.groupId || DEFAULT_USER_GROUP_ID);
      if (onGenerateSummary && nextProject.sheets.some((sheet) => shouldEnsureSummary(sheet) && !sheet.description.trim())) {
        setProgressLabel("正在生成摘要…");
      }
      const projectWithSummaries = await ensureProjectDocumentSummaries(nextProject, onGenerateSummary, shouldEnsureSummary);
      onProjectChange(projectWithSummaries);
      const request = prepareHelpCenterSyncInput(libraryPath, projectWithSummaries, target, {
        sheetId,
        deleteMissing,
      });
      const response = await syncHelpCenter(request, (event) => {
        const presentation = helpCenterProgressPresentation(event);
        setProgress(presentation.value);
        setProgressLabel(presentation.label);
      });
      onProjectChange(applyHelpCenterSyncResult(libraryPath, projectWithSummaries, target, response));
      setResult(response);
      setProgress(100);
      setProgressLabel("GitHub 提交完成");
      setState("success");
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : String(cause));
      setState("error");
    }
  }

  function openSettings() {
    onOpenChange(false);
    onOpenSettings();
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && !busy && onOpenChange(false)}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[min(520px,calc(100vw-48px))] gap-0 p-5 sm:max-w-[min(520px,calc(100vw-48px))]"
        onEscapeKeyDown={(event) => busy && event.preventDefault()}
        onPointerDownOutside={(event) => busy && event.preventDefault()}
      >
        <header className="flex min-h-8 items-center gap-3">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg">{sheetId ? `同步到${target.siteName}` : `发布到${target.siteName}`}</DialogTitle>
            <DialogDescription className="sr-only">
              {sheetId ? "确认当前文稿后提交到项目绑定的 GitHub 文档站。" : "检查当前项目并增量同步到绑定的 GitHub 文档站。"}
            </DialogDescription>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" disabled={busy} onClick={() => onOpenChange(false)} title="关闭">
            <X />
          </Button>
        </header>

        <HelpCenterSyncView
          state={state}
          mode={mode}
          operation={mode === "project" ? "publish" : "sync"}
          title={title}
          targetName={target.siteName}
          detail={detail}
          summaryRows={summaryRows}
          siteUrl={target.siteUrl}
          documentUrl={documentUrl}
          deleteMissing={deleteMissing}
          progress={progress}
          progressLabel={progressLabel}
          errorMessage={errorMessage}
          errorNeedsSettings={Boolean(validationError) || githubErrorNeedsSettings(errorMessage)}
          result={result}
          configReady={
            !validationError && (mode === "document" ? documentSyncState !== "current" : publishableSheetCount > 0 || deleteMissing)
          }
          actionLabel={actionLabel}
          showDeleteMissing={mode === "project"}
          onDeleteMissingChange={setDeleteMissing}
          onCancel={() => onOpenChange(false)}
          onSync={() => void synchronize()}
          onOpenSettings={openSettings}
        />
      </DialogContent>
    </Dialog>
  );
}
