/**
 * [INPUT]: 依赖 shadcn/ui、React、GitHub 身份控制器、墨问凭证 command、应用级 GitHub 发布目标与设置列表基础组件
 * [OUTPUT]: 对外提供 PublishingSettingsPanel，以“发布目标”目录管理 GitHub/墨问接入，并仅在 GitHub 已添加时展示其子目标目录
 * [POS]: settings feature 的发布设置编排层，分离渠道接入与渠道内部发布项；敏感凭证只经 native secret store 流转
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  deletePublishingSecret,
  hasPublishingSecret,
  isDesktopPublishingAvailable,
  savePublishingSecret,
  validateMowenApiKey,
  validateSavedMowenApiKey,
} from "@/features/publishing/model/api";
import {
  githubBlogTargets,
  type GitHubBlogPublishingTarget,
  type PublishingTargetStore,
} from "@/features/publishing/model/publishingTargets";
import { GitHubBlogTargetSettings } from "@/features/settings/components/GitHubBlogTargetSettings";
import { GitHubConnectionSettings } from "@/features/settings/components/GitHubConnectionSettings";
import { SettingsListRow, SettingsSection, SettingsSectionHeader } from "@/features/settings/components/SettingsControls";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { showAppToast } from "@/shared/lib/appToast";
import {
  CheckCircle2,
  CircleCheck,
  CircleX,
  ExternalLink,
  GitBranch,
  KeyRound,
  MoreHorizontal,
  NotebookPen,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Unplug,
} from "lucide-react";
import { useEffect, useState } from "react";

const MOWEN_ACCOUNT = "default";

interface PublishingSettingsPanelProps {
  publishingTargets: PublishingTargetStore;
  publishingTargetsReady: boolean;
  publishingTargetsError: string;
  onSavePublishingTarget: (target: GitHubBlogPublishingTarget) => Promise<unknown>;
}

type RemoveTarget = "github" | "mowen" | null;

export function PublishingSettingsPanel({
  publishingTargets,
  publishingTargetsReady,
  publishingTargetsError,
  onSavePublishingTarget,
}: PublishingSettingsPanelProps) {
  const desktopAvailable = isDesktopPublishingAvailable();
  const [apiKey, setApiKey] = useState("");
  const [hasSavedApiKey, setHasSavedApiKey] = useState(false);
  const [mowenDialogOpen, setMowenDialogOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget>(null);
  const [validationState, setValidationState] = useState<"loading" | "idle" | "validating" | "valid" | "invalid" | "error">(
    desktopAvailable ? "loading" : "idle",
  );
  const [validationMessage, setValidationMessage] = useState("");

  useEffect(() => {
    if (!desktopAvailable) return;
    let cancelled = false;
    setValidationState("loading");
    setValidationMessage("");
    void hasPublishingSecret("mowen", MOWEN_ACCOUNT)
      .then((hasSecret) => {
        if (cancelled) return;
        setHasSavedApiKey(hasSecret);
        setValidationState("idle");
      })
      .catch((cause) => {
        if (cancelled) return;
        setHasSavedApiKey(false);
        setValidationState("error");
        setValidationMessage(`无法读取墨问发布目标：${errorMessage(cause)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [desktopAvailable]);

  function openMowenDialog() {
    setApiKey("");
    setValidationState("idle");
    setValidationMessage("");
    setMowenDialogOpen(true);
  }

  async function validateApiKey() {
    const value = apiKey.trim();
    if (!value || !desktopAvailable) return;
    setValidationState("validating");
    setValidationMessage("");
    try {
      await validateMowenApiKey(value);
      await savePublishingSecret("mowen", MOWEN_ACCOUNT, value);
      setApiKey("");
      setHasSavedApiKey(true);
      setValidationState("valid");
      setMowenDialogOpen(false);
      showAppToast({ variant: "success", title: "墨问笔记已添加", description: "现在可以从文稿发布菜单使用墨问笔记。" });
    } catch (cause) {
      setValidationState("invalid");
      setValidationMessage(errorMessage(cause));
    }
  }

  async function validateSavedApiKey() {
    setValidationState("validating");
    try {
      await validateSavedMowenApiKey();
      setValidationState("idle");
      showAppToast({ variant: "success", title: "墨问连接有效", description: "已保存的 API Key 可以正常使用。" });
    } catch (cause) {
      setValidationState("invalid");
      showAppToast({ variant: "error", title: "墨问连接验证失败", description: errorMessage(cause) });
    }
  }

  async function removeMowenTarget() {
    setRemoveTarget(null);
    try {
      await deletePublishingSecret("mowen", MOWEN_ACCOUNT);
      setHasSavedApiKey(false);
      setApiKey("");
      setValidationState("idle");
      setValidationMessage("");
      showAppToast({ variant: "success", title: "墨问笔记已移除", description: "本机保存的墨问 API Key 已删除。" });
    } catch (cause) {
      showAppToast({ variant: "error", title: "墨问笔记移除失败", description: errorMessage(cause) });
    }
  }

  return (
    <GitHubConnectionSettings>
      {(github) => {
        const directoryLoading = github.loading || validationState === "loading";
        const hasDirectoryTargets = github.added || hasSavedApiKey;
        const directoryError = validationState === "error" ? validationMessage : "";

        return (
          <>
            <div className="grid gap-6">
              <section className="flex flex-col gap-2">
                <SettingsSectionHeader title="发布目标" />

                <div className="overflow-hidden rounded-lg border border-[var(--settings-dialog-divider)] bg-[var(--settings-dialog-section-background)]">
                  {hasDirectoryTargets ? (
                    <>
                      {github.added ? (
                        <PublishingTargetRow name="GitHub">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" variant="ghost" size="icon-sm" aria-label="GitHub 发布目标操作">
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem disabled={github.refreshing} onSelect={github.refresh}>
                                <RefreshCw className={github.refreshing ? "animate-spin" : undefined} />
                                <span>{github.refreshing ? "正在刷新…" : "立即刷新"}</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={github.openRepositoryAccess}>
                                <ExternalLink />
                                <span>管理仓库权限</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onSelect={() => setRemoveTarget("github")}>
                                <Unplug />
                                <span>断开连接</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </PublishingTargetRow>
                      ) : null}

                      {hasSavedApiKey ? (
                        <PublishingTargetRow name="墨问笔记">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" variant="ghost" size="icon-sm" aria-label="墨问笔记发布目标操作">
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem disabled={validationState === "validating"} onSelect={() => void validateSavedApiKey()}>
                                <ShieldCheck className={validationState === "validating" ? "animate-pulse" : undefined} />
                                <span>{validationState === "validating" ? "正在验证…" : "验证连接"}</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={openMowenDialog}>
                                <KeyRound />
                                <span>替换 API Key</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onSelect={() => setRemoveTarget("mowen")}>
                                <Trash2 />
                                <span>移除发布目标</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </PublishingTargetRow>
                      ) : null}
                    </>
                  ) : (
                    <div className="px-3 py-7 text-center text-xs leading-5 text-muted-foreground">
                      {directoryLoading ? "正在读取发布目标…" : directoryError || "尚未添加发布目标。"}
                    </div>
                  )}
                </div>

                <div className="flex justify-start">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" size="sm">
                        <Plus />
                        添加发布目标
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" align="start" className="w-52">
                      <DropdownMenuItem disabled={github.added || github.busy} onSelect={github.connect}>
                        <GitBranch />
                        <span>GitHub</span>
                        {github.added ? <CircleCheck className="ml-auto" aria-label="已添加" /> : null}
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={hasSavedApiKey} onSelect={openMowenDialog}>
                        <NotebookPen />
                        <span>墨问笔记</span>
                        {hasSavedApiKey ? <CircleCheck className="ml-auto" aria-label="已添加" /> : null}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </section>

              {github.added ? (
                <SettingsSection title="GitHub 发布目标">
                  {githubBlogTargets(publishingTargets).map((target) => (
                    <GitHubBlogTargetSettings
                      key={target.id}
                      target={target}
                      targetsReady={publishingTargetsReady}
                      targetsError={publishingTargetsError}
                      onSave={onSavePublishingTarget}
                    />
                  ))}
                </SettingsSection>
              ) : null}
            </div>

            <Dialog open={mowenDialogOpen} onOpenChange={(open) => validationState !== "validating" && setMowenDialogOpen(open)}>
              <DialogContent className="sm:max-w-lg">
                <form
                  className="grid gap-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void validateApiKey();
                  }}
                >
                  <DialogHeader>
                    <DialogTitle>{hasSavedApiKey ? "替换墨问 API Key" : "添加墨问笔记"}</DialogTitle>
                    <DialogDescription>API Key 验证成功后会保存在此设备的落笔应用配置中，不会回填明文。</DialogDescription>
                  </DialogHeader>

                  <label className="grid gap-2 text-xs font-semibold text-muted-foreground">
                    <span>API Key</span>
                    <span className="relative block">
                      <Input
                        className="pr-8.5"
                        type="password"
                        value={apiKey}
                        autoComplete="new-password"
                        placeholder={hasSavedApiKey ? "输入新的墨问 API Key" : "输入墨问 API Key"}
                        disabled={!desktopAvailable || validationState === "validating"}
                        autoFocus
                        onChange={(event) => {
                          setApiKey(event.target.value);
                          setValidationState("idle");
                          setValidationMessage("");
                        }}
                      />
                      {validationState === "valid" ? (
                        <CheckCircle2
                          className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-status-success"
                          size={17}
                          aria-label="API Key 已验证并保存"
                        />
                      ) : null}
                      {validationState === "invalid" ? (
                        <CircleX
                          className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-destructive"
                          size={17}
                          aria-label="API Key 无效"
                        />
                      ) : null}
                    </span>
                  </label>

                  {validationMessage ? (
                    <p className="m-0 text-xs leading-5 text-destructive" role="alert">
                      {validationMessage}
                    </p>
                  ) : null}

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={validationState === "validating"}
                      onClick={() => setMowenDialogOpen(false)}
                    >
                      取消
                    </Button>
                    <Button type="submit" disabled={!desktopAvailable || validationState === "validating" || !apiKey.trim()}>
                      {validationState === "validating" ? "验证中…" : "验证并添加"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <ConfirmDialog
              open={removeTarget === "github"}
              title="断开 GitHub？"
              message="断开后将隐藏 GitHub 发布目标；已有仓库、分支和站点配置会保留，重新连接后可继续使用。"
              confirmLabel="断开"
              destructive
              onCancel={() => setRemoveTarget(null)}
              onConfirm={() => {
                setRemoveTarget(null);
                github.disconnect();
              }}
            />

            <ConfirmDialog
              open={removeTarget === "mowen"}
              title="移除墨问笔记？"
              message="移除后会删除此设备保存的墨问 API Key；以后仍可重新添加。"
              confirmLabel="移除"
              destructive
              onCancel={() => setRemoveTarget(null)}
              onConfirm={() => void removeMowenTarget()}
            />
          </>
        );
      }}
    </GitHubConnectionSettings>
  );
}

function PublishingTargetRow({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <SettingsListRow className="flex min-h-12 items-center justify-between gap-3 px-3 py-2.25">
      <span className="min-w-0 truncate text-[13px] font-medium text-foreground">{name}</span>
      <div className="flex shrink-0 items-center">{children}</div>
    </SettingsListRow>
  );
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
