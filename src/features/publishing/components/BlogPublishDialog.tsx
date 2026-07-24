/**
 * [INPUT]: 依赖 shadcn/ui、GitHubPublishView、发布 API/blogPayload、shared 写作契约与日期工具
 * [OUTPUT]: 对外提供 BlogPublishDialog，承载 GitHub 确认、实时进度、错误恢复与稳定成功结果
 * [POS]: publishing feature 的项目 GitHub 发布界面，只查询仓库授权状态，凭证仍由 native 发布命令读取
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GitHubPublishView, type GitHubPublishState } from "@/features/publishing/components/GitHubPublishView";
import { createBlogSlug, prepareBlogPublishInput } from "@/features/publishing/model/blogPayload";
import { isDesktopPublishingAvailable, listGitHubRepositories, publishBlogPost } from "@/features/publishing/model/api";
import { githubProgressPresentation } from "@/features/publishing/model/progress";
import { nowTimestamp } from "@/shared/lib/dates";
import type { BlogPublication, WritingProject, WritingSheet } from "@/shared/types";
import { isCanonicalSheetId } from "@/features/library/model/documentId";

interface BlogPublishDialogProps {
  open: boolean;
  project: WritingProject;
  sheet: WritingSheet;
  libraryPath: string;
  onClose: () => void;
  onOpenSettings: () => void;
  onPublished: (publication: BlogPublication) => void;
}

export function BlogPublishDialog({ open, project, sheet, libraryPath, onClose, onOpenSettings, onPublished }: BlogPublishDialogProps) {
  const desktopAvailable = isDesktopPublishingAvailable();
  const [slug, setSlug] = useState(() => sheet.blogPublication?.slug || createBlogSlug(sheet.title, sheet.id));
  const [draft, setDraft] = useState(sheet.blogPublication?.draft ?? false);
  const [repositoryAuthorized, setRepositoryAuthorized] = useState(false);
  const [checkingGitHub, setCheckingGitHub] = useState(desktopAvailable);
  const [state, setState] = useState<GitHubPublishState>("ready");
  const [progressValue, setProgressValue] = useState(6);
  const [progressLabel, setProgressLabel] = useState("准备发布…");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<BlogPublication | null>(null);
  const previousOpenRef = useRef(open);

  useEffect(() => {
    const opening = open && !previousOpenRef.current;
    previousOpenRef.current = open;
    if (!opening) return;
    setSlug(sheet.blogPublication?.slug || createBlogSlug(sheet.title, sheet.id));
    setDraft(sheet.blogPublication?.draft ?? false);
    setState("ready");
    setProgressValue(6);
    setProgressLabel("准备发布…");
    setErrorMessage("");
    setResult(null);
  }, [open, sheet.blogPublication, sheet.id, sheet.title]);

  useEffect(() => {
    if (!open || !desktopAvailable) {
      setCheckingGitHub(false);
      setRepositoryAuthorized(false);
      return;
    }
    let cancelled = false;
    setCheckingGitHub(true);
    void listGitHubRepositories()
      .then((repositories) => {
        const target = project.blogPublishing?.repository.toLowerCase();
        if (!cancelled) {
          setRepositoryAuthorized(Boolean(target) && repositories.some((repository) => repository.fullName.toLowerCase() === target));
        }
      })
      .catch(() => {
        if (!cancelled) setRepositoryAuthorized(false);
      })
      .finally(() => {
        if (!cancelled) setCheckingGitHub(false);
      });
    return () => {
      cancelled = true;
    };
  }, [desktopAvailable, open, project.blogPublishing?.repository]);

  const config = project.blogPublishing;
  const publishTargetName = config?.name?.trim() || "GitHub 发布";
  const busy = state === "publishing";
  const publishIdentityReady = Boolean(sheet.blogPublication?.slug) || isCanonicalSheetId(sheet.id);

  async function publish() {
    setState("publishing");
    setProgressValue(6);
    setProgressLabel("正在检查文稿…");
    setErrorMessage("");
    setResult(null);
    try {
      const request = prepareBlogPublishInput(libraryPath, project, sheet, { slug, draft });
      const response = await publishBlogPost(request, (event) => {
        const presentation = githubProgressPresentation(event);
        setProgressValue(presentation.value);
        setProgressLabel(presentation.label);
      });
      const publication: BlogPublication = {
        sourceId: request.sourceId,
        slug: response.slug,
        url: response.url,
        lastCommitSha: response.commitSha,
        lastPublishedAt: nowTimestamp(),
        sourceHash: response.sourceHash,
        draft: response.draft,
      };
      setSlug(response.slug);
      setResult(publication);
      setProgressValue(100);
      setState("success");
      setProgressLabel(response.changed ? (response.draft ? "私密版本已提交" : "文章已提交，Cloudflare 正在部署") : "发布内容没有变化");
      onPublished(publication);
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
            <DialogDescription className="sr-only">确认文章信息与可见范围后提交到项目配置的 GitHub 仓库。</DialogDescription>
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
          detail={`${config?.repository || "尚未配置 GitHub 仓库"} · ${config?.branch || "main"}`}
          draft={draft}
          wasPublished={Boolean(sheet.blogPublication)}
          progress={progressValue}
          progressLabel={progressLabel}
          errorMessage={errorMessage}
          resultUrl={result?.url || ""}
          commitSha={result?.lastCommitSha || ""}
          desktopAvailable={desktopAvailable}
          checkingGitHub={checkingGitHub}
          repositoryAuthorized={repositoryAuthorized}
          publishIdentityReady={publishIdentityReady}
          configEnabled={Boolean(config?.enabled)}
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
