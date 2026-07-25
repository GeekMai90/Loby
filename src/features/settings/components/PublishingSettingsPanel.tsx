/**
 * [INPUT]: 依赖 shadcn/ui 基础控件、lucide-react、React 运行时、GitHub 连接/博客目标设置、发布模块与设置模块
 * [OUTPUT]: 对外提供 PublishingSettingsPanel
 * [POS]: 设置 feature 的界面组合单元，连接 设置 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, CircleX } from "lucide-react";
import { useEffect, useState } from "react";
import {
  hasPublishingSecret,
  isDesktopPublishingAvailable,
  savePublishingSecret,
  validateMowenApiKey,
} from "@/features/publishing/model/api";
import { GitHubConnectionSettings } from "@/features/settings/components/GitHubConnectionSettings";
import { GitHubBlogTargetSettings } from "@/features/settings/components/GitHubBlogTargetSettings";
import { SettingsActionRow, SettingsSection } from "@/features/settings/components/SettingsControls";
import {
  githubBlogTargets,
  type GitHubBlogPublishingTarget,
  type PublishingTargetStore,
} from "@/features/publishing/model/publishingTargets";

const MOWEN_ACCOUNT = "default";

interface PublishingSettingsPanelProps {
  publishingTargets: PublishingTargetStore;
  publishingTargetsReady: boolean;
  publishingTargetsError: string;
  onSavePublishingTarget: (target: GitHubBlogPublishingTarget) => Promise<unknown>;
}

export function PublishingSettingsPanel({
  publishingTargets,
  publishingTargetsReady,
  publishingTargetsError,
  onSavePublishingTarget,
}: PublishingSettingsPanelProps) {
  const desktopAvailable = isDesktopPublishingAvailable();
  const [apiKey, setApiKey] = useState("");
  const [hasSavedApiKey, setHasSavedApiKey] = useState(false);
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
        setValidationMessage(hasSecret ? "API Key 已验证并保存" : "");
      })
      .catch((cause) => {
        if (cancelled) return;
        setHasSavedApiKey(false);
        setValidationState("error");
        setValidationMessage(`无法读取已保存的 API Key：${cause instanceof Error ? cause.message : String(cause)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [desktopAvailable]);

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
      setValidationMessage("API Key 已验证并保存");
    } catch (cause) {
      setValidationState("invalid");
      setValidationMessage(cause instanceof Error ? cause.message : String(cause));
    }
  }

  const showsSavedApiKey = hasSavedApiKey && !apiKey && validationState !== "invalid" && validationState !== "error";
  const showsValidState = validationState === "valid" || (validationState === "idle" && showsSavedApiKey);
  const detail =
    validationState === "loading"
      ? "正在从此设备的落笔应用配置中读取已保存状态。"
      : validationState === "invalid" || validationState === "error"
        ? validationMessage
        : showsSavedApiKey
          ? "已保存在此设备的落笔应用配置中。重启后不会回填明文，留空会继续使用已保存的 API Key。"
          : "验证后会保存在此设备的落笔应用配置中，并在重启后继续使用。";
  return (
    <div className="grid gap-6">
      <GitHubConnectionSettings />

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

      <SettingsSection title="墨问笔记">
        <SettingsActionRow label="API Key" detail={detail}>
          <div className="flex w-full max-w-90 min-w-0 items-center justify-end gap-2">
            <span className="relative block min-w-0 flex-1">
              <Input
                className="pr-8.5"
                type="password"
                value={apiKey}
                autoComplete="new-password"
                placeholder={
                  validationState === "loading" ? "正在读取已保存的 API Key…" : showsSavedApiKey ? "••••••••••••••••" : "输入墨问 API Key"
                }
                disabled={!desktopAvailable || validationState === "loading" || validationState === "validating"}
                onChange={(event) => {
                  setApiKey(event.target.value);
                  setValidationState("idle");
                  setValidationMessage("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void validateApiKey();
                }}
              />
              {showsValidState && (
                <span
                  className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-status-success"
                  role="img"
                  aria-label="API Key 已验证并保存"
                  title="API Key 已验证并保存"
                >
                  <CheckCircle2 size={17} />
                </span>
              )}
              {(validationState === "invalid" || validationState === "error") && (
                <span
                  className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-destructive"
                  role="img"
                  aria-label={validationState === "invalid" ? "API Key 无效" : "API Key 读取失败"}
                  title={validationMessage}
                >
                  <CircleX size={17} />
                </span>
              )}
            </span>
            <Button
              type="button"
              disabled={!desktopAvailable || validationState === "loading" || validationState === "validating" || !apiKey.trim()}
              onClick={validateApiKey}
            >
              {validationState === "validating" ? "验证中…" : "验证"}
            </Button>
            <span className="sr-only" role="status">
              {validationMessage}
            </span>
          </div>
        </SettingsActionRow>
      </SettingsSection>
    </div>
  );
}
