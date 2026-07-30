/**
 * [INPUT]: 依赖 shadcn 对话框/表单控件、项目帮助中心映射模型、GitHub 仓库目录 API 与 shared 写作契约
 * [OUTPUT]: 对外提供 HelpCenterSyncDialog，统一承载项目绑定、自动/手动分组映射以及单篇/整项目同步
 * [POS]: publishing feature 的帮助中心交互边界；凭证仍由应用级 GitHub 连接持有，项目只保存非敏感绑定
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  helpCenterPublicationsFromResult,
  normalizeHelpCenterBinding,
  prepareHelpCenterSyncInput,
  createHelpCenterBinding,
  validateHelpCenterBinding,
} from "@/features/publishing/model/helpCenter";
import { listGitHubRepositories, syncHelpCenter, type HelpCenterSyncProgress } from "@/features/publishing/model/api";
import type { HelpCenterBinding, WritingProject } from "@/shared/types";

interface HelpCenterSyncDialogProps {
  open: boolean;
  libraryPath: string;
  project: WritingProject;
  sheetId?: string;
  onOpenChange: (open: boolean) => void;
  onProjectChange: (project: WritingProject) => void;
}

export function HelpCenterSyncDialog({ open, libraryPath, project, sheetId, onOpenChange, onProjectChange }: HelpCenterSyncDialogProps) {
  const [binding, setBinding] = useState<HelpCenterBinding>(() => normalizeHelpCenterBinding(project) ?? createHelpCenterBinding(project));
  const [repositories, setRepositories] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [deleteMissing, setDeleteMissing] = useState(false);
  const [status, setStatus] = useState("");
  const groupsById = useMemo(() => new Map((project.groups ?? []).map((group) => [group.id, group])), [project.groups]);
  const selectedSheet = sheetId ? project.sheets.find((sheet) => sheet.id === sheetId) : undefined;
  const validationError = validateHelpCenterBinding(binding);

  useEffect(() => {
    if (!open) return;
    void listGitHubRepositories()
      .then((items) => setRepositories(items.map((item) => item.fullName)))
      .catch((error) => setStatus(error instanceof Error ? error.message : String(error)));
  }, [open]);

  function updateBinding(patch: Partial<HelpCenterBinding>) {
    setBinding((current) => ({ ...current, ...patch }));
  }

  function saveBinding(): WritingProject {
    const normalized = normalizeHelpCenterBinding({ ...project, helpCenterBinding: binding }) ?? binding;
    setBinding(normalized);
    const nextProject = { ...project, helpCenterBinding: normalized };
    onProjectChange(nextProject);
    return nextProject;
  }

  async function synchronize() {
    if (validationError) {
      setStatus(validationError);
      return;
    }
    setBusy(true);
    setStatus("正在准备同步…");
    try {
      const nextProject = saveBinding();
      const request = prepareHelpCenterSyncInput(libraryPath, nextProject, sheetId, deleteMissing);
      const result = await syncHelpCenter(request, (progress) => setStatus(progressLabel(progress)));
      const publications = helpCenterPublicationsFromResult(result);
      const updatedProject = {
        ...nextProject,
        sheets: nextProject.sheets.map((sheet) => {
          const publication = publications.get(sheet.id);
          return publication ? { ...sheet, publications: { ...sheet.publications, "help-center": publication } } : sheet;
        }),
      };
      onProjectChange(updatedProject);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(820px,calc(100vh-48px))] overflow-y-auto sm:max-w-155">
        <DialogHeader>
          <DialogTitle>{sheetId ? "同步文稿到帮助中心" : "帮助中心同步"}</DialogTitle>
          <DialogDescription>
            {sheetId && selectedSheet
              ? `将「${selectedSheet.title}」提交到项目绑定的 GitHub 文档仓库。`
              : "项目分组会自动映射为 GitHub 文件夹；“待整理”默认不参与同步。"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
            <span>GitHub 仓库</span>
            <Input
              list="help-center-repositories"
              value={binding.repository}
              placeholder="owner/repository"
              onChange={(event) => updateBinding({ repository: event.target.value })}
            />
            <datalist id="help-center-repositories">
              {repositories.map((repository) => (
                <option key={repository} value={repository} />
              ))}
            </datalist>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
              <span>分支</span>
              <Input value={binding.branch} onChange={(event) => updateBinding({ branch: event.target.value })} />
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
              <span>帮助中心地址</span>
              <Input
                value={binding.siteUrl}
                placeholder="https://loby-help.geekmailab.com"
                onChange={(event) => updateBinding({ siteUrl: event.target.value })}
              />
            </label>
          </div>

          <section className="flex flex-col gap-2 border-t border-border pt-4">
            <div>
              <p className="text-sm font-medium">分组与文件夹</p>
              <p className="mt-0.5 text-xs text-muted-foreground">新建分组会在下次打开或同步时自动加入；文件夹可手动覆盖。</p>
            </div>
            <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {binding.groupMappings.map((mapping) => {
                const group = groupsById.get(mapping.groupId);
                if (!group) return null;
                return (
                  <div
                    key={mapping.groupId}
                    className="grid grid-cols-[minmax(100px,0.8fr)_minmax(160px,1.2fr)_auto] items-center gap-3 px-3 py-2.5"
                  >
                    <span className="truncate text-sm">{group.title}</span>
                    <Input
                      className="h-8"
                      value={mapping.directory}
                      disabled={!mapping.enabled}
                      placeholder={mapping.enabled ? "GitHub 文件夹" : "不同步"}
                      onChange={(event) =>
                        updateBinding({
                          groupMappings: binding.groupMappings.map((item) =>
                            item.groupId === mapping.groupId ? { ...item, directory: event.target.value } : item,
                          ),
                        })
                      }
                    />
                    <Switch
                      checked={mapping.enabled}
                      disabled={mapping.groupId === "group-default"}
                      aria-label={`${group.title}同步`}
                      onCheckedChange={(enabled) =>
                        updateBinding({
                          groupMappings: binding.groupMappings.map((item) =>
                            item.groupId === mapping.groupId ? { ...item, enabled } : item,
                          ),
                        })
                      }
                    />
                  </div>
                );
              })}
            </div>
          </section>

          <details className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">受管目录</summary>
            <div className="mt-3 grid gap-2">
              <PathField label="文档" value={binding.contentRoot} />
              <PathField label="分类清单" value={binding.manifestPath} />
              <PathField label="图片" value={binding.assetsRoot} />
            </div>
          </details>

          {!sheetId && (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
              <div>
                <p className="m-0 text-sm font-medium">清理远端缺失文稿</p>
                <p className="mt-0.5 mb-0 text-xs text-muted-foreground">开启后，远端清单中已不在本项目同步范围的文稿会被明确删除。</p>
              </div>
              <Switch checked={deleteMissing} onCheckedChange={setDeleteMissing} aria-label="清理远端缺失文稿" />
            </div>
          )}

          {status && (
            <p className="m-0 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground" role="status">
              {status}
            </p>
          )}
        </div>

        <DialogFooter>
          {binding.siteUrl && (
            <Button type="button" variant="ghost" asChild>
              <a href={binding.siteUrl} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden="true" />
                打开网站
              </a>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              saveBinding();
              onOpenChange(false);
            }}
          >
            仅保存绑定
          </Button>
          <Button type="button" disabled={busy || Boolean(validationError)} onClick={() => void synchronize()}>
            {busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {sheetId ? "同步这篇文稿" : "同步整个项目"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PathField({ label, value }: { label: string; value: string }) {
  return (
    <label className="grid grid-cols-[72px_1fr] items-center gap-2">
      <span>{label}</span>
      <Input className="h-8" value={value} readOnly />
    </label>
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
