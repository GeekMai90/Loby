import { Button } from "@/components/ui/button";
import { getAssistantSendModeOptions } from "../../constants/settingsDialog";
import type { AssistantSendMode } from "../../types";
import { SettingsActionRow, SettingsSection, SettingsSelect, SettingsTextField, SettingsToggle } from "./SettingsControls";

interface AiSettingsPanelProps {
  planMode: boolean;
  assistantSendMode: AssistantSendMode;
  codexCliPath: string;
  probeSummary: string;
  probeBusy: boolean;
  onPlanModeChange: (enabled: boolean) => void;
  onAssistantSendModeChange: (mode: AssistantSendMode) => void;
  onCodexCliPathChange: (path: string) => void;
  onRunAgentProbe: () => void;
}

export function AiSettingsPanel({
  planMode,
  assistantSendMode,
  codexCliPath,
  probeSummary,
  probeBusy,
  onPlanModeChange,
  onAssistantSendModeChange,
  onCodexCliPathChange,
  onRunAgentProbe,
}: AiSettingsPanelProps) {
  return (
    <>
      <SettingsSection title="助手">
        <SettingsToggle label="Plan Mode" checked={planMode} onChange={onPlanModeChange} />
        <SettingsSelect
          label="发送快捷键"
          value={assistantSendMode}
          options={getAssistantSendModeOptions()}
          triggerClassName="max-w-32"
          onChange={onAssistantSendModeChange}
        />
      </SettingsSection>

      <SettingsSection title="CLI">
        <SettingsTextField label="Codex 路径" value={codexCliPath} placeholder="codex" onChange={onCodexCliPathChange} />
        <SettingsActionRow label="CLI 检测" value={probeSummary}>
          <Button type="button" variant="outline" onClick={onRunAgentProbe} disabled={probeBusy}>
            {probeBusy ? "检测中" : "检测"}
          </Button>
        </SettingsActionRow>
      </SettingsSection>
    </>
  );
}
