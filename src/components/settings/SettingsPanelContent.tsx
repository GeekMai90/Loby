import type { SettingsTabId } from "../../constants/settingsDialog";
import type { SettingsDialogProps } from "../SettingsDialog";
import { AiSettingsPanel, LibrarySettingsPanel, SettingsAboutPanel, WritingSettingsPanel } from "./SettingsPanels";
import { AppearanceSettingsPanel } from "./AppearanceSettingsPanel";
import { PublishingSettingsPanel } from "./PublishingSettingsPanel";
import { ImageHostingSettingsPanel } from "./ImageHostingSettingsPanel";

type SettingsPanelContentProps = Pick<
  SettingsDialogProps,
  | "libraryPath"
  | "libraryStatus"
  | "activeLibraryName"
  | "libraryCount"
  | "projectCount"
  | "activeProjectTitle"
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
  | "onManageLibraries"
  | "onOpenLibrary"
> & {
  activeTab: SettingsTabId;
};

export function SettingsPanelContent({
  activeTab,
  libraryPath,
  libraryStatus,
  activeLibraryName,
  libraryCount,
  projectCount,
  activeProjectTitle,
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
  onManageLibraries,
  onOpenLibrary,
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
        onAssistantSendModeChange={onAssistantSendModeChange}
        onCodexCliPathChange={onCodexCliPathChange}
        onRunAgentProbe={onRunAgentProbe}
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

  if (activeTab === "library") {
    return (
      <LibrarySettingsPanel
        libraryPath={libraryPath}
        libraryStatus={libraryStatus}
        activeLibraryName={activeLibraryName}
        libraryCount={libraryCount}
        projectCount={projectCount}
        activeProjectTitle={activeProjectTitle}
        onOpenLibrary={onOpenLibrary}
        onManageLibraries={onManageLibraries}
      />
    );
  }

  return <SettingsAboutPanel />;
}
