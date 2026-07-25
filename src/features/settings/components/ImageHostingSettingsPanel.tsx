/**
 * [INPUT]: 依赖 shadcn/ui 基础控件、lucide-react、React 运行时、发布模块、设置模块
 * [OUTPUT]: 对外提供 ImageHostingSettingsPanel
 * [POS]: 设置 feature 的界面组合单元，连接 设置 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, CircleX } from "lucide-react";
import { useEffect, useState } from "react";
import { isDesktopPublishingAvailable } from "@/features/publishing/model/api";
import {
  DEFAULT_WECHAT_IMAGE_HOST_SETTINGS,
  loadWechatImageHostSettings,
  saveWechatImageHostSettings,
  type WechatImageHostSettings,
} from "@/features/publishing/model/wechatImageHost";
import { SettingsActionRow, SettingsRow, SettingsSection } from "@/features/settings/components/SettingsControls";

type SaveState = "idle" | "loading" | "saving" | "saved" | "error";

export function ImageHostingSettingsPanel() {
  const desktopAvailable = isDesktopPublishingAvailable();
  const [settings, setSettings] = useState<WechatImageHostSettings>(DEFAULT_WECHAT_IMAGE_HOST_SETTINGS);
  const [accessKeySecret, setAccessKeySecret] = useState("");
  const [hasSavedSecret, setHasSavedSecret] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>(desktopAvailable ? "loading" : "idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!desktopAvailable) return;
    let cancelled = false;
    void loadWechatImageHostSettings()
      .then((result) => {
        if (cancelled) return;
        setSettings(result.settings);
        setHasSavedSecret(result.hasAccessKeySecret);
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
      setHasSavedSecret(result.hasAccessKeySecret);
      setAccessKeySecret("");
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

  return (
    <div className="flex flex-col gap-4.5">
      <SettingsSection title="微信公众号图床">
        <SettingsRow label="服务商">
          <span className="text-xs text-muted-foreground">阿里云 OSS</span>
        </SettingsRow>
        <ImageHostInput
          label="OSS Region"
          description="例如 oss-cn-hangzhou，也兼容完整的 aliyuncs.com Region 地址。"
          value={settings.region}
          placeholder="oss-cn-hangzhou"
          disabled={!desktopAvailable || saveState === "loading"}
          onChange={(value) => updateSetting("region", value)}
        />
        <ImageHostInput
          label="Bucket"
          description="Bucket 需要允许公网读取，或者配置一个可以公开访问的自定义域名。"
          value={settings.bucket}
          placeholder="my-image-bucket"
          disabled={!desktopAvailable || saveState === "loading"}
          onChange={(value) => updateSetting("bucket", value)}
        />
        <ImageHostInput
          label="Access Key ID"
          description="建议使用只拥有该 Bucket 上传权限的 RAM 子账号。"
          value={settings.accessKeyId}
          placeholder="LTAI..."
          disabled={!desktopAvailable || saveState === "loading"}
          onChange={(value) => updateSetting("accessKeyId", value)}
        />
        <SettingsRow
          label="Access Key Secret"
          description="密钥只交给落笔桌面后端使用，不会写入文章或主题文件。"
          detail={
            saveState === "loading"
              ? "正在从此设备的落笔应用配置中读取已保存状态。"
              : hasSavedSecret
                ? "已保存在此设备的落笔应用配置中。重启后不会回填明文，留空会继续使用已保存的 Access Key Secret。"
                : "保存后会在应用重启后继续使用。"
          }
        >
          <Input
            className="max-w-70"
            type="password"
            value={accessKeySecret}
            autoComplete="new-password"
            placeholder={hasSavedSecret ? "••••••••••••••••" : "输入 Access Key Secret"}
            disabled={!desktopAvailable || saveState === "loading"}
            onChange={(event) => {
              setAccessKeySecret(event.target.value);
              setSaveState("idle");
              setMessage("");
            }}
          />
        </SettingsRow>
        <ImageHostInput
          label="自定义域名"
          description="可选。填写 CDN 或自定义域名后，复制排版时优先使用这个地址。"
          value={settings.customDomain}
          placeholder="https://img.example.com"
          disabled={!desktopAvailable || saveState === "loading"}
          onChange={(value) => updateSetting("customDomain", value)}
        />
        <ImageHostInput
          label="上传路径"
          description="图片会按 年/月/文件名-内容哈希 的结构保存到这个前缀下。"
          value={settings.objectPrefix}
          placeholder="wechat"
          disabled={!desktopAvailable || saveState === "loading"}
          onChange={(value) => updateSetting("objectPrefix", value)}
        />
        <SettingsActionRow label="保存设置">
          <div className="flex min-w-0 items-center justify-end gap-2">
            {message && (
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
            )}
            <Button type="button" disabled={!canSave} onClick={() => void saveSettings()}>
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
