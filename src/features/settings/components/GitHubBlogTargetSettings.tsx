/**
 * [INPUT]: 依赖 shadcn/ui、GitHub 仓库查询 API、应用级 GitHub 博客目标契约与设置行组件
 * [OUTPUT]: 对外提供 GitHubBlogTargetSettings，以与发布目标目录一致的名称行和更多菜单展示目标，并在独立详情 Dialog 中编辑和保存
 * [POS]: settings feature 的 GitHub 子目标编辑器；列表只暴露目标名称和动作菜单，非敏感仓库参数进入 Dialog，账号凭证仍归连接设置
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { LoaderCircle, MoreHorizontal, Power, PowerOff, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { listGitHubRepositories, type GitHubRepository } from "@/features/publishing/model/api";
import { type GitHubBlogPublishingTarget } from "@/features/publishing/model/publishingTargets";
import { SettingsListRow } from "@/features/settings/components/SettingsControls";
import { showAppToast } from "@/shared/lib/appToast";

interface GitHubBlogTargetSettingsProps {
  target: GitHubBlogPublishingTarget;
  targetsReady: boolean;
  targetsError: string;
  onSave: (target: GitHubBlogPublishingTarget) => Promise<unknown>;
}

export function GitHubBlogTargetSettings({ target, targetsReady, targetsError, onSave }: GitHubBlogTargetSettingsProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(target);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [repositoryState, setRepositoryState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [repositoryMessage, setRepositoryMessage] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRepositoryState("loading");
    setRepositoryMessage("");
    void listGitHubRepositories()
      .then((items) => {
        if (cancelled) return;
        setRepositories(items);
        setRepositoryState("ready");
      })
      .catch((cause) => {
        if (cancelled) return;
        setRepositories([]);
        setRepositoryState("error");
        setRepositoryMessage(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const repositoryOptions = useMemo(() => {
    const current = draft.repository.trim();
    if (!current || repositories.some((repository) => repository.fullName === current)) return repositories;
    return [{ fullName: current, private: false, defaultBranch: draft.branch || "main" }, ...repositories];
  }, [draft.branch, draft.repository, repositories]);
  const validationMessage = validateDraft(draft);
  const busy = saveState === "saving";
  function openEditor(enabled = target.enabled) {
    setDraft({ ...target, enabled });
    setSaveState("idle");
    setSaveMessage("");
    setOpen(true);
  }

  async function disableTarget() {
    setSaveState("saving");
    try {
      await onSave({ ...target, enabled: false });
      setSaveState("idle");
      showAppToast({ variant: "success", title: "发布目标已停用", description: `${target.blogName} 已从文稿发布菜单隐藏。` });
    } catch (cause) {
      setSaveState("error");
      showAppToast({ variant: "error", title: "发布目标停用失败", description: cause instanceof Error ? cause.message : String(cause) });
    }
  }

  async function save() {
    if (validationMessage || busy) return;
    setSaveState("saving");
    setSaveMessage("");
    try {
      await onSave({
        ...draft,
        blogName: draft.blogName.trim(),
        menuLabel: draft.menuLabel.trim(),
        repository: draft.repository.trim(),
        branch: draft.branch.trim() || "main",
        contentRoot: draft.contentRoot.trim().replace(/^\/+|\/+$/g, ""),
        siteUrl: draft.siteUrl.trim().replace(/\/+$/, ""),
      });
      setOpen(false);
    } catch (cause) {
      setSaveState("error");
      setSaveMessage(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <>
      <SettingsListRow className="flex min-h-12 items-center justify-between gap-3 px-3 py-2.25">
        <span className="min-w-0 truncate text-[13px] font-medium text-foreground">{target.blogName || "GitHub 博客"}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={!targetsReady || saveState === "saving"}
              aria-label={`${target.blogName || "GitHub 博客"}发布目标操作`}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={() => openEditor()}>
              <Settings2 />
              <span>编辑设置</span>
            </DropdownMenuItem>
            {target.enabled ? (
              <DropdownMenuItem onSelect={() => void disableTarget()}>
                <PowerOff />
                <span>停用发布目标</span>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => openEditor(true)}>
                <Power />
                <span>启用发布目标</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SettingsListRow>

      <Dialog open={open} onOpenChange={(nextOpen) => !busy && setOpen(nextOpen)}>
        <DialogContent showCloseButton={false} className="max-h-[min(720px,calc(100vh-48px))] overflow-y-auto sm:max-w-130">
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <DialogHeader>
              <DialogTitle>GitHub 博客</DialogTitle>
              <DialogDescription>设置一个应用级发布目标；启用后，任何项目中的文稿都可以使用它。</DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">启用发布目标</p>
                <p className="mt-0.5 text-xs text-muted-foreground">在所有文稿的分享菜单中显示这个入口。</p>
              </div>
              <Switch
                checked={draft.enabled}
                onCheckedChange={(enabled) => setDraft((current) => ({ ...current, enabled }))}
                aria-label="启用 GitHub 博客发布目标"
              />
            </div>

            <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
              <span>博客名称</span>
              <Input
                value={draft.blogName}
                placeholder="例如：麦先生说博客"
                onChange={(event) => setDraft((current) => ({ ...current, blogName: event.target.value }))}
              />
              <small className="font-normal leading-5">用于设置页和发布窗口识别这个目标。</small>
            </label>

            <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
              <span>发布菜单名称</span>
              <Input
                value={draft.menuLabel}
                placeholder="例如：发布到麦先生说"
                onChange={(event) => setDraft((current) => ({ ...current, menuLabel: event.target.value }))}
              />
              <small className="font-normal leading-5">该名称会显示在文稿右上角的分享菜单中。</small>
            </label>

            <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
              <span>GitHub 仓库</span>
              <Select
                value={draft.repository || undefined}
                disabled={repositoryState === "loading" || repositoryOptions.length === 0}
                onValueChange={(value) => {
                  const repository = repositoryOptions.find((item) => item.fullName === value);
                  setDraft((current) => ({ ...current, repository: value, branch: repository?.defaultBranch || current.branch || "main" }));
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
              <small className="font-normal leading-5">
                {repositoryState === "loading"
                  ? "正在读取 GitHub 已授权仓库。"
                  : repositoryState === "error"
                    ? `无法读取仓库：${repositoryMessage}`
                    : repositories.length === 0
                      ? "请先返回发布设置连接 GitHub，并授权至少一个仓库。"
                      : `当前账号有 ${repositories.length} 个可写仓库。`}
              </small>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
                <span>发布分支</span>
                <Input
                  value={draft.branch}
                  placeholder="main"
                  onChange={(event) => setDraft((current) => ({ ...current, branch: event.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
                <span>文章目录</span>
                <Input
                  value={draft.contentRoot}
                  placeholder="content/posts"
                  onChange={(event) => setDraft((current) => ({ ...current, contentRoot: event.target.value }))}
                />
              </label>
            </div>

            <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
              <span>网站地址</span>
              <Input
                value={draft.siteUrl}
                placeholder="https://example.com"
                onChange={(event) => setDraft((current) => ({ ...current, siteUrl: event.target.value }))}
              />
            </label>

            {(targetsError || validationMessage || saveMessage) && (
              <p className="text-xs leading-5 text-destructive" role="alert">
                {targetsError ? `无法读取发布目标：${targetsError}` : saveMessage || validationMessage}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={busy || Boolean(validationMessage)}>
                {busy && <LoaderCircle className="animate-spin" size={15} />}
                {busy ? "保存中…" : "保存"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function validateDraft(target: GitHubBlogPublishingTarget): string {
  if (!target.blogName.trim()) return "请填写博客名称。";
  if (!target.menuLabel.trim()) return "请填写发布菜单名称。";
  if (!target.enabled) return "";
  if (!/^[^/\s]+\/[^/\s]+$/.test(target.repository.trim())) return "请选择有效的 GitHub 仓库。";
  if (!target.branch.trim()) return "请填写发布分支。";
  if (!target.contentRoot.trim().startsWith("content/")) return "文章目录必须位于 content/ 下。";
  if (!/^https?:\/\//i.test(target.siteUrl.trim())) return "网站地址必须以 https:// 或 http:// 开头。";
  return "";
}
