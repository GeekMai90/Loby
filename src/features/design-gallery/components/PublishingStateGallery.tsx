/**
 * [INPUT]: 依赖 GitHubPublishView、MowenPublishView、共享 Button 与发布模态窗的正式几何
 * [OUTPUT]: 对外提供 GitHubPublishingStates、MowenPublishingStates 三状态陈列组件
 * [POS]: design-gallery 的发布状态展台，只提供静态业务样本，状态主体直接复用 production publishing views
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GitHubPublishView, type GitHubPublishState } from "@/features/publishing/components/GitHubPublishView";
import { MowenPublishView, type MowenPublishState } from "@/features/publishing/components/MowenPublishView";
import type { MowenVisibility } from "@/features/publishing/model/api";

const NOOP = () => undefined;
const ARTICLE_TITLE = "为什么 Markdown 对 AI 更友好";
const ARTICLE_SLUG = "01jz8m3c2d7k9n4p6q8r1t5v7x";
const GITHUB_TARGET_NAME = "麦先生说博客";
const GITHUB_RESULT_URL = "https://blog.geekmailab.com/posts/01jz8m3c2d7k9n4p6q8r1t5v7x/";

const STATE_SAMPLES = [
  { state: "ready", label: "确认态" },
  { state: "publishing", label: "发布中" },
  { state: "success", label: "成功态" },
] as const;

export function GitHubPublishingStates() {
  return (
    <StateGrid>
      {STATE_SAMPLES.map(({ state, label }) => (
        <StatePreview key={state} label={label} data-publish-state={`github-${state}`}>
          <GitHubPreview state={state} />
        </StatePreview>
      ))}
    </StateGrid>
  );
}

export function MowenPublishingStates() {
  return (
    <StateGrid>
      {STATE_SAMPLES.map(({ state, label }) => (
        <StatePreview key={state} label={label} data-publish-state={`mowen-${state}`}>
          <MowenPreview state={state} />
        </StatePreview>
      ))}
    </StateGrid>
  );
}

function GitHubPreview({ state }: { state: GitHubPublishState }) {
  const [draft, setDraft] = useState(false);

  return (
    <PublishSurface>
      <header className="flex min-h-8 items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold">发布到{GITHUB_TARGET_NAME}</h3>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" disabled={state === "publishing"} title="关闭">
          <X />
        </Button>
      </header>

      <GitHubPublishView
        state={state}
        title={ARTICLE_TITLE}
        targetName={GITHUB_TARGET_NAME}
        slug={ARTICLE_SLUG}
        detail="GeekMai90/maixiansheng-blog · main"
        draft={draft}
        wasPublished={false}
        progress={68}
        progressLabel={state === "success" ? "文章已提交，Cloudflare 正在部署" : "正在上传文章资源…"}
        errorMessage=""
        resultUrl={state === "success" ? GITHUB_RESULT_URL : ""}
        commitSha={state === "success" ? "7f31c9a2b5e64718" : ""}
        desktopAvailable
        checkingGitHub={false}
        repositoryAuthorized
        publishIdentityReady
        configEnabled
        onDraftChange={setDraft}
        onCancel={NOOP}
        onPublish={NOOP}
        onOpenSettings={NOOP}
      />
    </PublishSurface>
  );
}

function MowenPreview({ state }: { state: MowenPublishState }) {
  const [visibility, setVisibility] = useState<MowenVisibility>("public");

  return (
    <PublishSurface>
      <header className="flex min-h-8 items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold">发布到墨问笔记</h3>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" disabled={state === "publishing"} title="关闭">
          <X />
        </Button>
      </header>

      <MowenPublishView
        state={state}
        title={ARTICLE_TITLE}
        characterCount={1864}
        progress={54}
        progressLabel={state === "success" ? "发布完成" : "正在上传图片 2/3…"}
        errorMessage=""
        errorNeedsSettings={false}
        visibility={visibility}
        onVisibilityChange={setVisibility}
        onCancel={NOOP}
        onPublish={NOOP}
        onOpenSettings={NOOP}
      />
    </PublishSurface>
  );
}

function StateGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid w-full grid-cols-[repeat(3,minmax(408px,1fr))] gap-4 overflow-x-auto pb-2" data-publishing-state-grid>
      {children}
    </div>
  );
}

function StatePreview({ label, children, ...props }: { label: string; children: React.ReactNode; "data-publish-state": string }) {
  return (
    <article className="min-w-0" {...props}>
      <p className="text-caption mb-2 font-semibold text-muted-foreground">{label}</p>
      {children}
    </article>
  );
}

function PublishSurface({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[520px] rounded-2xl bg-background p-5 text-foreground shadow-lg ring-1 ring-foreground/10">
      {children}
    </div>
  );
}
