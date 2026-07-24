/**
 * [INPUT]: 依赖 设置模块
 * [OUTPUT]: 对外提供 SettingsPanelContent
 * [POS]: 设置 feature 的界面组合单元，连接 设置 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { SettingsTabId } from "@/features/settings/constants/settingsDialog";
import type { SettingsDialogProps } from "@/features/settings/components/SettingsDialog";
import {
  AiSettingsPanel,
  FileStorageSettingsPanel,
  SettingsAboutPanel,
  WritingSettingsPanel,
} from "@/features/settings/components/SettingsPanels";
import { AppearanceSettingsPanel } from "@/features/settings/components/AppearanceSettingsPanel";
import { PublishingSettingsPanel } from "@/features/settings/components/PublishingSettingsPanel";
import { ImageHostingSettingsPanel } from "@/features/settings/components/ImageHostingSettingsPanel";

type SettingsPanelContentProps = Pick<
  SettingsDialogProps,
  | "libraryPath"
  | "libraryStatus"
  | "projectCount"
  | "focusMode"
  | "typewriterMode"
  | "goalCelebrationEnabled"
  | "appTheme"
  | "appThemeOverride"
  | "resolvedAppTheme"
  | "editorTheme"
  | "editorTypography"
  | "imageReferenceFormat"
  | "markdownFormatting"
  | "sheetPreviewMode"
  | "assistantSendMode"
  | "assistantPresentationPreference"
  | "codexCliPath"
  | "probeStatus"
  | "probeDetail"
  | "probeBusy"
  | "quickPrompts"
  | "quickPromptsReady"
  | "onFocusModeChange"
  | "onTypewriterModeChange"
  | "onGoalCelebrationEnabledChange"
  | "onAppThemeChange"
  | "onEditorThemeChange"
  | "onEditorTypographyChange"
  | "onImageReferenceFormatChange"
  | "onMarkdownFormattingChange"
  | "onSheetPreviewModeChange"
  | "onAssistantSendModeChange"
  | "onAssistantPresentationPreferenceChange"
  | "onCodexCliPathChange"
  | "onRunAgentProbe"
  | "onAddQuickPrompt"
  | "onEditQuickPrompt"
  | "onDeleteQuickPrompt"
  | "onMoveQuickPrompt"
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
  libraryStatus,
  projectCount,
  focusMode,
  typewriterMode,
  goalCelebrationEnabled,
  appTheme,
  appThemeOverride,
  resolvedAppTheme,
  editorTheme,
  editorTypography,
  imageReferenceFormat,
  markdownFormatting,
  sheetPreviewMode,
  assistantSendMode,
  assistantPresentationPreference,
  codexCliPath,
  probeStatus,
  probeDetail,
  probeBusy,
  quickPrompts,
  quickPromptsReady,
  onFocusModeChange,
  onTypewriterModeChange,
  onGoalCelebrationEnabledChange,
  onAppThemeChange,
  onEditorThemeChange,
  onEditorTypographyChange,
  onImageReferenceFormatChange,
  onMarkdownFormattingChange,
  onSheetPreviewModeChange,
  onAssistantSendModeChange,
  onAssistantPresentationPreferenceChange,
  onCodexCliPathChange,
  onRunAgentProbe,
  onAddQuickPrompt,
  onEditQuickPrompt,
  onDeleteQuickPrompt,
  onMoveQuickPrompt,
  onRevealLibrary,
  onOpenExistingLibrary,
  onMoveLibrary,
  onRebuildLibraryIndex,
}: SettingsPanelContentProps) {
  if (activeTab === "writing") {
    return (
      <WritingSettingsPanel
        focusMode={focusMode}
        typewriterMode={typewriterMode}
        goalCelebrationEnabled={goalCelebrationEnabled}
        sheetPreviewMode={sheetPreviewMode}
        imageReferenceFormat={imageReferenceFormat}
        markdownFormatting={markdownFormatting}
        editorTypography={editorTypography}
        onFocusModeChange={onFocusModeChange}
        onTypewriterModeChange={onTypewriterModeChange}
        onGoalCelebrationEnabledChange={onGoalCelebrationEnabledChange}
        onSheetPreviewModeChange={onSheetPreviewModeChange}
        onImageReferenceFormatChange={onImageReferenceFormatChange}
        onMarkdownFormattingChange={onMarkdownFormattingChange}
        onEditorTypographyChange={onEditorTypographyChange}
      />
    );
  }

  if (activeTab === "ai") {
    return (
      <AiSettingsPanel
        assistantSendMode={assistantSendMode}
        assistantPresentationPreference={assistantPresentationPreference}
        codexCliPath={codexCliPath}
        probeStatus={probeStatus}
        probeDetail={probeDetail}
        probeBusy={probeBusy}
        quickPrompts={quickPrompts}
        quickPromptsReady={quickPromptsReady}
        onAssistantSendModeChange={onAssistantSendModeChange}
        onAssistantPresentationPreferenceChange={onAssistantPresentationPreferenceChange}
        onCodexCliPathChange={onCodexCliPathChange}
        onRunAgentProbe={onRunAgentProbe}
        onAddQuickPrompt={onAddQuickPrompt}
        onEditQuickPrompt={onEditQuickPrompt}
        onDeleteQuickPrompt={onDeleteQuickPrompt}
        onMoveQuickPrompt={onMoveQuickPrompt}
      />
    );
  }

  if (activeTab === "appearance") {
    return (
      <AppearanceSettingsPanel
        appTheme={appTheme}
        appThemeOverride={appThemeOverride}
        resolvedAppTheme={resolvedAppTheme}
        editorTheme={editorTheme}
        onAppThemeChange={onAppThemeChange}
        onEditorThemeChange={onEditorThemeChange}
      />
    );
  }

  if (activeTab === "publishing") {
    return <PublishingSettingsPanel />;
  }

  if (activeTab === "image-hosting") {
    return <ImageHostingSettingsPanel />;
  }

  if (activeTab === "storage") {
    return (
      <FileStorageSettingsPanel
        libraryPath={libraryPath}
        libraryStatus={libraryStatus}
        projectCount={projectCount}
        onRevealLibrary={onRevealLibrary}
        onOpenExistingLibrary={onOpenExistingLibrary}
        onMoveLibrary={onMoveLibrary}
        onRebuildLibraryIndex={onRebuildLibraryIndex}
      />
    );
  }

  return <SettingsAboutPanel />;
}
