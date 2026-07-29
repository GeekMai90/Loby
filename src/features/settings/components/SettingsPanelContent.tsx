/**
 * [INPUT]: 依赖设置模块与由 app 下发的收件箱创建默认值、应用级发布目标状态
 * [OUTPUT]: 对外提供不含图片方言入口的 SettingsPanelContent
 * [POS]: 设置 feature 的界面组合单元，连接 设置 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { SettingsTabId } from "@/features/settings/constants/settingsDialog";
import type { SettingsDialogProps } from "@/features/settings/components/SettingsDialog";
import {
  AiSettingsPanel,
  FileStorageSettingsPanel,
  GeneralSettingsPanel,
  WritingSettingsPanel,
} from "@/features/settings/components/SettingsPanels";
import { PublishingSettingsPanel } from "@/features/settings/components/PublishingSettingsPanel";

type SettingsPanelContentProps = Pick<
  SettingsDialogProps,
  | "libraryPath"
  | "inboxTargetWords"
  | "goalCelebrationEnabled"
  | "appTheme"
  | "editorTheme"
  | "editorTypography"
  | "markdownFormatting"
  | "assistantSendMode"
  | "agentProvider"
  | "providerBaseUrl"
  | "agentModel"
  | "agentReasoningEffort"
  | "modelCatalog"
  | "quickPrompts"
  | "quickPromptsReady"
  | "publishingTargets"
  | "publishingTargetsReady"
  | "publishingTargetsError"
  | "onInboxTargetWordsChange"
  | "onGoalCelebrationEnabledChange"
  | "onAppThemeChange"
  | "onEditorThemeChange"
  | "onEditorTypographyChange"
  | "onMarkdownFormattingChange"
  | "onAssistantSendModeChange"
  | "onAgentProviderChange"
  | "onProviderBaseUrlChange"
  | "onAgentModelChange"
  | "onAgentReasoningEffortChange"
  | "onAddQuickPrompt"
  | "onEditQuickPrompt"
  | "onDeleteQuickPrompt"
  | "onMoveQuickPrompt"
  | "onSavePublishingTarget"
  | "onRevealLibrary"
  | "onOpenExistingLibrary"
  | "onMoveLibrary"
  | "onRebuildLibraryIndex"
> & {
  activeTab: SettingsTabId;
};

export function SettingsPanelContent({
  activeTab,
  libraryPath,
  inboxTargetWords,
  goalCelebrationEnabled,
  appTheme,
  editorTheme,
  editorTypography,
  markdownFormatting,
  assistantSendMode,
  agentProvider,
  providerBaseUrl,
  agentModel,
  agentReasoningEffort,
  modelCatalog,
  quickPrompts,
  quickPromptsReady,
  publishingTargets,
  publishingTargetsReady,
  publishingTargetsError,
  onInboxTargetWordsChange,
  onGoalCelebrationEnabledChange,
  onAppThemeChange,
  onEditorThemeChange,
  onEditorTypographyChange,
  onMarkdownFormattingChange,
  onAssistantSendModeChange,
  onAgentProviderChange,
  onProviderBaseUrlChange,
  onAgentModelChange,
  onAgentReasoningEffortChange,
  onAddQuickPrompt,
  onEditQuickPrompt,
  onDeleteQuickPrompt,
  onMoveQuickPrompt,
  onSavePublishingTarget,
  onRevealLibrary,
  onOpenExistingLibrary,
  onMoveLibrary,
  onRebuildLibraryIndex,
}: SettingsPanelContentProps) {
  if (activeTab === "writing") {
    return (
      <WritingSettingsPanel
        inboxTargetWords={inboxTargetWords}
        goalCelebrationEnabled={goalCelebrationEnabled}
        markdownFormatting={markdownFormatting}
        editorTypography={editorTypography}
        onInboxTargetWordsChange={onInboxTargetWordsChange}
        onGoalCelebrationEnabledChange={onGoalCelebrationEnabledChange}
        onMarkdownFormattingChange={onMarkdownFormattingChange}
        onEditorTypographyChange={onEditorTypographyChange}
      />
    );
  }

  if (activeTab === "ai") {
    return (
      <AiSettingsPanel
        libraryPath={libraryPath}
        assistantSendMode={assistantSendMode}
        agentProvider={agentProvider}
        providerBaseUrl={providerBaseUrl}
        agentModel={agentModel}
        agentReasoningEffort={agentReasoningEffort}
        modelCatalog={modelCatalog}
        quickPrompts={quickPrompts}
        quickPromptsReady={quickPromptsReady}
        onAssistantSendModeChange={onAssistantSendModeChange}
        onAgentProviderChange={onAgentProviderChange}
        onProviderBaseUrlChange={onProviderBaseUrlChange}
        onAgentModelChange={onAgentModelChange}
        onAgentReasoningEffortChange={onAgentReasoningEffortChange}
        onAddQuickPrompt={onAddQuickPrompt}
        onEditQuickPrompt={onEditQuickPrompt}
        onDeleteQuickPrompt={onDeleteQuickPrompt}
        onMoveQuickPrompt={onMoveQuickPrompt}
      />
    );
  }

  if (activeTab === "appearance") {
    return (
      <GeneralSettingsPanel
        appTheme={appTheme}
        editorTheme={editorTheme}
        onAppThemeChange={onAppThemeChange}
        onEditorThemeChange={onEditorThemeChange}
      />
    );
  }

  if (activeTab === "publishing") {
    return (
      <PublishingSettingsPanel
        publishingTargets={publishingTargets}
        publishingTargetsReady={publishingTargetsReady}
        publishingTargetsError={publishingTargetsError}
        onSavePublishingTarget={onSavePublishingTarget}
      />
    );
  }

  if (activeTab === "storage") {
    return (
      <FileStorageSettingsPanel
        libraryPath={libraryPath}
        onRevealLibrary={onRevealLibrary}
        onOpenExistingLibrary={onOpenExistingLibrary}
        onMoveLibrary={onMoveLibrary}
        onRebuildLibraryIndex={onRebuildLibraryIndex}
      />
    );
  }

  return null;
}
