/**
 * [INPUT]: 依赖 shadcn/ui、Tauri opener、GitHub 本地状态/显式刷新/Device Flow API、全局 Toast 与 React render-prop 组合
 * [OUTPUT]: 对外提供 GitHubConnectionSettings 与 GitHubConnectionController，进入设置时即时读取本地接入状态，并承载显式刷新、授权 Dialog、权限管理和断开动作
 * [POS]: settings feature 的 GitHub 身份控制器；进入页面不触发远程验证，手动刷新失败时保留已添加目录，且不接触或持久化访问令牌
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  completeGitHubDeviceFlow,
  disconnectGitHub,
  getGitHubConnection,
  isDesktopPublishingAvailable,
  refreshGitHubConnection,
  startGitHubDeviceFlow,
  type GitHubConnection,
  type GitHubDeviceAuthorization,
} from "@/features/publishing/model/api";
import { showAppToast } from "@/shared/lib/appToast";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Copy, ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

type ConnectionPhase = "loading" | "disconnected" | "starting" | "waiting" | "connected" | "needsInstallation" | "error";

export interface GitHubConnectionController {
  connection: GitHubConnection | null;
  phase: ConnectionPhase;
  added: boolean;
  loading: boolean;
  refreshing: boolean;
  busy: boolean;
  connect: () => void;
  refresh: () => void;
  disconnect: () => void;
  openRepositoryAccess: () => void;
}

export function GitHubConnectionSettings({
  children,
  onConnectionChange,
}: {
  children: (controller: GitHubConnectionController) => ReactNode;
  onConnectionChange?: (connection: GitHubConnection | null) => void;
}) {
  const desktopAvailable = isDesktopPublishingAvailable();
  const [connection, setConnection] = useState<GitHubConnection | null>(null);
  const [authorization, setAuthorization] = useState<GitHubDeviceAuthorization | null>(null);
  const [phase, setPhase] = useState<ConnectionPhase>(desktopAvailable ? "loading" : "disconnected");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadConnection = useCallback(async () => {
    if (!desktopAvailable) return;
    setPhase("loading");
    setMessage("");
    try {
      const nextConnection = await getGitHubConnection();
      setConnection(nextConnection);
      setPhase(connectionPhase(nextConnection));
      onConnectionChange?.(nextConnection.connected ? nextConnection : null);
    } catch (cause) {
      setConnection(null);
      setPhase("error");
      setMessage(errorMessage(cause));
      onConnectionChange?.(null);
    }
  }, [desktopAvailable, onConnectionChange]);

  useEffect(() => {
    void loadConnection();
  }, [loadConnection]);

  async function refreshConnection() {
    if (!desktopAvailable || refreshing) return;
    setRefreshing(true);
    try {
      const nextConnection = await refreshGitHubConnection();
      setConnection(nextConnection);
      setPhase(connectionPhase(nextConnection));
      onConnectionChange?.(nextConnection.connected ? nextConnection : null);
      showAppToast({
        variant: "success",
        title: "GitHub 状态已刷新",
        description: nextConnection.connected ? "连接与仓库授权状态已更新。" : "当前尚未连接 GitHub。",
      });
    } catch (cause) {
      showError("GitHub 状态刷新失败", cause);
    } finally {
      setRefreshing(false);
    }
  }

  async function connect() {
    if (!desktopAvailable || phase === "starting" || phase === "waiting") return;
    setDialogOpen(true);
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
      onConnectionChange?.(nextConnection.connected ? nextConnection : null);

      if (nextPhase === "needsInstallation") {
        setMessage("GitHub 账号已连接，请继续授权仓库；建议选择 All repositories。");
        try {
          await openUrl(nextConnection.installationUrl);
        } catch {
          setMessage("GitHub 账号已连接，请点击“授权仓库”并选择 All repositories。");
        }
        return;
      }

      setDialogOpen(false);
      showAppToast({ variant: "success", title: "GitHub 已添加", description: "现在可以配置 GitHub 发布目标。" });
    } catch (cause) {
      setAuthorization(null);
      setPhase("error");
      setMessage(errorMessage(cause));
    }
  }

  async function disconnect() {
    try {
      await disconnectGitHub();
      setConnection(null);
      setAuthorization(null);
      setMessage("");
      setPhase("disconnected");
      onConnectionChange?.(null);
      showAppToast({ variant: "success", title: "GitHub 已断开", description: "已隐藏 GitHub 发布目标，原有非敏感配置仍然保留。" });
    } catch (cause) {
      showError("GitHub 断开失败", cause);
    }
  }

  async function openRepositoryAccess() {
    const target = connection?.manageUrl || connection?.installationUrl;
    if (!target) return;
    try {
      await openUrl(target);
    } catch (cause) {
      showError("无法打开 GitHub 仓库权限", cause);
    }
  }

  async function copyAuthorizationCode() {
    if (!authorization) return;
    await copyCode(authorization.userCode);
    setCopied(true);
  }

  const connected = Boolean(connection?.connected);
  const busy = phase === "starting" || phase === "waiting";
  const controller: GitHubConnectionController = {
    connection,
    phase,
    added: connected,
    loading: phase === "loading",
    refreshing,
    busy,
    connect: () => void connect(),
    refresh: () => void refreshConnection(),
    disconnect: () => void disconnect(),
    openRepositoryAccess: () => void openRepositoryAccess(),
  };

  return (
    <>
      {children(controller)}

      <Dialog open={dialogOpen} onOpenChange={(open) => !busy && setDialogOpen(open)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>添加 GitHub 发布目标</DialogTitle>
            <DialogDescription>通过 GitHub 官方页面完成一次授权；访问凭证不会显示在设置界面中。</DialogDescription>
          </DialogHeader>

          <div className="grid min-h-24 place-items-center gap-3 rounded-lg border border-border px-4 py-5 text-center">
            {phase === "starting" ? (
              <>
                <LoaderCircle className="animate-spin text-muted-foreground" size={20} />
                <p className="m-0 text-xs text-muted-foreground">正在向 GitHub 申请一次性浏览器授权码…</p>
              </>
            ) : phase === "waiting" && authorization ? (
              <>
                <p className="m-0 text-xs text-muted-foreground">在 GitHub 授权页输入下面的验证码，落笔会自动完成连接。</p>
                <span className="rounded-md bg-muted px-3 py-2 font-mono text-sm font-semibold tracking-[0.12em] text-foreground">
                  {authorization.userCode}
                </span>
                {message ? <p className="m-0 text-xs leading-5 text-muted-foreground">{message}</p> : null}
              </>
            ) : phase === "needsInstallation" ? (
              <p className="m-0 text-xs leading-5 text-muted-foreground">{message}</p>
            ) : phase === "error" ? (
              <p className="m-0 text-xs leading-5 text-destructive" role="alert">
                {message || "GitHub 连接失败，请重试。"}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            {phase === "waiting" && authorization ? (
              <>
                <Button type="button" variant="outline" onClick={() => void copyAuthorizationCode()}>
                  <Copy />
                  {copied ? "已复制" : "复制验证码"}
                </Button>
                <Button type="button" onClick={() => void openUrl(authorization.verificationUri)}>
                  <ExternalLink />
                  打开授权页
                </Button>
              </>
            ) : phase === "needsInstallation" ? (
              <Button type="button" onClick={() => void openRepositoryAccess()}>
                <ExternalLink />
                授权仓库
              </Button>
            ) : phase === "error" ? (
              <Button type="button" onClick={() => void connect()}>
                <RefreshCw />
                重试
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function connectionPhase(connection: GitHubConnection): ConnectionPhase {
  if (!connection.connected) return "disconnected";
  if (connection.installationCount === 0 || connection.repositoryCount === 0) return "needsInstallation";
  return "connected";
}

async function copyCode(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // 浏览器拒绝剪贴板访问时，验证码仍会显示在设置界面中。
  }
}

function showError(title: string, cause: unknown) {
  showAppToast({ variant: "error", title, description: errorMessage(cause) });
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
