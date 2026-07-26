/**
 * [INPUT]: 依赖 React、shadcn/ui、设置控件、AI Provider/凭证状态与快捷提示契约
 * [OUTPUT]: 对外提供 Provider、系统钥匙串凭证、兼容端点和发送偏好的 AiSettingsPanel
 * [POS]: 设置 feature 的 AI 服务入口，只持有尚未提交的凭证草稿，不接触持久凭证明文
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getAssistantSendModeOptions } from "@/features/settings/constants/settingsDialog";
import type { AgentProvider, AiQuickPrompt, AssistantSendMode } from "@/shared/types";
import { SettingsActionRow, SettingsSection, SettingsSelect, SettingsTextField } from "@/features/settings/components/SettingsControls";
import { QuickPromptSettingsSection } from "@/features/settings/components/QuickPromptSettingsSection";
import { McpSettingsSection } from "@/features/settings/components/McpSettingsSection";
import { AiToolCredentialsSection } from "@/features/settings/components/AiToolCredentialsSection";
import { ChatGptConnectionSettings } from "@/features/settings/components/ChatGptConnectionSettings";

interface AiSettingsPanelProps {
  assistantSendMode: AssistantSendMode;
  agentProvider: AgentProvider;
  providerBaseUrl: string;
  credentialConfigured: boolean;
  credentialBusy: boolean;
  credentialMessage: string;
  quickPrompts: AiQuickPrompt[];
  quickPromptsReady: boolean;
  onAssistantSendModeChange: (mode: AssistantSendMode) => void;
  onAgentProviderChange: (provider: AgentProvider) => void;
  onProviderBaseUrlChange: (url: string) => void;
  onSaveCredential: (secret: string) => Promise<void>;
  onDeleteCredential: () => Promise<void>;
  onAddQuickPrompt: (title: string, content: string) => void;
  onEditQuickPrompt: (promptId: string, title: string, content: string) => void;
  onDeleteQuickPrompt: (promptId: string) => void;
  onMoveQuickPrompt: (promptId: string, direction: -1 | 1) => void;
}

const PROVIDER_OPTIONS: Array<{ value: AgentProvider; label: string }> = [
  { value: "openai-api", label: "OpenAI API" },
  { value: "anthropic-api", label: "Anthropic API" },
  { value: "openai-compatible", label: "OpenAI 兼容服务" },
  { value: "chatgpt-subscription", label: "ChatGPT 订阅登录" },
];

export function AiSettingsPanel({
  assistantSendMode,
  agentProvider,
  providerBaseUrl,
  credentialConfigured,
  credentialBusy,
  credentialMessage,
  quickPrompts,
  quickPromptsReady,
  onAssistantSendModeChange,
  onAgentProviderChange,
  onProviderBaseUrlChange,
  onSaveCredential,
  onDeleteCredential,
  onAddQuickPrompt,
  onEditQuickPrompt,
  onDeleteQuickPrompt,
  onMoveQuickPrompt,
}: AiSettingsPanelProps) {
  const [credentialDraft, setCredentialDraft] = useState("");
  const credentialLabel = agentProvider === "anthropic-api" ? "Anthropic API Key" : "API Key";
  const subscriptionProvider = agentProvider === "chatgpt-subscription";

  async function saveCredential() {
    await onSaveCredential(credentialDraft);
    setCredentialDraft("");
  }

  return (
    <>
      <SettingsSection title="个性设置">
        <SettingsSelect
          label="发送快捷键"
          value={assistantSendMode}
          options={getAssistantSendModeOptions()}
          triggerClassName="max-w-32"
          onChange={onAssistantSendModeChange}
        />
      </SettingsSection>

      <QuickPromptSettingsSection
        prompts={quickPrompts}
        ready={quickPromptsReady}
        onAdd={onAddQuickPrompt}
        onEdit={onEditQuickPrompt}
        onDelete={onDeleteQuickPrompt}
        onMove={onMoveQuickPrompt}
      />

      <SettingsSection title="AI 服务">
        <SettingsSelect label="Provider" value={agentProvider} options={PROVIDER_OPTIONS} onChange={onAgentProviderChange} />
        {agentProvider === "openai-compatible" ? (
          <SettingsTextField
            label="API 地址"
            description="填写兼容 OpenAI Responses API 的 HTTPS 根地址。"
            value={providerBaseUrl}
            placeholder="https://api.example.com/v1"
            onChange={onProviderBaseUrlChange}
          />
        ) : null}
        {subscriptionProvider ? (
          <ChatGptConnectionSettings />
        ) : (
          <>
            <SettingsTextField
              label={credentialLabel}
              description="凭证提交后只保存在 macOS 系统钥匙串，不写入文稿、项目配置或浏览器存储。"
              value={credentialDraft}
              type="password"
              placeholder={credentialConfigured ? "已配置；输入新值可替换" : "输入访问凭证"}
              onChange={setCredentialDraft}
            />
            <SettingsActionRow label="凭证状态" value={credentialConfigured ? "已配置" : "未配置"} detail={credentialMessage || undefined}>
              {credentialConfigured ? (
                <Button type="button" variant="outline" disabled={credentialBusy} onClick={() => void onDeleteCredential()}>
                  移除
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={credentialBusy || !credentialDraft.trim()}
                onClick={() => void saveCredential()}
              >
                {credentialBusy ? "保存中" : credentialConfigured ? "替换" : "保存"}
              </Button>
            </SettingsActionRow>
          </>
        )}
      </SettingsSection>
      <AiToolCredentialsSection />
      <McpSettingsSection />
    </>
  );
}
