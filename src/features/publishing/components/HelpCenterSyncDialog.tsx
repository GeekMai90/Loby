/**
 * [INPUT]: 依赖 shadcn 对话框、HelpCenterSyncView、项目发布绑定、应用级 GitHub 文档站目标与 native 同步 API
 * [OUTPUT]: 对外提供 HelpCenterSyncDialog，承载已绑定目标的单篇/整项目确认、两阶段同步、结果链接与错误恢复
 * [POS]: publishing feature 的文档站同步控制器；项目设置负责绑定，纯视图复用墨问发布的固定几何、打字机与进度反馈
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { HelpCenterSyncView, type HelpCenterSyncState } from "@/features/publishing/components/HelpCenterSyncView";
import {
  helpCenterPublicationsFromResult,
  normalizeProjectPublishingBinding,
  prepareHelpCenterSyncInput,
  validateProjectDocsBinding,
} from "@/features/publishing/model/helpCenter";
import { isDesktopPublishingAvailable, syncHelpCenter, type HelpCenterSyncResult } from "@/features/publishing/model/api";
import { githubErrorNeedsSettings } from "@/features/publishing/model/githubErrors";
import { helpCenterProgressPresentation } from "@/features/publishing/model/progress";
import type { GitHubDocsPublishingTarget } from "@/features/publishing/model/publishingTargets";
import type { WritingProject } from "@/shared/types";

interface HelpCenterSyncDialogProps {
  open: boolean;
  libraryPath: string;
  project: WritingProject;
  target: GitHubDocsPublishingTarget;
  sheetId?: string;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
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
  const wasSynced = savedPublication?.targetKind === target.kind;
  const validationError = validateProjectDocsBinding(binding, target);
  const enabledGroupCount = binding.groupMappings.filter((mapping) => mapping.enabled).length;
  const mode = sheetId ? "document" : "project";
  const busy = state === "syncing";
  const title = selectedSheet?.title || project.title;
  const detail = selectedSheet ? `${target.repository} · ${target.branch}` : `${enabledGroupCount} 个已启用分组 · ${target.repository}`;
  const documentUrl = sheetId ? result?.documents.find((document) => document.sourceId === sheetId)?.url || "" : "";

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
      onProjectChange(nextProject);
      const request = prepareHelpCenterSyncInput(libraryPath, nextProject, target, sheetId, deleteMissing);
      const response = await syncHelpCenter(request, (event) => {
        const presentation = helpCenterProgressPresentation(event);
        setProgress(presentation.value);
        setProgressLabel(presentation.label);
      });
      const publications = helpCenterPublicationsFromResult(target, response);
      onProjectChange({
        ...nextProject,
        sheets: nextProject.sheets.map((sheet) => {
          const publication = publications.get(sheet.id);
          return publication ? { ...sheet, publications: { ...sheet.publications, [target.id]: publication } } : sheet;
        }),
      });
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
            <DialogTitle className="text-lg">{sheetId ? `同步到${target.siteName}` : `同步整个项目到${target.siteName}`}</DialogTitle>
            <DialogDescription className="sr-only">确认同步范围后提交到项目绑定的 GitHub 文档站。</DialogDescription>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" disabled={busy} onClick={() => onOpenChange(false)} title="关闭">
            <X />
          </Button>
        </header>

        <HelpCenterSyncView
          state={state}
          mode={mode}
          title={title}
          targetName={target.siteName}
          detail={detail}
          siteUrl={target.siteUrl}
          documentUrl={documentUrl}
          wasSynced={wasSynced}
          deleteMissing={deleteMissing}
          progress={progress}
          progressLabel={progressLabel}
          errorMessage={errorMessage}
          errorNeedsSettings={Boolean(validationError) || githubErrorNeedsSettings(errorMessage)}
          result={result}
          configReady={!validationError}
          onDeleteMissingChange={setDeleteMissing}
          onCancel={() => onOpenChange(false)}
          onSync={() => void synchronize()}
          onOpenSettings={openSettings}
        />
      </DialogContent>
    </Dialog>
  );
}
