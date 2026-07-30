/**
 * [INPUT]: 依赖 shadcn/ui、GitHub 仓库查询 API、应用级 GitHub 发布目标联合契约与设置行组件
 * [OUTPUT]: 对外提供 GitHubTargetSettings 名称行与 GitHubTargetDialog 编辑器，统一编辑 Hugo 与 Starlight 适配目标
 * [POS]: settings feature 的 GitHub 子目标边界；公共仓库参数共用一套表单，适配器直接显示自己的格式参数
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
import { publishingTargetName, type PublishingTarget } from "@/features/publishing/model/publishingTargets";
import { SettingsListRow } from "@/features/settings/components/SettingsControls";
import { showAppToast } from "@/shared/lib/appToast";

interface GitHubTargetSettingsProps {
  target: PublishingTarget;
  targetsReady: boolean;
  targetsError: string;
  onSave: (target: PublishingTarget) => Promise<unknown>;
}

export function GitHubTargetSettings({ target, targetsReady, targetsError, onSave }: GitHubTargetSettingsProps) {
  const [open, setOpen] = useState(false);
  const [editorTarget, setEditorTarget] = useState(target);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const name = publishingTargetName(target);

  function openEditor(enabled = target.enabled) {
    setEditorTarget({ ...target, enabled });
    setSaveState("idle");
    setOpen(true);
  }

  async function disableTarget() {
    setSaveState("saving");
    try {
      await onSave({ ...target, enabled: false });
      setSaveState("idle");
      showAppToast({ variant: "success", title: "发布目标已停用", description: `${name} 已从绑定项目的发布入口隐藏。` });
    } catch (cause) {
      setSaveState("error");
      showAppToast({ variant: "error", title: "发布目标停用失败", description: cause instanceof Error ? cause.message : String(cause) });
    }
  }

  return (
    <>
      <SettingsListRow className="flex min-h-12 items-center justify-between gap-3 px-3 py-2.25">
        <span className="min-w-0 truncate text-[13px] font-medium text-foreground">{name}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={!targetsReady || saveState === "saving"}
              aria-label={`${name}发布目标操作`}
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

      <GitHubTargetDialog
        target={editorTarget}
        open={open}
        targetsReady={targetsReady}
        targetsError={targetsError}
        onOpenChange={setOpen}
        onSave={onSave}
      />
    </>
  );
}

interface GitHubTargetDialogProps {
  target: PublishingTarget;
  open: boolean;
  targetsReady: boolean;
  targetsError: string;
  onOpenChange: (open: boolean) => void;
  onSave: (target: PublishingTarget) => Promise<unknown>;
}

export function GitHubTargetDialog({ target, open, targetsReady, targetsError, onOpenChange, onSave }: GitHubTargetDialogProps) {
  const [draft, setDraft] = useState(target);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [repositoryState, setRepositoryState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [repositoryMessage, setRepositoryMessage] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft(target);
    setSaveState("idle");
    setSaveMessage("");
  }, [open, target]);

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
  const errorMessage = targetsError
    ? `无法读取发布目标：${targetsError}`
    : repositoryState === "error"
      ? `无法读取仓库：${repositoryMessage}`
      : saveMessage || validationMessage;

  async function save() {
    if (validationMessage || busy) return;
    setSaveState("saving");
    setSaveMessage("");
    try {
      const common = {
        ...draft,
        repository: draft.repository.trim(),
        branch: draft.branch.trim() || "main",
        contentRoot: normalizePath(draft.contentRoot),
        siteUrl: draft.siteUrl.trim().replace(/\/+$/, ""),
      };
      const normalized: PublishingTarget =
        common.kind === "githubHugoBlog"
          ? { ...common, blogName: common.blogName.trim(), menuLabel: common.menuLabel.trim() }
          : {
              ...common,
              siteName: common.siteName.trim(),
              manifestPath: normalizePath(common.manifestPath),
              assetsRoot: normalizePath(common.assetsRoot),
            };
      await onSave(normalized);
      onOpenChange(false);
    } catch (cause) {
      setSaveState("error");
      setSaveMessage(cause instanceof Error ? cause.message : String(cause));
    }
  }

  const name = publishingTargetName(draft);
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}>
      <DialogContent showCloseButton={false} className="max-h-[min(760px,calc(100vh-48px))] overflow-y-auto sm:max-w-130">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <DialogHeader>
            <DialogTitle>{name}</DialogTitle>
            <DialogDescription className="sr-only">设置 GitHub 发布目标及内容适配方式。</DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-foreground">启用发布目标</p>
              <p className="mt-0.5 text-xs text-muted-foreground">内容适配：{adapterLabel(draft)}</p>
            </div>
            <Switch
              checked={draft.enabled}
              onCheckedChange={(enabled) => setDraft((current) => ({ ...current, enabled }))}
              aria-label={`启用${name}发布目标`}
            />
          </div>

          <label className="flex flex-col gap-2 text-body font-medium text-foreground">
            <span>目标名称</span>
            <Input
              className="text-foreground"
              value={draft.kind === "githubHugoBlog" ? draft.blogName : draft.siteName}
              placeholder={draft.kind === "githubHugoBlog" ? "例如：麦先生说博客" : "例如：落笔帮助中心"}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) =>
                  current.kind === "githubHugoBlog" ? { ...current, blogName: value } : { ...current, siteName: value },
                );
              }}
            />
          </label>

          {draft.kind === "githubHugoBlog" ? (
            <label className="flex flex-col gap-2 text-body font-medium text-foreground">
              <span>发布菜单名称</span>
              <Input
                className="text-foreground"
                value={draft.menuLabel}
                placeholder="例如：发布到麦先生说"
                onChange={(event) =>
                  setDraft((current) => (current.kind === "githubHugoBlog" ? { ...current, menuLabel: event.target.value } : current))
                }
              />
            </label>
          ) : null}

          <label className="flex flex-col gap-2 text-body font-medium text-foreground">
            <span>GitHub 仓库</span>
            <Select
              value={draft.repository || undefined}
              disabled={!targetsReady || repositoryState === "loading" || repositoryOptions.length === 0}
              onValueChange={(value) => {
                const repository = repositoryOptions.find((item) => item.fullName === value);
                setDraft((current) => ({ ...current, repository: value, branch: repository?.defaultBranch || current.branch || "main" }));
              }}
            >
              <SelectTrigger width="full" className="text-foreground disabled:opacity-100" aria-label="GitHub 仓库">
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
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-2 text-body font-medium text-foreground">
              <span>发布分支</span>
              <Input
                className="text-foreground"
                value={draft.branch}
                placeholder="main"
                onChange={(event) => setDraft((current) => ({ ...current, branch: event.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-2 text-body font-medium text-foreground">
              <span>{draft.kind === "githubHugoBlog" ? "文章目录" : "文档目录"}</span>
              <Input
                className="text-foreground"
                value={draft.contentRoot}
                placeholder={draft.kind === "githubHugoBlog" ? "content/posts" : "src/content/docs"}
                onChange={(event) => setDraft((current) => ({ ...current, contentRoot: event.target.value }))}
              />
            </label>
          </div>

          {draft.kind === "githubDocsSite" ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-2 text-body font-medium text-foreground">
                <span>图片目录</span>
                <Input
                  className="text-foreground"
                  value={draft.assetsRoot}
                  onChange={(event) =>
                    setDraft((current) => (current.kind === "githubDocsSite" ? { ...current, assetsRoot: event.target.value } : current))
                  }
                />
              </label>
              <label className="flex flex-col gap-2 text-body font-medium text-foreground">
                <span>文档清单</span>
                <Input
                  className="text-foreground"
                  value={draft.manifestPath}
                  onChange={(event) =>
                    setDraft((current) => (current.kind === "githubDocsSite" ? { ...current, manifestPath: event.target.value } : current))
                  }
                />
              </label>
            </div>
          ) : null}

          <label className="flex flex-col gap-2 text-body font-medium text-foreground">
            <span>网站地址</span>
            <Input
              className="text-foreground"
              value={draft.siteUrl}
              placeholder="https://example.com"
              onChange={(event) => setDraft((current) => ({ ...current, siteUrl: event.target.value }))}
            />
          </label>

          {errorMessage ? (
            <p className="text-xs leading-5 text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={busy || Boolean(validationMessage)}>
              {busy ? <LoaderCircle className="animate-spin" size={15} /> : null}
              {busy ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function validateDraft(target: PublishingTarget): string {
  if (!publishingTargetName(target).trim()) return "请填写目标名称。";
  if (target.kind === "githubHugoBlog" && !target.menuLabel.trim()) return "请填写发布菜单名称。";
  if (!target.enabled) return "";
  if (!/^[^/\s]+\/[^/\s]+$/.test(target.repository.trim())) return "请选择有效的 GitHub 仓库。";
  if (!target.branch.trim()) return "请填写发布分支。";
  if (!isSafePath(target.contentRoot)) return "内容目录格式无效。";
  if (target.kind === "githubHugoBlog" && !target.contentRoot.trim().startsWith("content/")) return "Hugo 文章目录必须位于 content/ 下。";
  if (
    target.kind === "githubDocsSite" &&
    target.contentRoot.trim() !== "src/content/docs" &&
    !target.contentRoot.trim().startsWith("src/content/docs/")
  )
    return "Starlight 文档目录必须位于 src/content/docs 下。";
  if (target.kind === "githubDocsSite" && (!isSafePath(target.assetsRoot) || !target.assetsRoot.trim().startsWith("public/")))
    return "Starlight 图片目录必须位于 public/ 下。";
  if (target.kind === "githubDocsSite" && (!isSafePath(target.manifestPath) || !target.manifestPath.trim().endsWith(".json")))
    return "Starlight 文档清单必须是安全的 JSON 路径。";
  if (!/^https?:\/\//i.test(target.siteUrl.trim())) return "网站地址必须以 https:// 或 http:// 开头。";
  return "";
}

function adapterLabel(target: PublishingTarget): string {
  return target.kind === "githubHugoBlog" ? "Hugo 博客" : "Starlight 文档站";
}

function normalizePath(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, "");
}

function isSafePath(value: string): boolean {
  const normalized = normalizePath(value);
  return (
    Boolean(normalized) &&
    normalized
      .split("/")
      .every((segment) => segment && segment !== "." && segment !== ".." && !segment.startsWith(".") && !segment.includes("\\"))
  );
}
