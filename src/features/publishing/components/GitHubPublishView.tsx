/**
 * [INPUT]: 依赖 shadcn/ui、PublishDocumentSummary、共享发布打字机反馈与 GitHub 发布展示状态
 * [OUTPUT]: 对外提供 GitHubPublishState、GitHubPublishView
 * [POS]: publishing feature 的 GitHub 发布纯视图，在业务 Dialog 与设计系统之间共享确认、发布中、成功和错误状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Check, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CopyPublishLinkButton } from "@/features/publishing/components/CopyPublishLinkButton";
import { PublishDocumentSummary } from "@/features/publishing/components/PublishDocumentSummary";
import { PublishTypewriterLoader } from "@/features/publishing/components/PublishTypewriterLoader";

export type GitHubPublishState = "ready" | "publishing" | "success" | "error";

interface GitHubPublishViewProps {
  state: GitHubPublishState;
  title: string;
  targetName: string;
  slug: string;
  detail: string;
  draft: boolean;
  wasPublished: boolean;
  progress: number;
  progressLabel: string;
  errorMessage: string;
  resultUrl: string;
  commitSha: string;
  desktopAvailable: boolean;
  checkingGitHub: boolean;
  repositoryAuthorized: boolean;
  publishIdentityReady: boolean;
  configEnabled: boolean;
  onDraftChange: (draft: boolean) => void;
  onCancel: () => void;
  onPublish: () => void;
  onOpenSettings: () => void;
}

export function GitHubPublishView({
  state,
  title,
  targetName,
  slug,
  detail,
  draft,
  wasPublished,
  progress,
  progressLabel,
  errorMessage,
  resultUrl,
  commitSha,
  desktopAvailable,
  checkingGitHub,
  repositoryAuthorized,
  publishIdentityReady,
  configEnabled,
  onDraftChange,
  onCancel,
  onPublish,
  onOpenSettings,
}: GitHubPublishViewProps) {
  const validSlug = Boolean(slug.trim()) && !/[\\/]/.test(slug);

  return (
    <>
      {state === "ready" || state === "error" ? (
        <div key={state} className="direct-publish-body flex h-52 shrink-0 flex-col">
          <PublishDocumentSummary
            title={title}
            detail={detail}
            visibility={draft ? "private" : "public"}
            visibilityLabel="GitHub 发布可见范围"
            onVisibilityChange={(visibility) => onDraftChange(visibility === "private")}
          />
        </div>
      ) : state === "publishing" ? (
        <div
          key={state}
          className="direct-publish-body flex h-52 shrink-0 flex-col items-center justify-center px-0.5 pt-5 pb-1"
          role="status"
          aria-label={`${progressLabel}，${progress}%`}
        >
          <PublishTypewriterLoader />
          <div className="mt-8 w-full">
            <Progress value={progress} aria-label={progressLabel} />
            <p className="mt-2 text-center text-[11px] text-muted-foreground">{progressLabel}</p>
          </div>
        </div>
      ) : (
        <div
          key={state}
          className="direct-publish-body flex h-52 shrink-0 flex-col items-center justify-center px-6 pt-5 pb-1 text-center"
          role="status"
        >
          <span className="direct-publish-message-icon success grid size-11.5 place-items-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
            <Check size={24} strokeWidth={2.4} />
          </span>
          <h3 className="mt-3.5 text-base font-semibold">发布成功</h3>
          <p className="mt-1.5 max-w-100 truncate text-xs leading-5 text-muted-foreground" title={title}>
            《{title}》已发布到{targetName}。
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {progressLabel}
            {commitSha ? ` · GitHub 提交 ${commitSha.slice(0, 8)}` : ""}
          </p>
        </div>
      )}

      {!desktopAvailable && <p className="mt-3 text-[10px] text-destructive">请在落笔桌面应用中使用 GitHub 发布。</p>}
      {!checkingGitHub && !repositoryAuthorized && desktopAvailable && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-amber-500/10 px-3 py-2 text-[10px] text-amber-700 dark:text-amber-400">
          <span className="inline-flex items-center gap-1.5">
            <KeyRound size={13} />
            当前 GitHub 仓库尚未获得授权
          </span>
          <Button type="button" variant="outline" size="sm" onClick={onOpenSettings}>
            打开设置
          </Button>
        </div>
      )}
      {!publishIdentityReady && (
        <div className="mt-3 rounded-lg border border-border bg-muted/35 px-3 py-2 text-[10px] leading-5 text-muted-foreground">
          当前文稿仍使用旧 ID。请先在“设置 → 本地文件”中重建索引，再进行首次 GitHub 发布。
        </div>
      )}
      {state === "error" && (
        <p className="mt-3 rounded-lg bg-destructive/8 px-3 py-2 text-[10px] leading-5 text-destructive">{errorMessage}</p>
      )}
      <footer className="mt-4.5 flex min-h-9 justify-end gap-2">
        {state === "success" ? (
          <>
            <CopyPublishLinkButton url={resultUrl} />
            <Button type="button" onClick={onCancel}>
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
            <Button type="button" variant="outline" onClick={onCancel}>
              取消
            </Button>
            <Button
              type="button"
              disabled={
                !desktopAvailable || checkingGitHub || !repositoryAuthorized || !validSlug || !publishIdentityReady || !configEnabled
              }
              onClick={onPublish}
            >
              {wasPublished ? "更新" : "发布"}
            </Button>
          </>
        )}
      </footer>
    </>
  );
}
