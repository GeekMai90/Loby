/**
 * [INPUT]: 依赖 React、shared Provider 契约与 Agent credential IPC
 * [OUTPUT]: 对外提供 useAgentCredentials，管理当前 Provider 的配置状态、保存/删除动作与用户可见结果
 * [POS]: AI 助手 hooks 层的凭证协调边界，使主对话编排不拥有设置页反馈状态机
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useState } from "react";
import type { AgentCredentialStatus, AgentProvider } from "@/shared/types";
import { deleteAgentCredential, getAgentCredentialStatus, saveAgentCredential } from "@/features/assistant/model/agentRuntime";

export function useAgentCredentials(provider: AgentProvider) {
  const [status, setStatus] = useState<AgentCredentialStatus>({ provider, configured: false });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setMessage("");
    getAgentCredentialStatus(provider)
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch((error) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [provider]);

  async function store(secret: string) {
    if (!secret.trim()) throw new Error("请输入有效的访问凭证。");
    setBusy(true);
    setMessage("");
    try {
      await saveAgentCredential(provider, secret.trim());
      setStatus({ provider, configured: true });
      setMessage("凭证已保存到当前用户的落笔应用数据。启动时不会请求系统钥匙串。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setMessage("");
    try {
      await deleteAgentCredential(provider);
      setStatus({ provider, configured: false });
      setMessage("已从落笔应用数据中移除凭证。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return { status, busy, message, store, remove };
}
