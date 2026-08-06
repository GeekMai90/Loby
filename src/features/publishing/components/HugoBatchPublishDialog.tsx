/**
 * [INPUT]: 依赖 shadcn 对话框/按钮/进度、Hugo 批量 payload、native GitHub batch command 与项目博客发布记录
 * [OUTPUT]: 对外提供 HugoBatchPublishDialog，承载项目博客目标的批量确认、单次提交进度与按 target ID 回写
 * [POS]: publishing feature 的 Hugo 项目批量控制器；目标选择由项目的单一发布目标绑定负责
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Check, CircleAlert, ExternalLink, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { PublishTypewriterLoader } from "@/features/publishing/components/PublishTypewriterLoader";
import { githubErrorNeedsSettings } from "@/features/publishing/model/githubErrors";
import {
  isDesktopPublishingAvailable,
  publishBlogPosts,
  type BlogPublishBatchInput,
  type BlogPublishBatchResult,
} from "@/features/publishing/model/api";
import { prepareBlogPublishBatchInput } from "@/features/publishing/model/blogPayload";
import { githubProgressPresentation } from "@/features/publishing/model/progress";
import type { GitHubBlogPublishingTarget } from "@/features/publishing/model/publishingTargets";
import { nowTimestamp } from "@/shared/lib/dates";
import type { GitHubPublishingTargetPublication, WritingProject } from "@/shared/types";

type HugoBatchState = "ready" | "publishing" | "success" | "error";

interface HugoBatchPublishDialogProps {
  open: boolean;
  libraryPath: string;
  project: WritingProject;
  target: GitHubBlogPublishingTarget;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
  onProjectChange: (project: WritingProject) => void;
}

export function HugoBatchPublishDialog({
  open,
  libraryPath,
  project,
  target,
  onOpenChange,
  onOpenSettings,
  onProjectChange,
}: HugoBatchPublishDialogProps) {
  const [state, setState] = useState<HugoBatchState>("ready");
  const [progress, setProgress] = useState(8);
  const [progressLabel, setProgressLabel] = useState("正在检查 GitHub 连接与仓库权限…");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<BlogPublishBatchResult | null>(null);
  const desktopAvailable = isDesktopPublishingAvailable();
  const targetName = target.blogName.trim() || "GitHub 博客";
  const busy = state === "publishing";
  let input: BlogPublishBatchInput | null = null;
  let preparationError = "";
  try {
    input = prepareBlogPublishBatchInput(libraryPath, project, target);
  } catch (cause) {
    preparationError = cause instanceof Error ? cause.message : String(cause);
  }
  const documentCount = input?.documents.length ?? 0;

  useEffect(() => {
    if (!open) return;
    setState("ready");
    setProgress(8);
    setProgressLabel("正在检查 GitHub 连接与仓库权限…");
    setErrorMessage("");
    setResult(null);
  }, [open, target.id]);

  async function publish() {
    if (!input) {
      setErrorMessage(preparationError || "当前项目没有可发布的文稿。");
      setState("error");
      return;
    }
    setState("publishing");
    setProgress(8);
    setProgressLabel("正在检查 GitHub 连接与仓库权限…");
    setErrorMessage("");
    setResult(null);
    try {
      const response = await publishBlogPosts(input, (event) => {
        const presentation =
          event.stage === "packaging"
            ? {
                value: event.total > 0 ? Math.round(24 + (event.completed / event.total) * 52) : 32,
                label: `正在整理项目文稿 ${Math.min(event.completed + 1, event.total)}/${event.total}…`,
              }
            : githubProgressPresentation(event);
        setProgress(presentation.value);
        setProgressLabel(presentation.label);
      });
      const publishedAt = nowTimestamp();
      const publicationsBySourceId = new Map(
        response.documents.map((document) => [
          document.sourceId,
          {
            targetKind: target.kind,
            sourceId: document.sourceId,
            slug: document.slug,
            url: document.url,
            lastCommitSha: document.commitSha,
            lastPublishedAt: publishedAt,
            sourceHash: document.sourceHash,
            draft: document.draft,
          } satisfies GitHubPublishingTargetPublication,
        ]),
      );
      onProjectChange({
        ...project,
        sheets: project.sheets.map((sheet) => {
          const publication = [sheet.id, sheet.publications?.[target.id]?.sourceId]
            .map((sourceId) => (sourceId ? publicationsBySourceId.get(sourceId) : undefined))
            .find((item) => Boolean(item));
          return publication ? { ...sheet, publications: { ...sheet.publications, [target.id]: publication } } : sheet;
        }),
      });
      setResult(response);
      setProgress(100);
      setProgressLabel(response.changed ? "项目文章已提交" : "发布内容没有变化");
      setState("success");
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : String(cause));
      setState("error");
    }
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
            <DialogTitle>批量发布到{targetName}</DialogTitle>
            <DialogDescription className="sr-only">将当前项目的全部未归档文稿一次性提交到默认 Hugo 博客目标。</DialogDescription>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" disabled={busy} onClick={() => onOpenChange(false)} title="关闭">
            <X />
          </Button>
        </header>

        <div key={state} className="direct-publish-body flex h-52 shrink-0 flex-col">
          {state === "ready" ? (
            <div className="mt-6">
              <strong className="block truncate text-base">{project.title}</strong>
              <small className="mt-1 block truncate text-[11px] text-muted-foreground">
                {documentCount} 篇未归档文稿 · {target.repository || "尚未配置 GitHub 仓库"} · {target.branch || "main"}
              </small>
              <div className="mt-4 divide-y divide-border/50 border-t border-border/70">
                <div className="flex min-h-9 items-center justify-between gap-6 py-2 text-[13px]">
                  <span className="font-medium">发布范围</span>
                  <span className="text-right text-muted-foreground">全部未归档文稿</span>
                </div>
                <div className="flex min-h-9 items-center justify-between gap-6 py-2 text-[13px]">
                  <span className="font-medium">提交方式</span>
                  <span className="text-right text-muted-foreground">一次 GitHub 提交</span>
                </div>
              </div>
              {preparationError ? <p className="mt-3 text-xs text-destructive">{preparationError}</p> : null}
            </div>
          ) : state === "publishing" ? (
            <div className="flex h-full flex-col items-center justify-center px-0.5 pt-5 pb-1" role="status">
              <PublishTypewriterLoader />
              <div className="mt-8 w-full">
                <Progress value={progress} aria-label={progressLabel} />
                <p className="mt-2 text-center text-[11px] text-muted-foreground">{progressLabel}</p>
              </div>
            </div>
          ) : state === "success" ? (
            <div className="flex h-full flex-col items-center justify-center px-6 pt-5 pb-1 text-center" role="status">
              <span className="grid size-11.5 place-items-center rounded-full bg-status-success text-status-success-foreground shadow-lg shadow-status-success/20">
                <Check size={24} strokeWidth={2.4} />
              </span>
              <h3 className="mt-3.5 text-base font-semibold">批量发布成功</h3>
              <p className="mt-1.5 max-w-100 truncate text-xs text-muted-foreground">
                已将 {result?.publishedCount ?? documentCount} 篇文稿提交到{targetName}。
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {result?.changed ? "GitHub 提交已创建" : "远端内容已经是最新版本"}
                {result?.commitSha ? ` · ${result.commitSha.slice(0, 8)}` : ""}
              </p>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 pt-5 pb-1 text-center" role="alert">
              <span className="grid size-11.5 place-items-center rounded-full bg-destructive/10 text-destructive">
                <CircleAlert size={22} />
              </span>
              <h3 className="mt-3.5 text-base font-semibold">
                {githubErrorNeedsSettings(errorMessage) ? "需要完成 GitHub 设置" : "批量发布失败"}
              </h3>
              <p className="mt-1.5 max-w-100 text-xs leading-5 text-muted-foreground">{errorMessage || "暂时无法发布，请稍后重试。"}</p>
            </div>
          )}
        </div>

        {!desktopAvailable ? <p className="mt-3 text-[10px] text-destructive">请在落笔桌面应用中使用 GitHub 批量发布。</p> : null}
        <footer className="mt-4.5 flex min-h-9 justify-end gap-2">
          {state === "success" ? (
            <>
              <Button type="button" variant="outline" asChild>
                <a href={target.siteUrl} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden="true" />
                  打开网站
                </a>
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>
                完成
              </Button>
            </>
          ) : state === "publishing" ? (
            <>
              <Button type="button" variant="outline" disabled>
                取消
              </Button>
              <Button type="button" disabled>
                发布中…
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button
                type="button"
                disabled={!desktopAvailable || !input || !target.enabled}
                onClick={state === "error" && githubErrorNeedsSettings(errorMessage) ? onOpenSettings : () => void publish()}
              >
                {state === "error" ? (githubErrorNeedsSettings(errorMessage) ? "前往设置" : "重试") : "发布"}
              </Button>
            </>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
