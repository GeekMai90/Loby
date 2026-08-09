/**
 * [INPUT]: 依赖 shadcn/ui 基础控件、lucide-react、React 运行时、发布领域的图床配置与设置列表基础组件
 * [OUTPUT]: 对外提供 ImageHostingSettingsPanel，以“图床服务”目录管理已配置服务并在同一内容区进入阿里云 OSS 二级设置
 * [POS]: settings feature 的图床设置编排层；在组件内存中承接用户已保存的 Secret 回填值，不复制凭证存储或完整性判定
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { isDesktopPublishingAvailable } from "@/features/publishing/model/api";
import {
  DEFAULT_WECHAT_IMAGE_HOST_SETTINGS,
  loadWechatImageHostSettings,
  saveWechatImageHostSettings,
  type WechatImageHostSettings,
} from "@/features/publishing/model/wechatImageHost";
import {
  SettingsActionRow,
  SettingsListRow,
  SettingsRow,
  SettingsSection,
  SettingsSectionHeader,
} from "@/features/settings/components/SettingsControls";
import { CheckCircle2, ChevronLeft, ChevronRight, CircleCheck, CircleX, Eye, EyeOff, Plus } from "lucide-react";
import { useEffect, useState } from "react";

type SaveState = "idle" | "loading" | "saving" | "saved" | "error";
type ImageHostingSettingsPage = "main" | "aliyun";

interface ImageHostingSettingsPanelProps {
  onDetailViewChange?: (open: boolean) => void;
}

export function ImageHostingSettingsPanel({ onDetailViewChange }: ImageHostingSettingsPanelProps = {}) {
  const desktopAvailable = isDesktopPublishingAvailable();
  const [settingsPage, setSettingsPage] = useState<ImageHostingSettingsPage>("main");
  const [settings, setSettings] = useState<WechatImageHostSettings>(DEFAULT_WECHAT_IMAGE_HOST_SETTINGS);
  const [accessKeySecret, setAccessKeySecret] = useState("");
  const [accessKeySecretVisible, setAccessKeySecretVisible] = useState(false);
  const [hasSavedSecret, setHasSavedSecret] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>(desktopAvailable ? "loading" : "idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!desktopAvailable) return;
    let cancelled = false;
    void loadWechatImageHostSettings()
      .then((result) => {
        if (cancelled) return;
        setSettings(result.settings);
        setAccessKeySecret(result.accessKeySecret ?? "");
        setAccessKeySecretVisible(false);
        setHasSavedSecret(result.hasAccessKeySecret);
        setConfigured(result.configured);
        setSaveState("idle");
      })
      .catch((cause) => {
        if (cancelled) return;
        setSaveState("error");
        setMessage(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [desktopAvailable]);

  function updateSetting<Key extends keyof WechatImageHostSettings>(key: Key, value: WechatImageHostSettings[Key]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaveState("idle");
    setMessage("");
  }

  async function saveSettings() {
    if (!canSave) return;
    setSaveState("saving");
    setMessage("");
    try {
      const result = await saveWechatImageHostSettings(settings, accessKeySecret);
      setSettings(result.settings);
      setAccessKeySecret(result.accessKeySecret ?? "");
      setAccessKeySecretVisible(false);
      setHasSavedSecret(result.hasAccessKeySecret);
      setConfigured(result.configured);
      setSaveState("saved");
      setMessage(result.configured ? "图床设置已保存" : "设置已保存，但还需要填写 Access Key Secret");
    } catch (cause) {
      setSaveState("error");
      setMessage(cause instanceof Error ? cause.message : String(cause));
    }
  }

  const requiredFieldsReady = Boolean(settings.region.trim() && settings.bucket.trim() && settings.accessKeyId.trim());
  const canSave =
    desktopAvailable &&
    saveState !== "loading" &&
    saveState !== "saving" &&
    requiredFieldsReady &&
    (hasSavedSecret || accessKeySecret.trim());

  function openAliyunSettings() {
    setSettingsPage("aliyun");
    onDetailViewChange?.(true);
  }

  function closeAliyunSettings() {
    setSettingsPage("main");
    onDetailViewChange?.(false);
  }

  if (settingsPage === "aliyun") {
    return (
      <AliyunImageHostSettings
        settings={settings}
        accessKeySecret={accessKeySecret}
        accessKeySecretVisible={accessKeySecretVisible}
        hasSavedSecret={hasSavedSecret}
        desktopAvailable={desktopAvailable}
        saveState={saveState}
        message={message}
        canSave={Boolean(canSave)}
        onBack={closeAliyunSettings}
        onSettingChange={updateSetting}
        onSecretChange={(value) => {
          setAccessKeySecret(value);
          if (!value) setAccessKeySecretVisible(false);
          setSaveState("idle");
          setMessage("");
        }}
        onSecretVisibilityChange={() => setAccessKeySecretVisible((visible) => !visible)}
        onSave={() => void saveSettings()}
      />
    );
  }

  const directoryMessage = !desktopAvailable
    ? "当前环境不支持图床配置。"
    : saveState === "loading"
      ? "正在读取图床服务…"
      : saveState === "error"
        ? message
        : "尚未添加图床。";

  return (
    <section className="flex flex-col gap-2">
      <SettingsSectionHeader title="图床服务" />
      <div className="overflow-hidden rounded-lg border border-[var(--settings-dialog-divider)] bg-[var(--settings-dialog-section-background)]">
        {configured ? (
          <SettingsListRow>
            <button
              type="button"
              className="flex min-h-12 w-full items-center gap-3 px-3 py-2.25 text-left transition-colors hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              onClick={openAliyunSettings}
            >
              <span className="min-w-0 flex-1 text-body font-medium text-foreground">阿里云 OSS</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </SettingsListRow>
        ) : (
          <div className="px-3 py-7 text-center text-xs leading-5 text-muted-foreground">{directoryMessage}</div>
        )}
      </div>

      <div className="flex justify-start">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" disabled={!desktopAvailable || saveState === "loading"}>
              <Plus />
              添加图床
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52">
            <DropdownMenuItem disabled={configured} onSelect={openAliyunSettings}>
              <span>阿里云 OSS</span>
              {configured ? <CircleCheck className="ml-auto" aria-label="已添加" /> : null}
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <span>腾讯云 COS</span>
              <span className="ml-auto text-xs">敬请期待</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </section>
  );
}

function AliyunImageHostSettings({
  settings,
  accessKeySecret,
  accessKeySecretVisible,
  hasSavedSecret,
  desktopAvailable,
  saveState,
  message,
  canSave,
  onBack,
  onSettingChange,
  onSecretChange,
  onSecretVisibilityChange,
  onSave,
}: {
  settings: WechatImageHostSettings;
  accessKeySecret: string;
  accessKeySecretVisible: boolean;
  hasSavedSecret: boolean;
  desktopAvailable: boolean;
  saveState: SaveState;
  message: string;
  canSave: boolean;
  onBack: () => void;
  onSettingChange: <Key extends keyof WechatImageHostSettings>(key: Key, value: WechatImageHostSettings[Key]) => void;
  onSecretChange: (value: string) => void;
  onSecretVisibilityChange: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex flex-col gap-4.5">
      <div className="flex min-h-10 items-center gap-1">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="返回图床服务" onClick={onBack}>
          <ChevronLeft />
        </Button>
        <h4 className="m-0 text-sm leading-5 font-semibold text-foreground">阿里云 OSS</h4>
      </div>

      <SettingsSection title="配置">
        <ImageHostInput
          label="OSS Region"
          description="例如 oss-cn-hangzhou，也兼容完整的 aliyuncs.com Region 地址。"
          value={settings.region}
          placeholder="oss-cn-hangzhou"
          disabled={!desktopAvailable || saveState === "loading"}
          onChange={(value) => onSettingChange("region", value)}
        />
        <ImageHostInput
          label="Bucket"
          description="上传对象会设置为公共读；使用 RAM 子账号时需要授予对象 ACL 权限。"
          value={settings.bucket}
          placeholder="my-image-bucket"
          disabled={!desktopAvailable || saveState === "loading"}
          onChange={(value) => onSettingChange("bucket", value)}
        />
        <ImageHostInput
          label="Access Key ID"
          description="建议使用只拥有该 Bucket 上传权限的 RAM 子账号。"
          value={settings.accessKeyId}
          placeholder="LTAI..."
          disabled={!desktopAvailable || saveState === "loading"}
          onChange={(value) => onSettingChange("accessKeyId", value)}
        />
        <SettingsRow
          label="Access Key Secret"
          description="密钥只交给落笔桌面后端使用，不会写入文章或主题文件。"
          detail={
            saveState === "loading"
              ? "正在从此设备的落笔应用配置中读取已保存值。"
              : hasSavedSecret
                ? "已保存在此设备的落笔应用配置中，默认隐藏；点击眼睛可以查看。"
                : "保存后会在应用重启后继续使用。"
          }
        >
          <span className="relative block w-full max-w-70">
            <Input
              className="w-full pr-10"
              type={accessKeySecretVisible ? "text" : "password"}
              value={accessKeySecret}
              autoComplete="off"
              placeholder={hasSavedSecret ? "••••••••••••••••" : "输入 Access Key Secret"}
              disabled={!desktopAvailable || saveState === "loading"}
              onChange={(event) => onSecretChange(event.target.value)}
            />
            <button
              type="button"
              className="absolute top-1/2 right-2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
              disabled={!accessKeySecret || !desktopAvailable || saveState === "loading"}
              aria-label={accessKeySecretVisible ? "隐藏 Access Key Secret" : "显示 Access Key Secret"}
              title={accessKeySecretVisible ? "隐藏 Access Key Secret" : "显示 Access Key Secret"}
              onClick={onSecretVisibilityChange}
            >
              {accessKeySecretVisible ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </span>
        </SettingsRow>
        <ImageHostInput
          label="自定义域名"
          description="可选。填写 CDN 或自定义域名后，复制排版时优先使用这个地址。"
          value={settings.customDomain}
          placeholder="https://img.example.com"
          disabled={!desktopAvailable || saveState === "loading"}
          onChange={(value) => onSettingChange("customDomain", value)}
        />
        <ImageHostInput
          label="上传路径"
          description="图片会按 年/月/文件名-内容哈希 的结构保存到这个前缀下。"
          value={settings.objectPrefix}
          placeholder="wechat"
          disabled={!desktopAvailable || saveState === "loading"}
          onChange={(value) => onSettingChange("objectPrefix", value)}
        />
        <SettingsActionRow label="保存设置">
          <div className="flex min-w-0 items-center justify-end gap-2">
            {message ? (
              <span
                className={
                  saveState === "error" ? "max-w-60 truncate text-xs text-destructive" : "max-w-60 truncate text-xs text-muted-foreground"
                }
              >
                {saveState === "error" ? (
                  <CircleX className="mr-1 inline" size={14} />
                ) : saveState === "saved" ? (
                  <CheckCircle2 className="mr-1 inline text-status-success" size={14} />
                ) : null}
                {message}
              </span>
            ) : null}
            <Button type="button" disabled={!canSave} onClick={onSave}>
              {saveState === "saving" ? "保存中…" : "保存"}
            </Button>
          </div>
        </SettingsActionRow>
      </SettingsSection>
      <p className="m-0 px-1 text-xs leading-5 text-muted-foreground">
        上传图床只替换公众号排版预览和复制结果中的图片地址，不会改写本地 Markdown 原文。
      </p>
    </div>
  );
}

function ImageHostInput({
  label,
  description,
  value,
  placeholder,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <SettingsRow label={label} description={description}>
      <Input
        className="max-w-70"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </SettingsRow>
  );
}
