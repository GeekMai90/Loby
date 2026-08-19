/**
 * [INPUT]: 依赖设置 rows、Toggle/Select、Button/Input、Dialog/DropdownMenu、AI 连接目录与 media feature 的 Unsplash/百度翻译 native command
 * [OUTPUT]: 对外提供在线图片设置区、Unsplash API 设置小窗与百度翻译服务设置小窗，按真实服务状态控制 AI/百度翻译选项，同时保持偏好值与实际运行时兜底语义一致
 * [POS]: settings feature 的写作设置子区；只持有表单临时明文，AI 推荐偏好由 app 持久化，不把 Key 写入 renderer 持久化或返回给其他组件
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
import { SettingsListRow, SettingsSection, SettingsSelect, SettingsToggle } from "@/features/settings/components/SettingsControls";
import { deleteUnsplashApiKey, getUnsplashSettings, saveUnsplashApiKey, validateUnsplashApiKey } from "@/features/media/model/unsplash";
import {
  deleteBaiduTranslationCredentials,
  getBaiduTranslationSettings,
  saveBaiduTranslationCredentials,
  validateBaiduTranslationCredentials,
  type SaveBaiduTranslationCredentialsInput,
} from "@/features/media/model/translation";
import { hasConfiguredAgentConnection } from "@/features/assistant/model/agentConnectionDirectory";
import { AGENT_CREDENTIALS_CHANGED_EVENT } from "@/features/assistant/model/agentCredentialEvents";
import type { UnsplashSearchTranslationProvider } from "@/shared/types";
import { Eye, EyeOff, KeyRound, Loader2, MoreHorizontal, Settings2, ShieldCheck, Trash2 } from "lucide-react";
import { showAppToast } from "@/shared/lib/appToast";
import { useEffect, useState, type FormEvent } from "react";

type UnsplashAction = "idle" | "loading" | "saving" | "validating" | "deleting" | "error";
type BaiduAction = "idle" | "loading" | "saving" | "validating" | "deleting" | "error";
type AiAvailability = "loading" | "available" | "unavailable";
type SelectableTranslationProvider = Exclude<UnsplashSearchTranslationProvider, "auto">;

function translationProviderOptions(aiAvailable: boolean, baiduAvailable: boolean) {
  return [
    { value: "ai" as const, label: "AI 翻译", disabled: !aiAvailable },
    { value: "baidu" as const, label: "百度翻译", disabled: !baiduAvailable },
  ] satisfies Array<{ value: SelectableTranslationProvider; label: string; disabled: boolean }>;
}

function normalizeTranslationProvider(provider: UnsplashSearchTranslationProvider): SelectableTranslationProvider {
  return provider === "baidu" ? "baidu" : "ai";
}

interface UnsplashSettingsSectionProps {
  aiRecommendationEnabled: boolean;
  onAiRecommendationEnabledChange: (enabled: boolean) => void;
  translationEnabled: boolean;
  translationProvider: UnsplashSearchTranslationProvider;
  onTranslationEnabledChange: (enabled: boolean) => void;
  onTranslationProviderChange: (provider: UnsplashSearchTranslationProvider) => void;
}

export function UnsplashSettingsSection({
  aiRecommendationEnabled,
  onAiRecommendationEnabledChange,
  translationEnabled,
  translationProvider,
  onTranslationEnabledChange,
  onTranslationProviderChange,
}: UnsplashSettingsSectionProps) {
  const desktopAvailable = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  const [apiDialogOpen, setApiDialogOpen] = useState(false);
  const [hasSavedApiKey, setHasSavedApiKey] = useState(false);
  const [action, setAction] = useState<UnsplashAction>("loading");
  const [aiAvailability, setAiAvailability] = useState<AiAvailability>(desktopAvailable ? "loading" : "unavailable");
  const [baiduDialogOpen, setBaiduDialogOpen] = useState(false);
  const [hasSavedBaiduCredentials, setHasSavedBaiduCredentials] = useState(false);
  const [baiduConnectionValidated, setBaiduConnectionValidated] = useState(false);
  const [baiduAction, setBaiduAction] = useState<BaiduAction>("loading");

  useEffect(() => {
    let cancelled = false;
    void getUnsplashSettings()
      .then((settings) => {
        if (cancelled) return;
        setHasSavedApiKey(settings.configured);
        setAction("idle");
      })
      .catch((cause) => {
        if (cancelled) return;
        setAction("error");
        showAppToast({ variant: "error", title: "Unsplash 状态读取失败", description: errorMessage(cause) });
      });
    void getBaiduTranslationSettings()
      .then((settings) => {
        if (cancelled) return;
        setHasSavedBaiduCredentials(settings.configured);
        setBaiduConnectionValidated(false);
        setBaiduAction("idle");
      })
      .catch((cause) => {
        if (cancelled) return;
        setBaiduAction("error");
        showAppToast({ variant: "error", title: "百度翻译状态读取失败", description: errorMessage(cause) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!desktopAvailable) {
      setAiAvailability("unavailable");
      return;
    }

    let cancelled = false;
    let refreshSequence = 0;
    const refreshAiAvailability = () => {
      const sequence = ++refreshSequence;
      setAiAvailability("loading");
      void hasConfiguredAgentConnection()
        .then((available) => {
          if (!cancelled && sequence === refreshSequence) setAiAvailability(available ? "available" : "unavailable");
        })
        .catch(() => {
          if (!cancelled && sequence === refreshSequence) setAiAvailability("unavailable");
        });
    };

    refreshAiAvailability();
    window.addEventListener(AGENT_CREDENTIALS_CHANGED_EVENT, refreshAiAvailability);
    return () => {
      cancelled = true;
      window.removeEventListener(AGENT_CREDENTIALS_CHANGED_EVENT, refreshAiAvailability);
    };
  }, [desktopAvailable]);

  function handleAiRecommendationChange(enabled: boolean) {
    if (enabled && aiAvailability !== "available") {
      showAppToast({
        variant: "error",
        title: "无法启用 AI 推荐",
        description: aiAvailability === "loading" ? "正在读取 AI 服务状态，请稍后再试。" : "请先在“AI”设置中配置一个可用的大模型服务。",
      });
      return;
    }
    onAiRecommendationEnabledChange(enabled);
  }

  async function saveKey(value: string): Promise<boolean> {
    const normalizedValue = value.trim();
    if (!normalizedValue || !desktopAvailable) return false;
    setAction("saving");
    try {
      const settings = await saveUnsplashApiKey(normalizedValue);
      setHasSavedApiKey(settings.configured);
      setAction("idle");
      showAppToast({ variant: "success", title: "Unsplash API 已保存", description: "保存不会自动联网验证。" });
      return true;
    } catch (cause) {
      setAction("error");
      showAppToast({ variant: "error", title: "Unsplash API 保存失败", description: errorMessage(cause) });
      return false;
    }
  }

  async function validateKey() {
    if (!hasSavedApiKey || !desktopAvailable) return;
    setAction("validating");
    try {
      await validateUnsplashApiKey();
      setAction("idle");
      showAppToast({ variant: "success", title: "Unsplash 连接有效", description: "现在可以开始在线搜索。" });
    } catch (cause) {
      setAction("error");
      showAppToast({ variant: "error", title: "Unsplash 连接验证失败", description: errorMessage(cause) });
    }
  }

  async function removeKey() {
    if (!hasSavedApiKey || !desktopAvailable) return;
    setAction("deleting");
    try {
      await deleteUnsplashApiKey();
      setHasSavedApiKey(false);
      setAction("idle");
      showAppToast({ variant: "success", title: "Unsplash API 已删除", description: "已从本机应用配置中移除。" });
    } catch (cause) {
      setAction("error");
      showAppToast({ variant: "error", title: "Unsplash API 删除失败", description: errorMessage(cause) });
    }
  }

  async function saveBaiduCredentials(input: SaveBaiduTranslationCredentialsInput): Promise<boolean> {
    if (!desktopAvailable || (!input.appId.trim() && !input.secretKey.trim())) return false;
    setBaiduAction("saving");
    try {
      const settings = await saveBaiduTranslationCredentials(input);
      setHasSavedBaiduCredentials(settings.configured);
      setBaiduConnectionValidated(false);
      setBaiduAction("idle");
      showAppToast({ variant: "success", title: "百度翻译凭证已保存", description: "请从更多菜单验证连接后再选择百度翻译。" });
      return true;
    } catch (cause) {
      setBaiduAction("error");
      showAppToast({ variant: "error", title: "百度翻译凭证保存失败", description: errorMessage(cause) });
      return false;
    }
  }

  async function validateBaiduCredentials() {
    if (!hasSavedBaiduCredentials || !desktopAvailable) return;
    setBaiduAction("validating");
    try {
      await validateBaiduTranslationCredentials();
      setBaiduConnectionValidated(true);
      setBaiduAction("idle");
      showAppToast({ variant: "success", title: "百度翻译连接有效", description: "现在可以选择百度翻译服务。" });
    } catch (cause) {
      setBaiduConnectionValidated(false);
      setBaiduAction("error");
      showAppToast({ variant: "error", title: "百度翻译连接验证失败", description: errorMessage(cause) });
    }
  }

  async function removeBaiduCredentials() {
    if (!hasSavedBaiduCredentials || !desktopAvailable) return;
    setBaiduAction("deleting");
    try {
      await deleteBaiduTranslationCredentials();
      setHasSavedBaiduCredentials(false);
      setBaiduConnectionValidated(false);
      setBaiduAction("idle");
      showAppToast({ variant: "success", title: "百度翻译配置已删除", description: "已从本机应用配置中移除。" });
    } catch (cause) {
      setBaiduAction("error");
      showAppToast({ variant: "error", title: "百度翻译配置删除失败", description: errorMessage(cause) });
    }
  }

  const busy = action === "loading" || action === "saving" || action === "validating" || action === "deleting";
  const baiduBusy = baiduAction === "loading" || baiduAction === "saving" || baiduAction === "validating" || baiduAction === "deleting";
  const aiTranslationAvailable = aiAvailability === "available";
  const translationOptions = translationProviderOptions(aiTranslationAvailable, baiduConnectionValidated);
  const selectedTranslationProvider = normalizeTranslationProvider(translationProvider);

  return (
    <SettingsSection title="在线图片库" description="在线搜索 Unsplash 图片库并插入文章">
      <SettingsListRow className="flex min-h-12 items-center justify-between gap-3 px-3 py-2.25">
        <span className="min-w-0 truncate text-[13px] font-medium text-foreground">Unsplash 图片库</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" disabled={!desktopAvailable || busy} aria-label="Unsplash 图片库操作">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={() => setApiDialogOpen(true)}>
              <Settings2 />
              <span>设置 API</span>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!hasSavedApiKey || busy} onSelect={() => void validateKey()}>
              <ShieldCheck />
              <span>{action === "validating" ? "正在验证…" : "验证连接"}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={!hasSavedApiKey || busy} onSelect={() => void removeKey()}>
              <Trash2 />
              <span>删除配置</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SettingsListRow>
      <SettingsToggle
        label="使用 AI 推荐搜索词"
        description="进入 Unsplash 图库时，AI 会先分析当前文章并使用推荐词进行搜索；关闭、未配置 AI 或推荐失败时，展示横版随机图片。"
        checked={aiRecommendationEnabled && aiAvailability !== "unavailable"}
        onChange={handleAiRecommendationChange}
      />
      <SettingsToggle
        label="中文搜索词自动翻译"
        description="输入中文关键词时，先翻译成英文再搜索 Unsplash；英文关键词不会触发翻译。"
        checked={translationEnabled}
        onChange={onTranslationEnabledChange}
      />
      {translationEnabled && (
        <SettingsSelect
          label="翻译服务"
          description="选择用于中文搜索词的翻译服务。"
          value={selectedTranslationProvider}
          options={translationOptions}
          width="fit"
          contentAlign="end"
          onChange={(provider) => onTranslationProviderChange(provider)}
        />
      )}
      {translationEnabled && (
        <SettingsListRow className="flex min-h-12 items-center justify-between gap-3 px-3 py-2.25">
          <span className="min-w-0 truncate text-[13px] font-medium text-foreground">百度翻译服务</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" disabled={!desktopAvailable || baiduBusy} aria-label="百度翻译服务操作">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => setBaiduDialogOpen(true)}>
                <Settings2 />
                <span>设置 API</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!hasSavedBaiduCredentials || baiduBusy} onSelect={() => void validateBaiduCredentials()}>
                <ShieldCheck />
                <span>{baiduAction === "validating" ? "正在验证…" : "验证连接"}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={!hasSavedBaiduCredentials || baiduBusy}
                onSelect={() => void removeBaiduCredentials()}
              >
                <Trash2 />
                <span>删除配置</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SettingsListRow>
      )}
      {!desktopAvailable && <p className="m-0 px-3 pb-2 text-xs leading-5 text-muted-foreground">在线图片功能需要在落笔桌面应用中使用。</p>}
      <UnsplashApiDialog
        open={apiDialogOpen}
        hasSavedApiKey={hasSavedApiKey}
        busy={busy}
        onOpenChange={setApiDialogOpen}
        onSave={saveKey}
      />
      {translationEnabled && (
        <BaiduTranslationDialog
          open={baiduDialogOpen}
          hasSavedCredentials={hasSavedBaiduCredentials}
          busy={baiduBusy}
          onOpenChange={setBaiduDialogOpen}
          onSave={saveBaiduCredentials}
        />
      )}
    </SettingsSection>
  );
}

function UnsplashApiDialog({
  open,
  hasSavedApiKey,
  busy,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  hasSavedApiKey: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (value: string) => Promise<boolean>;
}) {
  const [apiKey, setApiKey] = useState("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);

  useEffect(() => {
    if (!open) return;
    setApiKey("");
    setApiKeyVisible(false);
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiKey.trim() || busy) return;
    const saved = await onSave(apiKey);
    if (saved) {
      setApiKey("");
      setApiKeyVisible(false);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}>
      <DialogContent showCloseButton={false} className="sm:max-w-120">
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>设置 Unsplash API</DialogTitle>
            <DialogDescription>API Key 只保存在本机应用配置中，不会写入文章或上传到服务器。</DialogDescription>
          </DialogHeader>
          <label className="flex flex-col gap-2 text-body font-medium text-foreground">
            <span>Unsplash API Key</span>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pr-10 pl-9"
                type={apiKeyVisible ? "text" : "password"}
                value={apiKey}
                placeholder={hasSavedApiKey ? "已配置，输入新 Key 可替换" : "输入 Unsplash API Key"}
                autoComplete="off"
                disabled={busy}
                autoFocus
                onChange={(event) => {
                  setApiKey(event.target.value);
                  if (!event.target.value) setApiKeyVisible(false);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                disabled={!apiKey || busy}
                aria-label={apiKeyVisible ? "隐藏 Unsplash API Key" : "显示 Unsplash API Key"}
                title={apiKeyVisible ? "隐藏 API Key" : "显示 API Key"}
                onClick={() => setApiKeyVisible((visible) => !visible)}
              >
                {apiKeyVisible ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={busy || !apiKey.trim()}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              {busy ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BaiduTranslationDialog({
  open,
  hasSavedCredentials,
  busy,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  hasSavedCredentials: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: SaveBaiduTranslationCredentialsInput) => Promise<boolean>;
}) {
  const [appId, setAppId] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [secretKeyVisible, setSecretKeyVisible] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAppId("");
    setSecretKey("");
    setSecretKeyVisible(false);
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((!appId.trim() && !secretKey.trim()) || busy) return;
    const saved = await onSave({ appId, secretKey });
    if (saved) {
      setAppId("");
      setSecretKey("");
      setSecretKeyVisible(false);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}>
      <DialogContent showCloseButton={false} className="sm:max-w-120">
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>设置百度翻译服务</DialogTitle>
            <DialogDescription>App ID 和密钥只保存在本机应用配置中。保存后请从更多菜单验证连接。</DialogDescription>
          </DialogHeader>
          <label className="flex flex-col gap-2 text-body font-medium text-foreground">
            <span>百度翻译 App ID</span>
            <Input
              className="h-9"
              type="text"
              value={appId}
              placeholder={hasSavedCredentials ? "已配置，输入新 App ID 可替换" : "输入 App ID"}
              autoComplete="off"
              disabled={busy}
              autoFocus
              onChange={(event) => setAppId(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2 text-body font-medium text-foreground">
            <span>百度翻译密钥</span>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pr-10 pl-9"
                type={secretKeyVisible ? "text" : "password"}
                value={secretKey}
                placeholder={hasSavedCredentials ? "已配置，输入新密钥可替换" : "输入 Secret Key"}
                autoComplete="off"
                disabled={busy}
                onChange={(event) => {
                  setSecretKey(event.target.value);
                  if (!event.target.value) setSecretKeyVisible(false);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                disabled={!secretKey || busy}
                aria-label={secretKeyVisible ? "隐藏百度翻译密钥" : "显示百度翻译密钥"}
                title={secretKeyVisible ? "隐藏密钥" : "显示密钥"}
                onClick={() => setSecretKeyVisible((visible) => !visible)}
              >
                {secretKeyVisible ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={busy || (!appId.trim() && !secretKey.trim())}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              {busy ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
