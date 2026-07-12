import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SETTINGS_TABS, type SettingsTabId } from "../constants/settingsDialog";
import type {
  AgentProvider,
  AppThemePreference,
  EditorThemeId,
  EditorTypographySettings,
  ImageReferenceFormat,
  ResolvedAppTheme,
} from "../types";
import { SettingsDialogSidebar } from "./settings/SettingsDialogSidebar";
import { SettingsPanelContent } from "./settings/SettingsPanelContent";

export interface SettingsDialogProps {
  open: boolean;
  initialTab?: SettingsTabId;
  libraryPath: string;
  libraryStatus: string;
  activeLibraryName: string;
  libraryCount: number;
  projectCount: number;
  activeProjectTitle: string;
  focusMode: boolean;
  typewriterMode: boolean;
  appTheme: AppThemePreference;
  resolvedAppTheme: ResolvedAppTheme;
  editorTheme: EditorThemeId;
  editorTypography: EditorTypographySettings;
  imageReferenceFormat: ImageReferenceFormat;
  sheetPreviewMode: boolean;
  planMode: boolean;
  agentProvider: AgentProvider;
  codexCliPath: string;
  claudeCliPath: string;
  probeSummary: string;
  probeBusy: boolean;
  onClose: () => void;
  onFocusModeChange: (enabled: boolean) => void;
  onTypewriterModeChange: (enabled: boolean) => void;
  onAppThemeChange: (theme: AppThemePreference) => void;
  onEditorThemeChange: (theme: EditorThemeId) => void;
  onEditorTypographyChange: (settings: EditorTypographySettings) => void;
  onImageReferenceFormatChange: (format: ImageReferenceFormat) => void;
  onSheetPreviewModeChange: (enabled: boolean) => void;
  onPlanModeChange: (enabled: boolean) => void;
  onAgentProviderChange: (provider: AgentProvider) => void;
  onCodexCliPathChange: (path: string) => void;
  onClaudeCliPathChange: (path: string) => void;
  onRunAgentProbe: () => void;
  onManageLibraries: () => void;
  onOpenLibrary: () => void;
}

export function SettingsDialog({
  open,
  initialTab = "writing",
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
  onClose,
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
}: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);
  const activeTabTitle = useMemo(() => SETTINGS_TABS.find((tab) => tab.id === activeTab)?.label ?? "设置", [activeTab]);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop settings-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <SettingsDialogSidebar activeTab={activeTab} onActiveTabChange={setActiveTab} />

        <div className="settings-content">
          <header className="settings-content-header">
            <h3>{activeTabTitle}</h3>
            <button type="button" className="icon-button settings-close-button" onClick={onClose} title="关闭设置">
              <X size={17} />
            </button>
          </header>

          <div className="settings-panel">
            <SettingsPanelContent
              activeTab={activeTab}
              libraryPath={libraryPath}
              libraryStatus={libraryStatus}
              activeLibraryName={activeLibraryName}
              libraryCount={libraryCount}
              projectCount={projectCount}
              activeProjectTitle={activeProjectTitle}
              focusMode={focusMode}
              typewriterMode={typewriterMode}
              appTheme={appTheme}
              resolvedAppTheme={resolvedAppTheme}
              editorTheme={editorTheme}
              editorTypography={editorTypography}
              imageReferenceFormat={imageReferenceFormat}
              sheetPreviewMode={sheetPreviewMode}
              planMode={planMode}
              agentProvider={agentProvider}
              codexCliPath={codexCliPath}
              claudeCliPath={claudeCliPath}
              probeSummary={probeSummary}
              probeBusy={probeBusy}
              onFocusModeChange={onFocusModeChange}
              onTypewriterModeChange={onTypewriterModeChange}
              onAppThemeChange={onAppThemeChange}
              onEditorThemeChange={onEditorThemeChange}
              onEditorTypographyChange={onEditorTypographyChange}
              onImageReferenceFormatChange={onImageReferenceFormatChange}
              onSheetPreviewModeChange={onSheetPreviewModeChange}
              onPlanModeChange={onPlanModeChange}
              onAgentProviderChange={onAgentProviderChange}
              onCodexCliPathChange={onCodexCliPathChange}
              onClaudeCliPathChange={onClaudeCliPathChange}
              onRunAgentProbe={onRunAgentProbe}
              onManageLibraries={onManageLibraries}
              onOpenLibrary={onOpenLibrary}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
