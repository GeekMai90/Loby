import { Button } from "@/components/ui/button";
import { AGENT_PROVIDER_OPTIONS, ASSISTANT_SEND_MODE_OPTIONS } from "../../constants/settingsDialog";
import type { AgentProvider, AssistantSendMode } from "../../types";
import { SettingsActionRow, SettingsSection, SettingsSegmentedControl, SettingsTextField, SettingsToggle } from "./SettingsControls";

interface AiSettingsPanelProps {
  agentProvider: AgentProvider;
  planMode: boolean;
  assistantSendMode: AssistantSendMode;
  codexCliPath: string;
  claudeCliPath: string;
  probeSummary: string;
  probeBusy: boolean;
  onAgentProviderChange: (provider: AgentProvider) => void;
  onPlanModeChange: (enabled: boolean) => void;
  onAssistantSendModeChange: (mode: AssistantSendMode) => void;
  onCodexCliPathChange: (path: string) => void;
  onClaudeCliPathChange: (path: string) => void;
  onRunAgentProbe: () => void;
}

export function AiSettingsPanel({
  agentProvider,
  planMode,
  assistantSendMode,
  codexCliPath,
  claudeCliPath,
  probeSummary,
  probeBusy,
  onAgentProviderChange,
  onPlanModeChange,
  onAssistantSendModeChange,
  onCodexCliPathChange,
  onClaudeCliPathChange,
  onRunAgentProbe,
}: AiSettingsPanelProps) {
  return (
    <>
      <SettingsSection title="助手">
        <SettingsSegmentedControl label="运行器" value={agentProvider} options={AGENT_PROVIDER_OPTIONS} onChange={onAgentProviderChange} />
        <SettingsToggle label="Plan Mode" checked={planMode} onChange={onPlanModeChange} />
        <SettingsSegmentedControl
          label="发送快捷键"
          value={assistantSendMode}
          options={ASSISTANT_SEND_MODE_OPTIONS}
          onChange={onAssistantSendModeChange}
        />
      </SettingsSection>

      <SettingsSection title="CLI">
        <SettingsTextField label="Codex 路径" value={codexCliPath} placeholder="codex" onChange={onCodexCliPathChange} />
        <SettingsTextField label="Claude 路径" value={claudeCliPath} placeholder="claude" onChange={onClaudeCliPathChange} />
        <SettingsActionRow label="CLI 检测" value={probeSummary}>
          <Button type="button" variant="outline" onClick={onRunAgentProbe} disabled={probeBusy}>
            {probeBusy ? "检测中" : "检测"}
          </Button>
        </SettingsActionRow>
      </SettingsSection>
    </>
  );
}
