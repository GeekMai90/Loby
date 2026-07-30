/**
 * [INPUT]: 依赖 shadcn 对话框、项目发布绑定、应用级 GitHub 文档站目标与 native 同步 API
 * [OUTPUT]: 对外提供 HelpCenterSyncDialog，承载已绑定目标的单篇/整项目同步确认与进度
 * [POS]: publishing feature 的文档站执行边界；项目设置负责绑定和分组映射，本组件不再复制仓库配置表单
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useState } from "react";
import { ExternalLink, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  helpCenterPublicationsFromResult,
  normalizeProjectPublishingBinding,
  prepareHelpCenterSyncInput,
  validateProjectDocsBinding,
} from "@/features/publishing/model/helpCenter";
import { syncHelpCenter, type HelpCenterSyncProgress } from "@/features/publishing/model/api";
import type { GitHubDocsPublishingTarget } from "@/features/publishing/model/publishingTargets";
import type { WritingProject } from "@/shared/types";

interface HelpCenterSyncDialogProps {
  open: boolean;
  libraryPath: string;
  project: WritingProject;
  target: GitHubDocsPublishingTarget;
  sheetId?: string;
  onOpenChange: (open: boolean) => void;
  onProjectChange: (project: WritingProject) => void;
}

export function HelpCenterSyncDialog({
  open,
  libraryPath,
  project,
  target,
  sheetId,
  onOpenChange,
  onProjectChange,
}: HelpCenterSyncDialogProps) {
  const [busy, setBusy] = useState(false);
  const [deleteMissing, setDeleteMissing] = useState(false);
  const [status, setStatus] = useState("");
  const binding = normalizeProjectPublishingBinding(project, target);
  const selectedSheet = sheetId ? project.sheets.find((sheet) => sheet.id === sheetId) : undefined;
  const validationError = validateProjectDocsBinding(binding, target);
  const enabledGroupCount = binding.groupMappings.filter((mapping) => mapping.enabled).length;

  async function synchronize() {
    if (validationError) {
      setStatus(validationError);
      return;
    }
    setBusy(true);
    setStatus("正在准备同步…");
    try {
      const nextProject = { ...project, publishingBinding: binding };
      onProjectChange(nextProject);
      const request = prepareHelpCenterSyncInput(libraryPath, nextProject, target, sheetId, deleteMissing);
      const result = await syncHelpCenter(request, (progress) => setStatus(progressLabel(progress)));
      const publications = helpCenterPublicationsFromResult(target, result);
      onProjectChange({
        ...nextProject,
        sheets: nextProject.sheets.map((sheet) => {
          const publication = publications.get(sheet.id);
          return publication ? { ...sheet, publications: { ...sheet.publications, [target.id]: publication } } : sheet;
        }),
      });
      const cleanup = result.deletedCount ? `，清理 ${result.deletedCount} 篇远端文稿` : "";
      setStatus(
        result.changed
          ? `已同步 ${result.syncedCount} 篇文稿${cleanup}，GitHub 提交 ${result.commitSha.slice(0, 8)}`
          : "远端内容已经是最新版本",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-135">
        <DialogHeader>
          <DialogTitle>{sheetId ? `同步到${target.siteName}` : `同步整个项目到${target.siteName}`}</DialogTitle>
          <DialogDescription>
            {sheetId && selectedSheet
              ? `将「${selectedSheet.title}」提交到项目绑定的 GitHub 文档仓库。`
              : `将 ${enabledGroupCount} 个已启用分组中的文稿批量提交到 GitHub。`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-border bg-muted/35 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
            <p className="m-0 font-medium text-foreground">{target.repository}</p>
            <p className="m-0">
              {target.branch} · {target.contentRoot}
            </p>
          </div>

          {!sheetId ? (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
              <div>
                <p className="m-0 text-sm font-medium">清理远端缺失文稿</p>
                <p className="mt-0.5 mb-0 text-xs text-muted-foreground">仅删除这个项目曾经声明、但现在已不在同步范围内的文稿。</p>
              </div>
              <Switch checked={deleteMissing} onCheckedChange={setDeleteMissing} aria-label="清理远端缺失文稿" />
            </div>
          ) : null}

          {status ? (
            <p className="m-0 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground" role="status">
              {status}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" asChild>
            <a href={target.siteUrl} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden="true" />
              打开网站
            </a>
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" disabled={busy || Boolean(validationError)} onClick={() => void synchronize()}>
            {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            {sheetId ? "同步这篇文稿" : "同步整个项目"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function progressLabel(progress: HelpCenterSyncProgress): string {
  switch (progress.stage) {
    case "checkingAuthorization":
      return "正在检查 GitHub 连接与仓库权限…";
    case "preparing":
      return "正在读取远端同步清单…";
    case "packaging":
      return progress.total ? `正在整理文稿与图片 ${progress.completed}/${progress.total}…` : "正在整理文稿…";
    case "committing":
      return "正在创建 GitHub 原子提交…";
    case "finished":
      return "GitHub 已提交，等待网站自动部署…";
  }
}
