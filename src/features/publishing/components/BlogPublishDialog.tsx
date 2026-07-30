/**
 * [INPUT]: 依赖 shadcn/ui、GitHubPublishView、应用级 GitHub 博客目标、发布 API/blogPayload、GitHub 错误分流、shared 写作契约与日期工具
 * [OUTPUT]: 对外提供 BlogPublishDialog，承载 GitHub 确认、发布时权限预检、实时进度与可恢复结果
 * [POS]: publishing feature 的应用级 GitHub 目标发布界面，项目只提供文稿资源路径上下文，凭证与权威权限检查归 native 发布命令
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GitHubPublishView, type GitHubPublishState } from "@/features/publishing/components/GitHubPublishView";
import { createBlogSlug, prepareBlogPublishInput } from "@/features/publishing/model/blogPayload";
import { isDesktopPublishingAvailable, publishBlogPost } from "@/features/publishing/model/api";
import { githubErrorNeedsSettings } from "@/features/publishing/model/githubErrors";
import { githubProgressPresentation } from "@/features/publishing/model/progress";
import type { GitHubBlogPublishingTarget } from "@/features/publishing/model/publishingTargets";
import { nowTimestamp } from "@/shared/lib/dates";
import type { GitHubPublishingTargetPublication, PublishingTargetPublication, WritingProject, WritingSheet } from "@/shared/types";
import { isCanonicalSheetId } from "@/features/library/model/documentId";

interface BlogPublishDialogProps {
  open: boolean;
  project: WritingProject;
  sheet: WritingSheet;
  target: GitHubBlogPublishingTarget;
  libraryPath: string;
  onClose: () => void;
  onOpenSettings: () => void;
  onPublished: (targetId: string, publication: PublishingTargetPublication) => void;
}

export function BlogPublishDialog({
  open,
  project,
  sheet,
  target,
  libraryPath,
  onClose,
  onOpenSettings,
  onPublished,
}: BlogPublishDialogProps) {
  const desktopAvailable = isDesktopPublishingAvailable();
  const savedPublication = sheet.publications?.[target.id];
  const publication = savedPublication?.targetKind === target.kind ? savedPublication : undefined;
  const [slug, setSlug] = useState(() => publication?.slug || createBlogSlug(sheet.title, sheet.id));
  const [draft, setDraft] = useState(publication?.draft ?? false);
  const [state, setState] = useState<GitHubPublishState>("ready");
  const [progressValue, setProgressValue] = useState(8);
  const [progressLabel, setProgressLabel] = useState("正在检查 GitHub 连接与仓库权限…");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<GitHubPublishingTargetPublication | null>(null);
  const previousOpenRef = useRef(open);

  useEffect(() => {
    const opening = open && !previousOpenRef.current;
    previousOpenRef.current = open;
    if (!opening) return;
    setSlug(publication?.slug || createBlogSlug(sheet.title, sheet.id));
    setDraft(publication?.draft ?? false);
    setState("ready");
    setProgressValue(8);
    setProgressLabel("正在检查 GitHub 连接与仓库权限…");
    setErrorMessage("");
    setResult(null);
  }, [open, publication, sheet.id, sheet.title]);

  const publishTargetName = target.blogName.trim() || "GitHub 博客";
  const busy = state === "publishing";
  const publishIdentityReady = Boolean(publication?.slug) || isCanonicalSheetId(sheet.id);

  async function publish() {
    setState("publishing");
    setProgressValue(8);
    setProgressLabel("正在检查 GitHub 连接与仓库权限…");
    setErrorMessage("");
    setResult(null);
    try {
      const request = prepareBlogPublishInput(libraryPath, project, sheet, target, { slug, draft });
      const response = await publishBlogPost(request, (event) => {
        const presentation = githubProgressPresentation(event);
        setProgressValue(presentation.value);
        setProgressLabel(presentation.label);
      });
      const nextPublication: GitHubPublishingTargetPublication = {
        targetKind: target.kind,
        sourceId: request.sourceId,
        slug: response.slug,
        url: response.url,
        lastCommitSha: response.commitSha,
        lastPublishedAt: nowTimestamp(),
        sourceHash: response.sourceHash,
        draft: response.draft,
      };
      setSlug(response.slug);
      setResult(nextPublication);
      setProgressValue(100);
      setState("success");
      setProgressLabel(response.changed ? (response.draft ? "私密版本已提交" : "文章已提交，Cloudflare 正在部署") : "发布内容没有变化");
      onPublished(target.id, nextPublication);
    } catch (cause) {
      setState("error");
      setErrorMessage(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && !busy && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[min(520px,calc(100vw-48px))] gap-0 p-5 sm:max-w-[min(520px,calc(100vw-48px))]"
        onEscapeKeyDown={(event) => busy && event.preventDefault()}
        onPointerDownOutside={(event) => busy && event.preventDefault()}
      >
        <header className="flex min-h-8 items-center gap-3">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg">发布到{publishTargetName}</DialogTitle>
            <DialogDescription className="sr-only">确认文章信息与可见范围后提交到应用设置中的 GitHub 发布目标。</DialogDescription>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" disabled={busy} onClick={onClose} title="关闭">
            <X />
          </Button>
        </header>

        <GitHubPublishView
          state={state}
          title={sheet.title}
          targetName={publishTargetName}
          slug={slug}
          detail={`${target.repository || "尚未配置 GitHub 仓库"} · ${target.branch || "main"}`}
          draft={draft}
          wasPublished={Boolean(publication)}
          progress={progressValue}
          progressLabel={progressLabel}
          errorMessage={errorMessage}
          resultUrl={result?.url || ""}
          commitSha={result?.lastCommitSha || ""}
          desktopAvailable={desktopAvailable}
          publishIdentityReady={publishIdentityReady}
          configEnabled={target.enabled}
          errorNeedsSettings={githubErrorNeedsSettings(errorMessage)}
          onDraftChange={setDraft}
          onCancel={onClose}
          onPublish={() => void publish()}
          onOpenSettings={() => {
            onClose();
            onOpenSettings();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
