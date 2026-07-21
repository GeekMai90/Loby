import type { SettingsTabId } from "../../constants/settingsDialog";
import type { SettingsDialogProps } from "../SettingsDialog";
import { AiSettingsPanel, FileStorageSettingsPanel, SettingsAboutPanel, WritingSettingsPanel } from "./SettingsPanels";
import { AppearanceSettingsPanel } from "./AppearanceSettingsPanel";
import { PublishingSettingsPanel } from "./PublishingSettingsPanel";
import { ImageHostingSettingsPanel } from "./ImageHostingSettingsPanel";

type SettingsPanelContentProps = Pick<
  SettingsDialogProps,
  | "libraryPath"
  | "libraryStatus"
  | "projectCount"
  | "focusMode"
  | "typewriterMode"
  | "goalCelebrationEnabled"
  | "appTheme"
  | "resolvedAppTheme"
  | "editorTheme"
  | "editorTypography"
  | "imageReferenceFormat"
  | "markdownFormatting"
  | "sheetPreviewMode"
  | "assistantSendMode"
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
  | "onCodexCliPathChange"
  | "onRunAgentProbe"
  | "onAddQuickPrompt"
  | "onEditQuickPrompt"
  | "onDeleteQuickPrompt"
  | "onMoveQuickPrompt"
  | "onOpenLibrary"
  | "onMoveLibrary"
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
  resolvedAppTheme,
  editorTheme,
  editorTypography,
  imageReferenceFormat,
  markdownFormatting,
  sheetPreviewMode,
  assistantSendMode,
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
  onCodexCliPathChange,
  onRunAgentProbe,
  onAddQuickPrompt,
  onEditQuickPrompt,
  onDeleteQuickPrompt,
  onMoveQuickPrompt,
  onOpenLibrary,
  onMoveLibrary,
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
        codexCliPath={codexCliPath}
        probeStatus={probeStatus}
        probeDetail={probeDetail}
        probeBusy={probeBusy}
        quickPrompts={quickPrompts}
        quickPromptsReady={quickPromptsReady}
        onAssistantSendModeChange={onAssistantSendModeChange}
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
        onOpenLibrary={onOpenLibrary}
        onMoveLibrary={onMoveLibrary}
      />
    );
  }

  return <SettingsAboutPanel />;
}
