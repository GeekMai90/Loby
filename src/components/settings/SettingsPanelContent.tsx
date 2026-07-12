import type { SettingsTabId } from "../../constants/settingsDialog";
import type { SettingsDialogProps } from "../SettingsDialog";
import { AiSettingsPanel, LibrarySettingsPanel, SettingsAboutPanel, WritingSettingsPanel } from "./SettingsPanels";
import { AppearanceSettingsPanel } from "./AppearanceSettingsPanel";
import { PublishingSettingsPanel } from "./PublishingSettingsPanel";

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
  | "appTheme"
  | "resolvedAppTheme"
  | "editorTheme"
  | "editorTypography"
  | "imageReferenceFormat"
  | "sheetPreviewMode"
  | "planMode"
  | "agentProvider"
  | "codexCliPath"
  | "claudeCliPath"
  | "probeSummary"
  | "probeBusy"
  | "onFocusModeChange"
  | "onTypewriterModeChange"
  | "onAppThemeChange"
  | "onEditorThemeChange"
  | "onEditorTypographyChange"
  | "onImageReferenceFormatChange"
  | "onSheetPreviewModeChange"
  | "onPlanModeChange"
  | "onAgentProviderChange"
  | "onCodexCliPathChange"
  | "onClaudeCliPathChange"
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
  appTheme,
  resolvedAppTheme,
  editorTheme,
  editorTypography,
  imageReferenceFormat,
  sheetPreviewMode,
  planMode,
  agentProvider,
  codexCliPath,
  claudeCliPath,
  probeSummary,
  probeBusy,
  onFocusModeChange,
  onTypewriterModeChange,
  onAppThemeChange,
  onEditorThemeChange,
  onEditorTypographyChange,
  onImageReferenceFormatChange,
  onSheetPreviewModeChange,
  onPlanModeChange,
  onAgentProviderChange,
  onCodexCliPathChange,
  onClaudeCliPathChange,
  onRunAgentProbe,
  onManageLibraries,
  onOpenLibrary,
}: SettingsPanelContentProps) {
  if (activeTab === "writing") {
    return (
      <WritingSettingsPanel
        focusMode={focusMode}
        typewriterMode={typewriterMode}
        sheetPreviewMode={sheetPreviewMode}
        imageReferenceFormat={imageReferenceFormat}
        editorTypography={editorTypography}
        onFocusModeChange={onFocusModeChange}
        onTypewriterModeChange={onTypewriterModeChange}
        onSheetPreviewModeChange={onSheetPreviewModeChange}
        onImageReferenceFormatChange={onImageReferenceFormatChange}
        onEditorTypographyChange={onEditorTypographyChange}
      />
    );
  }

  if (activeTab === "ai") {
    return (
      <AiSettingsPanel
        agentProvider={agentProvider}
        planMode={planMode}
        codexCliPath={codexCliPath}
        claudeCliPath={claudeCliPath}
        probeSummary={probeSummary}
        probeBusy={probeBusy}
        onAgentProviderChange={onAgentProviderChange}
        onPlanModeChange={onPlanModeChange}
        onCodexCliPathChange={onCodexCliPathChange}
        onClaudeCliPathChange={onClaudeCliPathChange}
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
