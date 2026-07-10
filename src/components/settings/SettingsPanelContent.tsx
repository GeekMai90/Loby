import type { SettingsTabId } from "../../constants/settingsDialog";
import type { SettingsDialogProps } from "../SettingsDialog";
import { AiSettingsPanel, LibrarySettingsPanel, SettingsAboutPanel, WritingSettingsPanel } from "./SettingsPanels";

type SettingsPanelContentProps = Pick<
  SettingsDialogProps,
  | "libraryPath"
  | "libraryStatus"
  | "projectCount"
  | "activeProjectTitle"
  | "focusMode"
  | "typewriterMode"
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
  | "onEditorTypographyChange"
  | "onImageReferenceFormatChange"
  | "onSheetPreviewModeChange"
  | "onPlanModeChange"
  | "onAgentProviderChange"
  | "onCodexCliPathChange"
  | "onClaudeCliPathChange"
  | "onRunAgentProbe"
  | "onSwitchLibrary"
  | "onOpenLibrary"
> & {
  activeTab: SettingsTabId;
};

export function SettingsPanelContent({
  activeTab,
  libraryPath,
  libraryStatus,
  projectCount,
  activeProjectTitle,
  focusMode,
  typewriterMode,
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
  onEditorTypographyChange,
  onImageReferenceFormatChange,
  onSheetPreviewModeChange,
  onPlanModeChange,
  onAgentProviderChange,
  onCodexCliPathChange,
  onClaudeCliPathChange,
  onRunAgentProbe,
  onSwitchLibrary,
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

  if (activeTab === "library") {
    return (
      <LibrarySettingsPanel
        libraryPath={libraryPath}
        libraryStatus={libraryStatus}
        projectCount={projectCount}
        activeProjectTitle={activeProjectTitle}
        onOpenLibrary={onOpenLibrary}
        onSwitchLibrary={onSwitchLibrary}
      />
    );
  }

  return <SettingsAboutPanel />;
}
