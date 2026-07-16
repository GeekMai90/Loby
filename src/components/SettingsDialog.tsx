import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { SETTINGS_TABS, type SettingsTabId } from "../constants/settingsDialog";
import type {
  AppThemePreference,
  AssistantSendMode,
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
  assistantSendMode: AssistantSendMode;
  codexCliPath: string;
  probeStatus: string;
  probeDetail: string;
  probeBusy: boolean;
  onClose: () => void;
  onFocusModeChange: (enabled: boolean) => void;
  onTypewriterModeChange: (enabled: boolean) => void;
  onAppThemeChange: (theme: AppThemePreference) => void;
  onEditorThemeChange: (theme: EditorThemeId) => void;
  onEditorTypographyChange: (settings: EditorTypographySettings) => void;
  onImageReferenceFormatChange: (format: ImageReferenceFormat) => void;
  onSheetPreviewModeChange: (enabled: boolean) => void;
  onAssistantSendModeChange: (mode: AssistantSendMode) => void;
  onCodexCliPathChange: (path: string) => void;
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
  assistantSendMode,
  codexCliPath,
  probeStatus,
  probeDetail,
  probeBusy,
  onClose,
  onFocusModeChange,
  onTypewriterModeChange,
  onAppThemeChange,
  onEditorThemeChange,
  onEditorTypographyChange,
  onImageReferenceFormatChange,
  onSheetPreviewModeChange,
  onAssistantSendModeChange,
  onCodexCliPathChange,
  onRunAgentProbe,
  onManageLibraries,
  onOpenLibrary,
}: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);
  const activeTabTitle = useMemo(() => SETTINGS_TABS.find((tab) => tab.id === activeTab)?.label ?? "设置", [activeTab]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="grid h-[min(600px,calc(100vh-56px))] min-h-115 w-[min(820px,calc(100vw-56px))] max-w-[min(820px,calc(100vw-56px))] grid-cols-[190px_minmax(0,1fr)] gap-0 overflow-hidden rounded-2xl border border-border bg-background p-0 shadow-2xl sm:max-w-[min(820px,calc(100vw-56px))] max-[1180px]:h-[min(600px,calc(100vh-32px))] max-[1180px]:w-[min(760px,calc(100vw-32px))] max-[1180px]:max-w-[min(760px,calc(100vw-32px))] max-[1180px]:grid-cols-[172px_minmax(0,1fr)]"
      >
        <SettingsDialogSidebar activeTab={activeTab} onActiveTabChange={setActiveTab} />

        <div className="flex min-h-0 min-w-0 flex-col bg-background">
          <header className="flex min-h-14.5 flex-none items-center justify-between gap-3 border-b border-border px-4.5">
            <div>
              <DialogTitle className="m-0 text-base font-bold">{activeTabTitle}</DialogTitle>
              <DialogDescription className="sr-only">配置 Nibva 的写作、外观、AI 助手、发布和写作库选项。</DialogDescription>
            </div>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="icon" title="关闭设置">
                <X size={17} />
              </Button>
            </DialogClose>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-4.5 overflow-auto p-4.5">
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
              assistantSendMode={assistantSendMode}
              codexCliPath={codexCliPath}
              probeStatus={probeStatus}
              probeDetail={probeDetail}
              probeBusy={probeBusy}
              onFocusModeChange={onFocusModeChange}
              onTypewriterModeChange={onTypewriterModeChange}
              onAppThemeChange={onAppThemeChange}
              onEditorThemeChange={onEditorThemeChange}
              onEditorTypographyChange={onEditorTypographyChange}
              onImageReferenceFormatChange={onImageReferenceFormatChange}
              onSheetPreviewModeChange={onSheetPreviewModeChange}
              onAssistantSendModeChange={onAssistantSendModeChange}
              onCodexCliPathChange={onCodexCliPathChange}
              onRunAgentProbe={onRunAgentProbe}
              onManageLibraries={onManageLibraries}
              onOpenLibrary={onOpenLibrary}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
