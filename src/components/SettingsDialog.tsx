import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SETTINGS_TABS, type SettingsTabId } from "../constants/settingsDialog";
import type { AgentProvider, EditorTypographySettings, ImageReferenceFormat } from "../types";
import { SettingsDialogSidebar } from "./settings/SettingsDialogSidebar";
import { SettingsPanelContent } from "./settings/SettingsPanelContent";

export interface SettingsDialogProps {
  open: boolean;
  libraryPath: string;
  libraryStatus: string;
  projectCount: number;
  activeProjectTitle: string;
  focusMode: boolean;
  typewriterMode: boolean;
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
  onEditorTypographyChange: (settings: EditorTypographySettings) => void;
  onImageReferenceFormatChange: (format: ImageReferenceFormat) => void;
  onSheetPreviewModeChange: (enabled: boolean) => void;
  onPlanModeChange: (enabled: boolean) => void;
  onAgentProviderChange: (provider: AgentProvider) => void;
  onCodexCliPathChange: (path: string) => void;
  onClaudeCliPathChange: (path: string) => void;
  onRunAgentProbe: () => void;
  onSwitchLibrary: () => void;
  onOpenLibrary: () => void;
}

export function SettingsDialog({
  open,
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
  onClose,
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
}: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>("writing");
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
              projectCount={projectCount}
              activeProjectTitle={activeProjectTitle}
              focusMode={focusMode}
              typewriterMode={typewriterMode}
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
              onEditorTypographyChange={onEditorTypographyChange}
              onImageReferenceFormatChange={onImageReferenceFormatChange}
              onSheetPreviewModeChange={onSheetPreviewModeChange}
              onPlanModeChange={onPlanModeChange}
              onAgentProviderChange={onAgentProviderChange}
              onCodexCliPathChange={onCodexCliPathChange}
              onClaudeCliPathChange={onClaudeCliPathChange}
              onRunAgentProbe={onRunAgentProbe}
              onSwitchLibrary={onSwitchLibrary}
              onOpenLibrary={onOpenLibrary}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
