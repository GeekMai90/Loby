/**
 * [INPUT]: 依赖 React、设置控件与原生 Agent credential IPC
 * [OUTPUT]: 对外提供联网搜索工具凭证的 AiToolCredentialsSection
 * [POS]: settings feature 的内置联网工具配置边界，凭证明文只存在于未提交表单
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteAgentCredential, getAgentCredentialStatus, saveAgentCredential } from "@/features/assistant/model/agentRuntime";
import { SettingsActionRow, SettingsSection, SettingsTextField } from "@/features/settings/components/SettingsControls";

const SEARCH_CREDENTIAL = "tavily-search";

export function AiToolCredentialsSection() {
  const [configured, setConfigured] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getAgentCredentialStatus(SEARCH_CREDENTIAL)
      .then((status) => setConfigured(status.configured))
      .catch((error) => setMessage(errorMessage(error)));
  }, []);

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await saveAgentCredential(SEARCH_CREDENTIAL, draft.trim());
      setConfigured(true);
      setDraft("");
      setMessage("联网搜索凭证已保存到系统钥匙串。");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setMessage("");
    try {
      await deleteAgentCredential(SEARCH_CREDENTIAL);
      setConfigured(false);
      setMessage("联网搜索凭证已移除。");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsSection title="扩展工具">
      <SettingsTextField
        label="Tavily API Key"
        description="用于 AI 的 web_search 工具；搜索请求和查询词会发送给 Tavily。"
        value={draft}
        type="password"
        placeholder={configured ? "已配置；输入新值可替换" : "输入联网搜索凭证"}
        onChange={setDraft}
      />
      <SettingsActionRow label="联网搜索" value={configured ? "已配置" : "未配置"} detail={message || undefined}>
        {configured ? (
          <Button type="button" variant="outline" disabled={busy} onClick={() => void remove()}>
            移除
          </Button>
        ) : null}
        <Button type="button" variant="outline" disabled={busy || !draft.trim()} onClick={() => void save()}>
          {busy ? "保存中" : configured ? "替换" : "保存"}
        </Button>
      </SettingsActionRow>
    </SettingsSection>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
