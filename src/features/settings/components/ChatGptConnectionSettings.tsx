/**
 * [INPUT]: 依赖 shadcn/ui、Tauri opener、ChatGPT Device OAuth IPC 与设置行组件
 * [OUTPUT]: 对外提供 ChatGptConnectionSettings，承载弹窗内可取消的订阅账号连接、设备码反馈、刷新与退出
 * [POS]: settings feature 的 ChatGPT 身份表面，只消费 native 去敏订阅状态并向连接目录报告变化，不接触 OAuth token 或账号邮箱
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Button } from "@/components/ui/button";
import {
  cancelChatGptDeviceFlow,
  completeChatGptDeviceFlow,
  disconnectChatGpt,
  getChatGptConnection,
  startChatGptDeviceFlow,
} from "@/features/assistant/model/agentRuntime";
import { SettingsActionRow } from "@/features/settings/components/SettingsControls";
import type { ChatGptConnection, ChatGptDeviceAuthorization } from "@/shared/types";
import { openUrl } from "@tauri-apps/plugin-opener";
import { CheckCircle2, Copy, ExternalLink, LoaderCircle, LogIn, RefreshCw, Unplug, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type ConnectionPhase = "loading" | "disconnected" | "starting" | "waiting" | "connected" | "error";

export function ChatGptConnectionSettings({ onConnectionChange }: { onConnectionChange?: (connection: ChatGptConnection) => void }) {
  const [connection, setConnection] = useState<ChatGptConnection | null>(null);
  const [authorization, setAuthorization] = useState<ChatGptDeviceAuthorization | null>(null);
  const [phase, setPhase] = useState<ConnectionPhase>("loading");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const activeAuthorizationRef = useRef<ChatGptDeviceAuthorization | null>(null);
  const mountedRef = useRef(true);

  const loadConnection = useCallback(async () => {
    setPhase("loading");
    setMessage("");
    try {
      const next = await getChatGptConnection();
      setConnection(next);
      setPhase(next.connected ? "connected" : "disconnected");
    } catch (cause) {
      setConnection(null);
      setPhase("error");
      setMessage(errorMessage(cause));
    }
  }, []);

  useEffect(() => {
    void loadConnection();
  }, [loadConnection]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const active = activeAuthorizationRef.current;
      activeAuthorizationRef.current = null;
      if (active) void cancelChatGptDeviceFlow(active).catch(() => undefined);
    };
  }, []);

  async function connect() {
    setPhase("starting");
    setMessage("");
    setCopied(false);
    let startedAuthorization: ChatGptDeviceAuthorization | null = null;
    try {
      const nextAuthorization = await startChatGptDeviceFlow();
      startedAuthorization = nextAuthorization;
      if (!mountedRef.current) {
        await cancelChatGptDeviceFlow(nextAuthorization).catch(() => undefined);
        return;
      }
      activeAuthorizationRef.current = nextAuthorization;
      setAuthorization(nextAuthorization);
      setPhase("waiting");
      await copyCode(nextAuthorization.userCode);
      setCopied(true);
      try {
        await openUrl(nextAuthorization.verificationUri);
      } catch {
        setMessage("浏览器没有自动打开，请点击“打开登录页”继续。验证码已经显示在这里。");
      }
      const nextConnection = await completeChatGptDeviceFlow(nextAuthorization);
      if (activeAuthorizationRef.current?.flowId !== nextAuthorization.flowId) return;
      activeAuthorizationRef.current = null;
      setAuthorization(null);
      setConnection(nextConnection);
      setPhase("connected");
      setMessage("ChatGPT 订阅账号已连接，模型调用将消耗该账号的 Codex 用量。");
      onConnectionChange?.(nextConnection);
    } catch (cause) {
      if (startedAuthorization && activeAuthorizationRef.current?.flowId !== startedAuthorization.flowId) return;
      activeAuthorizationRef.current = null;
      setAuthorization(null);
      setPhase("error");
      setMessage(errorMessage(cause));
    }
  }

  async function disconnect() {
    try {
      await disconnectChatGpt();
      setAuthorization(null);
      setConnection(null);
      setPhase("disconnected");
      setMessage("");
      onConnectionChange?.({ connected: false, planType: "" });
    } catch (cause) {
      setPhase("error");
      setMessage(errorMessage(cause));
    }
  }

  async function copyAuthorizationCode() {
    if (!authorization) return;
    await copyCode(authorization.userCode);
    setCopied(true);
  }

  async function cancelAuthorization() {
    const active = activeAuthorizationRef.current;
    activeAuthorizationRef.current = null;
    setAuthorization(null);
    setPhase("disconnected");
    setMessage("");
    if (active) {
      try {
        await cancelChatGptDeviceFlow(active);
      } catch (cause) {
        setPhase("error");
        setMessage(errorMessage(cause));
      }
    }
  }

  const connected = Boolean(connection?.connected);
  const busy = phase === "loading" || phase === "starting" || phase === "waiting";
  const label = connected ? "ChatGPT" : "ChatGPT 订阅";

  return (
    <SettingsActionRow
      label={label}
      value={connected ? planLabel(connection?.planType) : undefined}
      detail={connectionDetail(phase, message)}
    >
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
              打开登录页
            </Button>
            <Button type="button" variant="ghost" onClick={() => void cancelAuthorization()}>
              <X size={14} />
              取消
            </Button>
          </>
        ) : connected ? (
          <>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void connect()}>
              <RefreshCw size={14} />
              重新认证
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void disconnect()}>
              <Unplug size={14} />
              断开连接
            </Button>
            <CheckCircle2 className="text-status-success" size={18} aria-label="ChatGPT 已连接" />
          </>
        ) : (
          <Button type="button" disabled={busy} onClick={() => void connect()}>
            {busy ? <LoaderCircle className="animate-spin" size={15} /> : <LogIn size={15} />}
            {phase === "starting" ? "正在准备…" : "登录 ChatGPT"}
          </Button>
        )}
      </div>
    </SettingsActionRow>
  );
}

function connectionDetail(phase: ConnectionPhase, message: string): string {
  switch (phase) {
    case "loading":
      return "正在读取 ChatGPT 连接状态。";
    case "starting":
      return "正在申请一次性设备授权码。";
    case "waiting":
      return message || "请在 OpenAI 登录页输入验证码；落笔会自动完成连接。";
    case "connected":
      return message || "已连接；访问凭证由落笔应用数据保存并自动刷新。";
    case "error":
      return message || "ChatGPT 连接失败，请重试。";
    default:
      return "使用 Plus、Pro 或其他包含 Codex 用量的 ChatGPT 账号登录，不消耗 Platform API key 额度。";
  }
}

function planLabel(planType: string | undefined): string {
  if (!planType) return "已连接";
  return planType.charAt(0).toUpperCase() + planType.slice(1);
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

async function copyCode(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // 剪贴板被拒绝时，验证码仍然明确显示在设置界面中。
  }
}
