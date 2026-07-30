/**
 * [INPUT]: 依赖 shadcn/ui、React、GitHub 身份控制器、墨问/微信公众号凭证 command、图床服务目录、应用级 GitHub 发布目标与设置列表基础组件
 * [OUTPUT]: 对外提供 PublishingSettingsPanel，在同一发布页面管理 GitHub、墨问、微信公众号发布目标、GitHub 子目标与图床服务
 * [POS]: settings feature 的发布设置编排层，分离渠道接入、微信公众号本机配置、GitHub 通用适配器与图片托管配置
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
  deleteWechatDraftSettings,
  deletePublishingSecret,
  hasPublishingSecret,
  isDesktopPublishingAvailable,
  loadWechatDraftSettings,
  saveWechatDraftSettings,
  savePublishingSecret,
  validateMowenApiKey,
  validateSavedMowenApiKey,
  validateWechatDraftConnection,
  type WechatDraftSettings,
} from "@/features/publishing/model/api";
import {
  createDefaultGitHubBlogTarget,
  createDefaultGitHubDocsTarget,
  githubPublishingTargets,
  type PublishingTarget,
  type PublishingTargetStore,
} from "@/features/publishing/model/publishingTargets";
import { GitHubTargetDialog, GitHubTargetSettings } from "@/features/settings/components/GitHubTargetSettings";
import { GitHubConnectionSettings } from "@/features/settings/components/GitHubConnectionSettings";
import { ImageHostingSettingsPanel } from "@/features/settings/components/ImageHostingSettingsPanel";
import { SettingsListRow, SettingsSectionHeader } from "@/features/settings/components/SettingsControls";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { showAppToast } from "@/shared/lib/appToast";
import {
  CheckCircle2,
  CircleCheck,
  CircleX,
  Eye,
  EyeOff,
  ExternalLink,
  GitBranch,
  KeyRound,
  MoreHorizontal,
  NotebookPen,
  Newspaper,
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
  onSavePublishingTarget: (target: PublishingTarget) => Promise<unknown>;
}

type RemoveTarget = "github" | "mowen" | "wechat" | null;

export function PublishingSettingsPanel({
  publishingTargets,
  publishingTargetsReady,
  publishingTargetsError,
  onSavePublishingTarget,
}: PublishingSettingsPanelProps) {
  const desktopAvailable = isDesktopPublishingAvailable();
  const [apiKey, setApiKey] = useState("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [hasSavedApiKey, setHasSavedApiKey] = useState(false);
  const [mowenDialogOpen, setMowenDialogOpen] = useState(false);
  const [wechatSettings, setWechatSettings] = useState<WechatDraftSettings>({ appId: "", hasAppSecret: false, configured: false });
  const [wechatDialogOpen, setWechatDialogOpen] = useState(false);
  const [wechatAppId, setWechatAppId] = useState("");
  const [wechatAppSecret, setWechatAppSecret] = useState("");
  const [wechatSecretVisible, setWechatSecretVisible] = useState(false);
  const [wechatState, setWechatState] = useState<"loading" | "idle" | "saving" | "validating" | "error">(
    desktopAvailable ? "loading" : "idle",
  );
  const [wechatMessage, setWechatMessage] = useState("");
  const [newGitHubTarget, setNewGitHubTarget] = useState<PublishingTarget | null>(null);
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget>(null);
  const [imageHostingDetailOpen, setImageHostingDetailOpen] = useState(false);
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

  useEffect(() => {
    if (!desktopAvailable) return;
    let cancelled = false;
    setWechatState("loading");
    setWechatMessage("");
    void loadWechatDraftSettings()
      .then((settings) => {
        if (cancelled) return;
        setWechatSettings(settings);
        setWechatState("idle");
      })
      .catch((cause) => {
        if (cancelled) return;
        setWechatState("error");
        setWechatMessage(`无法读取微信公众号发布目标：${errorMessage(cause)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [desktopAvailable]);

  function openMowenDialog() {
    setApiKey("");
    setApiKeyVisible(false);
    setValidationState("idle");
    setValidationMessage("");
    setMowenDialogOpen(true);
  }

  function openWechatDialog() {
    setWechatAppId(wechatSettings.appId);
    setWechatAppSecret("");
    setWechatSecretVisible(false);
    setWechatMessage("");
    setWechatState("idle");
    setWechatDialogOpen(true);
  }

  async function saveWechatTarget() {
    if (!wechatAppId.trim() || (!wechatSettings.hasAppSecret && !wechatAppSecret.trim()) || !desktopAvailable) return;
    setWechatState("saving");
    setWechatMessage("");
    try {
      const settings = await saveWechatDraftSettings({ appId: wechatAppId.trim(), appSecret: wechatAppSecret.trim() || undefined });
      setWechatSettings(settings);
      setWechatAppSecret("");
      setWechatSecretVisible(false);
      setWechatState("idle");
      setWechatDialogOpen(false);
      showAppToast({
        variant: "success",
        title: "微信公众号已添加",
        description: "请把当前网络的公网 IP 加入公众号白名单，再到公众号预览推送草稿。",
      });
    } catch (cause) {
      setWechatState("error");
      setWechatMessage(errorMessage(cause));
    }
  }

  async function validateWechatTarget() {
    setWechatState("validating");
    try {
      await validateWechatDraftConnection();
      setWechatState("idle");
      showAppToast({ variant: "success", title: "微信公众号连接有效", description: "当前网络 IP 已通过公众号白名单验证。" });
    } catch (cause) {
      setWechatState("idle");
      showAppToast({ variant: "error", title: "微信公众号连接验证失败", description: errorMessage(cause) });
    }
  }

  async function removeWechatTarget() {
    setRemoveTarget(null);
    try {
      await deleteWechatDraftSettings();
      setWechatSettings({ appId: "", hasAppSecret: false, configured: false });
      setWechatAppId("");
      setWechatAppSecret("");
      setWechatState("idle");
      showAppToast({ variant: "success", title: "微信公众号已移除", description: "本机保存的 AppID 和 AppSecret 已删除。" });
    } catch (cause) {
      showAppToast({ variant: "error", title: "微信公众号移除失败", description: errorMessage(cause) });
    }
  }

  async function validateApiKey() {
    const value = apiKey.trim();
    if (!value || !desktopAvailable) return;
    const replacingSavedApiKey = hasSavedApiKey;
    setValidationState("validating");
    setValidationMessage("");
    try {
      await validateMowenApiKey(value);
      await savePublishingSecret("mowen", MOWEN_ACCOUNT, value);
      setApiKey("");
      setApiKeyVisible(false);
      setHasSavedApiKey(true);
      setValidationState("valid");
      setMowenDialogOpen(false);
      showAppToast({
        variant: "success",
        title: replacingSavedApiKey ? "墨问 API Key 已更新" : "墨问笔记已添加",
        description: "现在可以从文稿发布菜单使用墨问笔记。",
      });
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
      setApiKeyVisible(false);
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
        const directoryLoading = github.loading || validationState === "loading" || wechatState === "loading";
        const hasDirectoryTargets = github.added || hasSavedApiKey || wechatSettings.configured;
        const directoryError = validationState === "error" ? validationMessage : wechatState === "error" ? wechatMessage : "";
        const savedGitHubTargets = githubPublishingTargets(publishingTargets);

        return (
          <>
            <div className="grid gap-6">
              <div data-publishing-directory="" className={imageHostingDetailOpen ? "hidden" : "contents"}>
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
                                  <span>设置 API Key</span>
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

                        {wechatSettings.configured ? (
                          <PublishingTargetRow name="微信公众号">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button type="button" variant="ghost" size="icon-sm" aria-label="微信公众号发布目标操作">
                                  <MoreHorizontal />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem disabled={wechatState === "validating"} onSelect={() => void validateWechatTarget()}>
                                  <ShieldCheck className={wechatState === "validating" ? "animate-pulse" : undefined} />
                                  <span>{wechatState === "validating" ? "正在验证…" : "验证连接"}</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={openWechatDialog}>
                                  <KeyRound />
                                  <span>设置 AppID / AppSecret</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onSelect={() => setRemoveTarget("wechat")}>
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
                        <DropdownMenuItem disabled={wechatSettings.configured} onSelect={openWechatDialog}>
                          <Newspaper />
                          <span>微信公众号</span>
                          {wechatSettings.configured ? <CircleCheck className="ml-auto" aria-label="已添加" /> : null}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </section>

                {github.added ? (
                  <section className="flex flex-col gap-2">
                    <SettingsSectionHeader title="GitHub 发布目标" />
                    <div className="overflow-hidden rounded-lg border border-[var(--settings-dialog-divider)] bg-[var(--settings-dialog-section-background)]">
                      {savedGitHubTargets.length > 0 ? (
                        savedGitHubTargets.map((target) => (
                          <GitHubTargetSettings
                            key={target.id}
                            target={target}
                            targetsReady={publishingTargetsReady}
                            targetsError={publishingTargetsError}
                            onSave={onSavePublishingTarget}
                          />
                        ))
                      ) : (
                        <div className="px-3 py-7 text-center text-xs leading-5 text-muted-foreground">
                          {publishingTargetsReady ? "尚未添加 GitHub 发布目标。" : "正在读取 GitHub 发布目标…"}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-start">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="outline" size="sm">
                            <Plus />
                            添加 GitHub 发布目标
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="top" align="start" className="w-60">
                          <DropdownMenuItem
                            disabled={!publishingTargetsReady}
                            onSelect={() => setNewGitHubTarget(createDefaultGitHubBlogTarget())}
                          >
                            <span>Hugo 博客</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!publishingTargetsReady}
                            onSelect={() => setNewGitHubTarget(createDefaultGitHubDocsTarget())}
                          >
                            <span>Starlight 文档站</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </section>
                ) : null}
              </div>

              <ImageHostingSettingsPanel onDetailViewChange={setImageHostingDetailOpen} />
            </div>

            {newGitHubTarget ? (
              <GitHubTargetDialog
                target={newGitHubTarget}
                open
                targetsReady={publishingTargetsReady}
                targetsError={publishingTargetsError}
                onOpenChange={(open) => !open && setNewGitHubTarget(null)}
                onSave={onSavePublishingTarget}
              />
            ) : null}

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
                    <DialogTitle>设置墨问 API Key</DialogTitle>
                    <DialogDescription className="sr-only">设置或替换用于墨问笔记发布的 API Key。</DialogDescription>
                  </DialogHeader>

                  <label className="grid gap-2 text-xs font-semibold text-muted-foreground">
                    <span>API Key</span>
                    <span className="relative block">
                      <Input
                        className="pr-18"
                        type={apiKeyVisible ? "text" : "password"}
                        value={apiKey}
                        autoComplete="new-password"
                        placeholder={hasSavedApiKey ? "••••••••••••" : "输入墨问 API Key"}
                        disabled={!desktopAvailable || validationState === "validating"}
                        autoFocus
                        onChange={(event) => {
                          const nextApiKey = event.target.value;
                          setApiKey(nextApiKey);
                          if (!nextApiKey) setApiKeyVisible(false);
                          setValidationState("idle");
                          setValidationMessage("");
                        }}
                      />
                      {validationState === "valid" ? (
                        <CheckCircle2
                          className="pointer-events-none absolute top-1/2 right-10 -translate-y-1/2 text-status-success"
                          size={17}
                          aria-label="API Key 已验证并保存"
                        />
                      ) : null}
                      {validationState === "invalid" ? (
                        <CircleX
                          className="pointer-events-none absolute top-1/2 right-10 -translate-y-1/2 text-destructive"
                          size={17}
                          aria-label="API Key 无效"
                        />
                      ) : null}
                      <button
                        type="button"
                        className="absolute top-1/2 right-2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
                        disabled={!apiKey || validationState === "validating"}
                        aria-label={apiKeyVisible ? "隐藏 API Key" : "显示 API Key"}
                        title={apiKeyVisible ? "隐藏 API Key" : "显示 API Key"}
                        onClick={() => setApiKeyVisible((visible) => !visible)}
                      >
                        {apiKeyVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
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
                      {validationState === "validating" ? "验证中…" : hasSavedApiKey ? "验证并保存" : "验证并添加"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={wechatDialogOpen} onOpenChange={(open) => wechatState !== "saving" && setWechatDialogOpen(open)}>
              <DialogContent className="sm:max-w-lg">
                <form
                  className="grid gap-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveWechatTarget();
                  }}
                >
                  <DialogHeader>
                    <DialogTitle>设置微信公众号</DialogTitle>
                    <DialogDescription>填写微信开发者平台中的 AppID 和 AppSecret。保存不会联网验证。</DialogDescription>
                  </DialogHeader>

                  <label className="grid gap-2 text-xs font-semibold text-muted-foreground">
                    <span>AppID</span>
                    <Input
                      value={wechatAppId}
                      autoComplete="off"
                      placeholder="输入公众号 AppID"
                      disabled={!desktopAvailable || wechatState === "saving"}
                      autoFocus
                      onChange={(event) => {
                        setWechatAppId(event.target.value);
                        setWechatMessage("");
                      }}
                    />
                  </label>

                  <label className="grid gap-2 text-xs font-semibold text-muted-foreground">
                    <span>AppSecret</span>
                    <span className="relative block">
                      <Input
                        className="pr-12"
                        type={wechatSecretVisible ? "text" : "password"}
                        value={wechatAppSecret}
                        autoComplete="new-password"
                        placeholder={wechatSettings.hasAppSecret ? "••••••••••••（留空保持不变）" : "输入公众号 AppSecret"}
                        disabled={!desktopAvailable || wechatState === "saving"}
                        onChange={(event) => {
                          const value = event.target.value;
                          setWechatAppSecret(value);
                          if (!value) setWechatSecretVisible(false);
                          setWechatMessage("");
                        }}
                      />
                      <button
                        type="button"
                        className="absolute top-1/2 right-2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
                        disabled={!wechatAppSecret || wechatState === "saving"}
                        aria-label={wechatSecretVisible ? "隐藏 AppSecret" : "显示 AppSecret"}
                        onClick={() => setWechatSecretVisible((visible) => !visible)}
                      >
                        {wechatSecretVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </span>
                  </label>

                  <p className="m-0 text-xs leading-5 text-muted-foreground">
                    Loby 不提供固定出口。换网络后，请前往“微信开发者平台 → 域名与消息推送配置 → IP 白名单”添加新的公网 IP。
                  </p>
                  {wechatMessage ? (
                    <p className="m-0 text-xs leading-5 text-destructive" role="alert">
                      {wechatMessage}
                    </p>
                  ) : null}

                  <DialogFooter>
                    <Button type="button" variant="outline" disabled={wechatState === "saving"} onClick={() => setWechatDialogOpen(false)}>
                      取消
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        !desktopAvailable ||
                        wechatState === "saving" ||
                        !wechatAppId.trim() ||
                        (!wechatSettings.hasAppSecret && !wechatAppSecret.trim())
                      }
                    >
                      {wechatState === "saving" ? "保存中…" : "保存"}
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

            <ConfirmDialog
              open={removeTarget === "wechat"}
              title="移除微信公众号？"
              message="移除后会删除此设备保存的 AppID 和 AppSecret；写作文件中的草稿身份记录会保留，重新配置同一公众号后仍可继续更新。"
              confirmLabel="移除"
              destructive
              onCancel={() => setRemoveTarget(null)}
              onConfirm={() => void removeWechatTarget()}
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
