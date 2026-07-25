/**
 * [INPUT]: 依赖 shadcn/ui、Tauri opener、GitHub Device Flow API 与设置行组件
 * [OUTPUT]: 对外提供 GitHubConnectionSettings，承载一次性浏览器连接、设备码反馈与多仓库权限管理
 * [POS]: settings feature 的 GitHub 身份界面，只消费 native 连接状态，不接触或持久化访问令牌
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Button } from "@/components/ui/button";
import {
  completeGitHubDeviceFlow,
  disconnectGitHub,
  getGitHubConnection,
  isDesktopPublishingAvailable,
  startGitHubDeviceFlow,
  type GitHubConnection,
  type GitHubDeviceAuthorization,
} from "@/features/publishing/model/api";
import { SettingsActionRow, SettingsSection } from "@/features/settings/components/SettingsControls";
import { openUrl } from "@tauri-apps/plugin-opener";
import { CheckCircle2, Copy, ExternalLink, GitBranch, LoaderCircle, RefreshCw, Unplug } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type ConnectionPhase = "loading" | "disconnected" | "starting" | "waiting" | "connected" | "needsInstallation" | "error";

export function GitHubConnectionSettings() {
  const desktopAvailable = isDesktopPublishingAvailable();
  const [connection, setConnection] = useState<GitHubConnection | null>(null);
  const [authorization, setAuthorization] = useState<GitHubDeviceAuthorization | null>(null);
  const [phase, setPhase] = useState<ConnectionPhase>(desktopAvailable ? "loading" : "disconnected");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const loadConnection = useCallback(async () => {
    if (!desktopAvailable) return;
    setPhase("loading");
    setMessage("");
    try {
      const nextConnection = await getGitHubConnection();
      setConnection(nextConnection);
      setPhase(connectionPhase(nextConnection));
    } catch (cause) {
      setConnection(null);
      setPhase("error");
      setMessage(cause instanceof Error ? cause.message : String(cause));
    }
  }, [desktopAvailable]);

  useEffect(() => {
    void loadConnection();
  }, [loadConnection]);

  async function connect() {
    setPhase("starting");
    setMessage("");
    setCopied(false);
    try {
      const nextAuthorization = await startGitHubDeviceFlow();
      setAuthorization(nextAuthorization);
      setPhase("waiting");
      await copyCode(nextAuthorization.userCode);
      setCopied(true);
      try {
        await openUrl(nextAuthorization.verificationUri);
      } catch {
        setMessage("浏览器没有自动打开，请点击“打开授权页”继续。验证码已经显示在这里。");
      }
      const nextConnection = await completeGitHubDeviceFlow(nextAuthorization);
      setAuthorization(null);
      setConnection(nextConnection);
      const nextPhase = connectionPhase(nextConnection);
      setPhase(nextPhase);
      if (nextPhase === "needsInstallation") {
        setMessage("GitHub 账号已连接，请在浏览器中选择 All repositories 完成仓库授权。");
        try {
          await openUrl(nextConnection.installationUrl);
        } catch {
          setMessage("GitHub 账号已连接，请点击“授权仓库”并选择 All repositories。");
        }
      }
    } catch (cause) {
      setAuthorization(null);
      setPhase("error");
      setMessage(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function disconnect() {
    try {
      await disconnectGitHub();
      setConnection(null);
      setAuthorization(null);
      setMessage("");
      setPhase("disconnected");
    } catch (cause) {
      setPhase("error");
      setMessage(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function openRepositoryAccess() {
    const target = connection?.manageUrl || connection?.installationUrl;
    if (!target) return;
    await openUrl(target);
  }

  async function copyAuthorizationCode() {
    if (!authorization) return;
    await copyCode(authorization.userCode);
    setCopied(true);
  }

  const connected = Boolean(connection?.connected);
  const busy = phase === "loading" || phase === "starting" || phase === "waiting";
  const detail = connectionDetail(phase, connection, message);

  return (
    <SettingsSection title="GitHub">
      <SettingsActionRow label={connected ? connection?.login || "GitHub" : "连接 GitHub"} detail={detail}>
        <div className="flex min-w-0 items-center justify-end gap-2">
          {phase === "waiting" && authorization ? (
            <>
              <span className="rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs font-semibold tracking-[0.12em] text-foreground">
                {authorization.userCode}
              </span>
              <Button type="button" variant="outline" onClick={() => void copyAuthorizationCode()}>
                <Copy size={14} />
                {copied ? "已复制" : "复制"}
              </Button>
              <Button type="button" variant="outline" onClick={() => void openUrl(authorization.verificationUri)}>
                <ExternalLink size={14} />
                打开授权页
              </Button>
            </>
          ) : connected ? (
            <>
              {(phase === "needsInstallation" || phase === "connected") && (
                <Button type="button" variant="outline" onClick={() => void openRepositoryAccess()}>
                  <ExternalLink size={14} />
                  {phase === "needsInstallation" ? "授权仓库" : "管理仓库权限"}
                </Button>
              )}
              <Button type="button" variant="ghost" size="icon-sm" title="刷新 GitHub 状态" onClick={() => void loadConnection()}>
                <RefreshCw size={14} />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" title="断开 GitHub" onClick={() => void disconnect()}>
                <Unplug size={14} />
              </Button>
            </>
          ) : (
            <Button type="button" disabled={!desktopAvailable || busy} onClick={() => void connect()}>
              {busy ? <LoaderCircle className="animate-spin" size={15} /> : <GitBranch size={15} />}
              {phase === "starting" ? "正在准备…" : "连接 GitHub"}
            </Button>
          )}
          {phase === "connected" && <CheckCircle2 className="text-status-success" size={18} aria-label="GitHub 已连接" />}
        </div>
      </SettingsActionRow>
    </SettingsSection>
  );
}

function connectionPhase(connection: GitHubConnection): ConnectionPhase {
  if (!connection.connected) return "disconnected";
  if (connection.installationCount === 0 || connection.repositoryCount === 0) return "needsInstallation";
  return "connected";
}

function connectionDetail(phase: ConnectionPhase, connection: GitHubConnection | null, message: string): string {
  switch (phase) {
    case "loading":
      return "正在读取 GitHub 连接状态。";
    case "starting":
      return "正在向 GitHub 申请一次性浏览器授权码。";
    case "waiting":
      return message || "验证码已显示并尝试复制。请在浏览器中确认授权，落笔会自动完成连接。";
    case "connected":
      return `已连接，可供所有发布目标使用 ${connection?.repositoryCount ?? 0} 个可写仓库。`;
    case "needsInstallation":
      return message || "账号已经连接，请继续授权仓库；建议选择 All repositories。";
    case "error":
      return message || "GitHub 连接失败，请重试。";
    default:
      return "通过 GitHub 官方页面授权一次，之后可在下方统一配置仓库发布目标。";
  }
}

async function copyCode(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // 浏览器拒绝剪贴板访问时，验证码仍会显示在设置界面中。
  }
}
