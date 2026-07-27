/**
 * [INPUT]: 依赖 React、AgentSettings、ChatGPT 连接界面、设置控件与原生 Agent credential IPC
 * [OUTPUT]: 对外提供图片生成服务选择、独立 OpenAI 图片凭证与联网搜索凭证的 AiToolCredentialsSection
 * [POS]: settings feature 的 Agent 工具配置边界；只持有未提交凭证草稿，图片路由偏好由 AgentSettings 持久化
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { loadAgentSettings, saveAgentSettings } from "@/features/assistant/model/agentSettings";
import { deleteAgentCredential, getAgentCredentialStatus, saveAgentCredential } from "@/features/assistant/model/agentRuntime";
import { ChatGptConnectionSettings } from "@/features/settings/components/ChatGptConnectionSettings";
import { SettingsActionRow, SettingsSection, SettingsSelect, SettingsTextField } from "@/features/settings/components/SettingsControls";
import type { AgentProvider, ImageGenerationProvider } from "@/shared/types";

const SEARCH_CREDENTIAL = "tavily-search";
const IMAGE_API_CREDENTIAL = "openai-api";
const IMAGE_PROVIDER_OPTIONS: Array<{ value: ImageGenerationProvider; label: string }> = [
  { value: "auto", label: "自动选择" },
  { value: "chatgpt-subscription", label: "ChatGPT 订阅" },
  { value: "openai-api", label: "OpenAI API" },
];

export function AiToolCredentialsSection({
  agentProvider,
  agentCredentialConfigured,
}: {
  agentProvider: AgentProvider;
  agentCredentialConfigured: boolean;
}) {
  const [imageProvider, setImageProvider] = useState<ImageGenerationProvider>(() => loadAgentSettings().imageGenerationProvider);
  const [imageApiConfigured, setImageApiConfigured] = useState(false);
  const [imageApiDraft, setImageApiDraft] = useState("");
  const [searchConfigured, setSearchConfigured] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [busyCredential, setBusyCredential] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([getAgentCredentialStatus(IMAGE_API_CREDENTIAL), getAgentCredentialStatus(SEARCH_CREDENTIAL)])
      .then(([imageStatus, searchStatus]) => {
        setImageApiConfigured(imageStatus.configured);
        setSearchConfigured(searchStatus.configured);
      })
      .catch((error) => setMessage(errorMessage(error)));
  }, []);

  function changeImageProvider(provider: ImageGenerationProvider) {
    setImageProvider(provider);
    saveAgentSettings({ imageGenerationProvider: provider });
    setMessage(providerMessage(provider));
  }

  async function saveCredential(provider: string, draft: string) {
    setBusyCredential(provider);
    setMessage("");
    try {
      await saveAgentCredential(provider, draft.trim());
      if (provider === IMAGE_API_CREDENTIAL) {
        setImageApiConfigured(true);
        setImageApiDraft("");
        setMessage("OpenAI API 凭证已保存，可作为图片生成服务使用。");
      } else {
        setSearchConfigured(true);
        setSearchDraft("");
        setMessage("联网搜索凭证已保存到落笔应用数据。无须系统钥匙串授权。");
      }
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusyCredential("");
    }
  }

  async function removeCredential(provider: string) {
    setBusyCredential(provider);
    setMessage("");
    try {
      await deleteAgentCredential(provider);
      if (provider === IMAGE_API_CREDENTIAL) setImageApiConfigured(false);
      else setSearchConfigured(false);
      setMessage(provider === IMAGE_API_CREDENTIAL ? "OpenAI API 图片凭证已移除。" : "联网搜索凭证已移除。");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusyCredential("");
    }
  }

  const needsSeparateChatGptConnection = agentProvider !== "chatgpt-subscription" && imageProvider !== "openai-api";
  const needsSeparateImageApiCredential = agentProvider !== "openai-api";
  const imageApiAvailable = agentProvider === "openai-api" ? agentCredentialConfigured : imageApiConfigured;

  return (
    <SettingsSection title="扩展工具">
      <SettingsSelect
        label="图片生成服务"
        description="自动模式优先使用当前对话服务，再选择已配置的 ChatGPT 订阅或 OpenAI API；明确指定后不会静默切换计费服务。"
        value={imageProvider}
        options={IMAGE_PROVIDER_OPTIONS}
        onChange={changeImageProvider}
      />
      {needsSeparateChatGptConnection ? <ChatGptConnectionSettings /> : null}
      {needsSeparateImageApiCredential ? (
        <>
          <SettingsTextField
            label="OpenAI 图片 API Key"
            description="可作为自动模式的备用图片服务，也可明确指定使用；与当前对话 Provider 相互独立。"
            value={imageApiDraft}
            type="password"
            placeholder={imageApiConfigured ? "已配置；输入新值可替换" : "选填 OpenAI API Key"}
            onChange={setImageApiDraft}
          />
          <CredentialActionRow
            label="图片 API"
            provider={IMAGE_API_CREDENTIAL}
            configured={imageApiConfigured}
            draft={imageApiDraft}
            busyCredential={busyCredential}
            onSave={saveCredential}
            onRemove={removeCredential}
          />
        </>
      ) : (
        <SettingsActionRow label="图片 API" value={imageApiAvailable ? "复用 AI 服务凭证" : "未配置"}>
          <span />
        </SettingsActionRow>
      )}
      <SettingsTextField
        label="Tavily API Key"
        description="用于 AI 的 web_search 工具；搜索请求和查询词会发送给 Tavily。"
        value={searchDraft}
        type="password"
        placeholder={searchConfigured ? "已配置；输入新值可替换" : "输入联网搜索凭证"}
        onChange={setSearchDraft}
      />
      <CredentialActionRow
        label="联网搜索"
        provider={SEARCH_CREDENTIAL}
        configured={searchConfigured}
        draft={searchDraft}
        busyCredential={busyCredential}
        onSave={saveCredential}
        onRemove={removeCredential}
      />
      {message ? <p className="m-0 px-3 pb-2 text-[11px] leading-4 text-muted-foreground">{message}</p> : null}
    </SettingsSection>
  );
}

function CredentialActionRow({
  label,
  provider,
  configured,
  draft,
  busyCredential,
  onSave,
  onRemove,
}: {
  label: string;
  provider: string;
  configured: boolean;
  draft: string;
  busyCredential: string;
  onSave: (provider: string, draft: string) => Promise<void>;
  onRemove: (provider: string) => Promise<void>;
}) {
  const busy = busyCredential === provider;
  return (
    <SettingsActionRow label={label} value={configured ? "已配置" : "未配置"}>
      {configured ? (
        <Button type="button" variant="outline" disabled={busy} onClick={() => void onRemove(provider)}>
          移除
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        disabled={Boolean(busyCredential) || !draft.trim()}
        onClick={() => void onSave(provider, draft)}
      >
        {busy ? "保存中" : configured ? "替换" : "保存"}
      </Button>
    </SettingsActionRow>
  );
}

function providerMessage(provider: ImageGenerationProvider): string {
  if (provider === "chatgpt-subscription") return "图片生成将使用已登录 ChatGPT 账号的 Codex 图片用量。";
  if (provider === "openai-api") return "图片生成将只使用 OpenAI API，不会回退到 ChatGPT 订阅。";
  return "图片生成将优先复用当前对话服务，并在其不可用时选择已配置的图片服务。";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
