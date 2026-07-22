/**
 * [INPUT]: 依赖 shadcn/ui 基础控件、设置模块、shared 公共契约
 * [OUTPUT]: 对外提供 AiSettingsPanel
 * [POS]: 设置 feature 的界面组合单元，连接 设置 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Button } from "@/components/ui/button";
import { ASSISTANT_PRESENTATION_OPTIONS, getAssistantSendModeOptions } from "@/features/settings/constants/settingsDialog";
import type { AiQuickPrompt, AssistantPresentationPreference, AssistantSendMode } from "@/shared/types";
import { SettingsActionRow, SettingsSection, SettingsSelect, SettingsTextField } from "@/features/settings/components/SettingsControls";
import { QuickPromptSettingsSection } from "@/features/settings/components/QuickPromptSettingsSection";

interface AiSettingsPanelProps {
  assistantSendMode: AssistantSendMode;
  assistantPresentationPreference: AssistantPresentationPreference;
  codexCliPath: string;
  probeStatus: string;
  probeDetail: string;
  probeBusy: boolean;
  quickPrompts: AiQuickPrompt[];
  quickPromptsReady: boolean;
  onAssistantSendModeChange: (mode: AssistantSendMode) => void;
  onAssistantPresentationPreferenceChange: (preference: AssistantPresentationPreference) => void;
  onCodexCliPathChange: (path: string) => void;
  onRunAgentProbe: () => void;
  onAddQuickPrompt: (title: string, content: string) => void;
  onEditQuickPrompt: (promptId: string, title: string, content: string) => void;
  onDeleteQuickPrompt: (promptId: string) => void;
  onMoveQuickPrompt: (promptId: string, direction: -1 | 1) => void;
}

export function AiSettingsPanel({
  assistantSendMode,
  assistantPresentationPreference,
  codexCliPath,
  probeStatus,
  probeDetail,
  probeBusy,
  quickPrompts,
  quickPromptsReady,
  onAssistantSendModeChange,
  onAssistantPresentationPreferenceChange,
  onCodexCliPathChange,
  onRunAgentProbe,
  onAddQuickPrompt,
  onEditQuickPrompt,
  onDeleteQuickPrompt,
  onMoveQuickPrompt,
}: AiSettingsPanelProps) {
  return (
    <>
      <SettingsSection title="个性设置">
        <SettingsSelect
          label="默认形态"
          value={assistantPresentationPreference}
          options={ASSISTANT_PRESENTATION_OPTIONS}
          triggerClassName="max-w-44"
          onChange={onAssistantPresentationPreferenceChange}
        />
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
        <SettingsTextField
          label="Codex CLI 路径"
          description="这里填写落笔实际使用的 Codex CLI 可执行文件路径。通常可以留空并点击下方检测；检测成功后，落笔会自动把真实路径填入这里。若路径位于 ChatGPT.app 内，表示正在使用 ChatGPT 应用内置的 Codex CLI，这是正常的。"
          value={codexCliPath}
          placeholder="留空自动检测"
          onChange={onCodexCliPathChange}
        />
        <SettingsActionRow
          label="Codex CLI 检测"
          description="检测会解析落笔实际使用的 Codex CLI 路径，并运行 codex --version 和 codex exec --help 确认它可以正常工作。检测成功后，真实路径会自动填入上方并保留到下次启动。"
          value={probeStatus}
          detail={probeStatus === "检测失败" ? probeDetail : undefined}
        >
          <Button type="button" variant="outline" onClick={onRunAgentProbe} disabled={probeBusy}>
            {probeBusy ? "检测中" : "检测"}
          </Button>
        </SettingsActionRow>
      </SettingsSection>
    </>
  );
}
