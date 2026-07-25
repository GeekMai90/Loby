/**
 * [INPUT]: 依赖 shadcn/ui 基础控件、clsx、React 运行时、GitHub 仓库查询、index.css 色板控件 Token 与写作库模块
 * [OUTPUT]: 对外提供 NewProjectDialog
 * [POS]: 写作库 feature 的项目设置界面，只管理项目外观、项目目标与发布配置，不控制文稿级目标
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import clsx from "clsx";
import { useEffect, useMemo, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { listGitHubRepositories, type GitHubRepository } from "@/features/publishing/model/api";
import {
  getProjectIconOption,
  PROJECT_COLOR_OPTIONS,
  PROJECT_ICON_OPTIONS,
  type NewProjectDraft,
} from "@/features/library/constants/projectAppearance";

interface NewProjectDialogProps {
  open: boolean;
  draft: NewProjectDraft;
  inputRef: RefObject<HTMLInputElement | null>;
  title?: string;
  submitLabel?: string;
  showAppearanceControls?: boolean;
  showGoalControls?: boolean;
  showBlogControls?: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onDraftChange: Dispatch<SetStateAction<NewProjectDraft>>;
}

export function NewProjectDialog({
  open,
  draft,
  inputRef,
  title = "新建项目",
  submitLabel = "创建",
  showAppearanceControls = true,
  showGoalControls = true,
  showBlogControls = false,
  onClose,
  onSubmit,
  onDraftChange,
}: NewProjectDialogProps) {
  const [githubRepositories, setGitHubRepositories] = useState<GitHubRepository[]>([]);
  const [repositoryState, setRepositoryState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [repositoryMessage, setRepositoryMessage] = useState("");
  const selectedIcon = getProjectIconOption(draft.icon);
  const SelectedProjectIcon = selectedIcon.Icon;
  const repositoryOptions = useMemo(() => {
    const current = draft.blogRepository?.trim();
    if (!current || githubRepositories.some((repository) => repository.fullName === current)) return githubRepositories;
    return [
      {
        fullName: current,
        private: false,
        defaultBranch: draft.blogBranch?.trim() || "main",
      },
      ...githubRepositories,
    ];
  }, [draft.blogBranch, draft.blogRepository, githubRepositories]);
  const blogSettingsInvalid =
    Boolean(draft.blogEnabled) &&
    (!draft.blogName?.trim() ||
      !/^[^/\s]+\/[^/\s]+$/.test(draft.blogRepository?.trim() ?? "") ||
      !draft.blogBranch?.trim() ||
      !draft.blogContentRoot?.trim().startsWith("content/") ||
      !/^https?:\/\//i.test(draft.blogSiteUrl?.trim() ?? ""));

  useEffect(() => {
    if (!open || !showBlogControls) return;
    let cancelled = false;
    setRepositoryState("loading");
    setRepositoryMessage("");
    void listGitHubRepositories()
      .then((repositories) => {
        if (cancelled) return;
        setGitHubRepositories(repositories);
        setRepositoryState("ready");
      })
      .catch((cause) => {
        if (cancelled) return;
        setGitHubRepositories([]);
        setRepositoryState("error");
        setRepositoryMessage(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [open, showBlogControls]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent showCloseButton={false} className="max-h-[min(760px,calc(100vh-48px))] overflow-y-auto sm:max-w-120">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <DialogHeader className="flex-row items-center gap-3">
            <div
              className="grid size-11 shrink-0 place-items-center rounded-xl"
              style={{ color: draft.iconColor, backgroundColor: `${draft.iconColor}18` }}
            >
              <SelectedProjectIcon size={22} />
            </div>
            <div>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="sr-only">设置项目名称、图标、颜色和写作目标。</DialogDescription>
            </div>
          </DialogHeader>

          <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
            <span>名称</span>
            <Input
              ref={inputRef}
              autoFocus
              value={draft.title}
              onChange={(event) => onDraftChange((current) => ({ ...current, title: event.target.value }))}
            />
          </label>

          {showAppearanceControls && (
            <>
              <section className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-muted-foreground">图标</span>
                <div className="grid max-h-36 grid-cols-8 gap-1.75 overflow-auto pr-0.5">
                  {PROJECT_ICON_OPTIONS.map((option) => (
                    <Button
                      key={option.id}
                      type="button"
                      variant={draft.icon === option.id ? "secondary" : "outline"}
                      size="icon"
                      aria-pressed={draft.icon === option.id}
                      onClick={() => onDraftChange((current) => ({ ...current, icon: option.id }))}
                      title={option.label}
                    >
                      <option.Icon size={18} />
                    </Button>
                  ))}
                </div>
              </section>

              <section className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-muted-foreground">图标颜色</span>
                <div className="grid grid-cols-12 justify-items-center gap-2">
                  {PROJECT_COLOR_OPTIONS.map((option) => (
                    <Button
                      key={option.id}
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className={clsx(
                        "size-6.5 rounded-full border-2 border-[var(--color-swatch-border)] p-0 shadow-[var(--color-swatch-shadow)]",
                        draft.iconColor === option.value && "shadow-[var(--color-swatch-selected-shadow)]",
                      )}
                      aria-pressed={draft.iconColor === option.value}
                      onClick={() => onDraftChange((current) => ({ ...current, iconColor: option.value }))}
                      title={option.label}
                      style={{ backgroundColor: option.value }}
                    />
                  ))}
                </div>
              </section>
            </>
          )}

          {showGoalControls && (
            <section className="flex flex-col gap-3 border-t border-border pt-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">项目目标</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">跟踪整个项目的总字数，或手动标记完成的文章数量。</p>
                </div>
                <Switch
                  checked={Boolean(draft.goalEnabled)}
                  onCheckedChange={(checked) =>
                    onDraftChange((current) => ({
                      ...current,
                      goalEnabled: checked,
                      goalTarget: checked && !current.goalTarget ? 10_000 : current.goalTarget,
                    }))
                  }
                  aria-label="启用项目目标"
                />
              </div>
              <div className="flex items-center gap-2">
                <Input
                  className="min-w-0 flex-1"
                  type="number"
                  min={1}
                  step={1}
                  disabled={!draft.goalEnabled}
                  value={draft.goalTarget || ""}
                  placeholder={draft.goalUnit === "articles" ? "例如 20" : "例如 50000"}
                  onChange={(event) =>
                    onDraftChange((current) => ({ ...current, goalTarget: Math.max(0, Number(event.target.value) || 0) }))
                  }
                />
                <Select
                  disabled={!draft.goalEnabled}
                  value={draft.goalUnit ?? "words"}
                  onValueChange={(value: "words" | "articles") => onDraftChange((current) => ({ ...current, goalUnit: value }))}
                >
                  <SelectTrigger width="compact">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="words">字</SelectItem>
                    <SelectItem value="articles">篇文章</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </section>
          )}

          {showBlogControls && (
            <section className="flex flex-col gap-3 border-t border-border pt-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">GitHub 发布</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">将这个项目中的文稿发布到指定的 GitHub 仓库。</p>
                </div>
                <Switch
                  checked={Boolean(draft.blogEnabled)}
                  onCheckedChange={(checked) => onDraftChange((current) => ({ ...current, blogEnabled: checked }))}
                  aria-label="启用 GitHub 发布"
                />
              </div>
              <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
                <span>名称</span>
                <Input
                  disabled={!draft.blogEnabled}
                  value={draft.blogName ?? ""}
                  placeholder="例如：麦先生说博客"
                  onChange={(event) => onDraftChange((current) => ({ ...current, blogName: event.target.value }))}
                />
                <small className="font-normal leading-5 text-muted-foreground">该名称会显示在当前文稿的发布菜单中。</small>
              </label>
              <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
                <span>GitHub 仓库</span>
                <Select
                  disabled={!draft.blogEnabled || repositoryState === "loading" || repositoryOptions.length === 0}
                  value={draft.blogRepository?.trim() || undefined}
                  onValueChange={(value) => {
                    const repository = repositoryOptions.find((item) => item.fullName === value);
                    onDraftChange((current) => ({
                      ...current,
                      blogRepository: value,
                      blogBranch: repository?.defaultBranch || current.blogBranch || "main",
                    }));
                  }}
                >
                  <SelectTrigger width="full">
                    <SelectValue placeholder={repositoryState === "loading" ? "正在读取仓库…" : "选择发布仓库"} />
                  </SelectTrigger>
                  <SelectContent>
                    {repositoryOptions.map((repository) => (
                      <SelectItem key={repository.fullName} value={repository.fullName}>
                        {repository.fullName}
                        {repository.private ? " · Private" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <small className="font-normal leading-5 text-muted-foreground">
                  {repositoryState === "loading"
                    ? "正在读取 GitHub 已授权仓库。"
                    : repositoryState === "error"
                      ? `请先在设置中心连接 GitHub：${repositoryMessage}`
                      : githubRepositories.length === 0
                        ? "当前没有已授权的可写仓库，请在设置中心管理 GitHub 仓库权限。"
                        : `当前账号有 ${githubRepositories.length} 个可写仓库。`}
                </small>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
                  <span>发布分支</span>
                  <Input
                    disabled={!draft.blogEnabled}
                    value={draft.blogBranch ?? "main"}
                    placeholder="main"
                    onChange={(event) => onDraftChange((current) => ({ ...current, blogBranch: event.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
                  <span>文章目录</span>
                  <Input
                    disabled={!draft.blogEnabled}
                    value={draft.blogContentRoot ?? "content/posts"}
                    placeholder="content/posts"
                    onChange={(event) => onDraftChange((current) => ({ ...current, blogContentRoot: event.target.value }))}
                  />
                </label>
              </div>
              <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
                <span>站点地址</span>
                <Input
                  disabled={!draft.blogEnabled}
                  value={draft.blogSiteUrl ?? ""}
                  placeholder="https://example.com"
                  onChange={(event) => onDraftChange((current) => ({ ...current, blogSiteUrl: event.target.value }))}
                />
              </label>
              <p className="text-[11px] leading-5 text-muted-foreground">
                GitHub 账号在设置中心的“发布”中统一连接，项目文件只保存仓库名称，不保存凭证。
              </p>
            </section>
          )}

          <DialogFooter className="mt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button
              type="submit"
              disabled={(Boolean(draft.goalEnabled) && !(draft.goalTarget && draft.goalTarget > 0)) || blogSettingsInvalid}
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
