/**
 * [INPUT]: 依赖 shadcn/ui 基础控件、lucide-react、React 运行时、设置模块、应用级发布目标、shared 公共契约与全局设置 Dialog 表面 Token
 * [OUTPUT]: 对外提供 SettingsDialogProps、SettingsDialog
 * [POS]: 设置 feature 的界面组合单元，连接 设置 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { SETTINGS_TABS, type SettingsTabId } from "@/features/settings/constants/settingsDialog";
import type {
  AppThemePreference,
  AiQuickPrompt,
  AgentProvider,
  AssistantSendMode,
  EditorThemeId,
  EditorTypographySettings,
  ImageReferenceFormat,
  MarkdownFormattingSettings,
  ResolvedAppTheme,
} from "@/shared/types";
import { SettingsDialogSidebar } from "@/features/settings/components/SettingsDialogSidebar";
import { SettingsPanelContent } from "@/features/settings/components/SettingsPanelContent";
import type { LibraryRebuildProgress, LibraryRebuildSummary } from "@/features/library/model/persistence";
import type { GitHubBlogPublishingTarget, PublishingTargetStore } from "@/features/publishing/model/publishingTargets";

export interface SettingsDialogProps {
  open: boolean;
  initialTab?: SettingsTabId;
  libraryPath: string;
  libraryStatus: string;
  projectCount: number;
  focusMode: boolean;
  typewriterMode: boolean;
  goalCelebrationEnabled: boolean;
  appTheme: AppThemePreference;
  appThemeOverride: ResolvedAppTheme | null;
  resolvedAppTheme: ResolvedAppTheme;
  editorTheme: EditorThemeId;
  editorTypography: EditorTypographySettings;
  imageReferenceFormat: ImageReferenceFormat;
  markdownFormatting: MarkdownFormattingSettings;
  sheetPreviewMode: boolean;
  assistantSendMode: AssistantSendMode;
  agentProvider: AgentProvider;
  providerBaseUrl: string;
  credentialConfigured: boolean;
  credentialBusy: boolean;
  credentialMessage: string;
  quickPrompts: AiQuickPrompt[];
  quickPromptsReady: boolean;
  publishingTargets: PublishingTargetStore;
  publishingTargetsReady: boolean;
  publishingTargetsError: string;
  onClose: () => void;
  onFocusModeChange: (enabled: boolean) => void;
  onTypewriterModeChange: (enabled: boolean) => void;
  onGoalCelebrationEnabledChange: (enabled: boolean) => void;
  onAppThemeChange: (theme: AppThemePreference) => void;
  onEditorThemeChange: (theme: EditorThemeId) => void;
  onEditorTypographyChange: (settings: EditorTypographySettings) => void;
  onImageReferenceFormatChange: (format: ImageReferenceFormat) => void;
  onMarkdownFormattingChange: (settings: MarkdownFormattingSettings) => void;
  onSheetPreviewModeChange: (enabled: boolean) => void;
  onAssistantSendModeChange: (mode: AssistantSendMode) => void;
  onAgentProviderChange: (provider: AgentProvider) => void;
  onProviderBaseUrlChange: (url: string) => void;
  onSaveCredential: (secret: string) => Promise<void>;
  onDeleteCredential: () => Promise<void>;
  onAddQuickPrompt: (title: string, content: string) => void;
  onEditQuickPrompt: (promptId: string, title: string, content: string) => void;
  onDeleteQuickPrompt: (promptId: string) => void;
  onMoveQuickPrompt: (promptId: string, direction: -1 | 1) => void;
  onSavePublishingTarget: (target: GitHubBlogPublishingTarget) => Promise<unknown>;
  onRevealLibrary: () => void;
  onOpenExistingLibrary: () => Promise<void>;
  onMoveLibrary: () => Promise<void>;
  onRebuildLibraryIndex: (onProgress?: (progress: LibraryRebuildProgress) => void) => Promise<LibraryRebuildSummary>;
}

export function SettingsDialog({
  open,
  initialTab = "writing",
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
  agentProvider,
  providerBaseUrl,
  credentialConfigured,
  credentialBusy,
  credentialMessage,
  quickPrompts,
  quickPromptsReady,
  publishingTargets,
  publishingTargetsReady,
  publishingTargetsError,
  onClose,
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
  onAgentProviderChange,
  onProviderBaseUrlChange,
  onSaveCredential,
  onDeleteCredential,
  onAddQuickPrompt,
  onEditQuickPrompt,
  onDeleteQuickPrompt,
  onMoveQuickPrompt,
  onSavePublishingTarget,
  onRevealLibrary,
  onOpenExistingLibrary,
  onMoveLibrary,
  onRebuildLibraryIndex,
}: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);
  const activeTabTitle = useMemo(() => SETTINGS_TABS.find((tab) => tab.id === activeTab)?.label ?? "设置", [activeTab]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="grid h-[min(600px,calc(100vh-56px))] min-h-115 w-[min(820px,calc(100vw-56px))] max-w-[min(820px,calc(100vw-56px))] grid-cols-[190px_minmax(0,1fr)] gap-0 overflow-hidden rounded-2xl border border-[var(--settings-dialog-divider)] bg-[var(--settings-dialog-content-background)] p-0 shadow-2xl sm:max-w-[min(820px,calc(100vw-56px))] max-[1180px]:h-[min(600px,calc(100vh-32px))] max-[1180px]:w-[min(760px,calc(100vw-32px))] max-[1180px]:max-w-[min(760px,calc(100vw-32px))] max-[1180px]:grid-cols-[172px_minmax(0,1fr)]"
      >
        <SettingsDialogSidebar activeTab={activeTab} onActiveTabChange={setActiveTab} />

        <div className="flex min-h-0 min-w-0 flex-col bg-[var(--settings-dialog-content-background)]">
          <header className="flex min-h-14.5 flex-none items-center justify-between gap-3 border-b border-[var(--settings-dialog-divider)] px-4.5">
            <div>
              <DialogTitle className="m-0 text-base font-bold">{activeTabTitle}</DialogTitle>
              <DialogDescription className="sr-only">配置落笔的写作、外观、AI 助手、发布和本地文件存储选项。</DialogDescription>
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
              projectCount={projectCount}
              focusMode={focusMode}
              typewriterMode={typewriterMode}
              goalCelebrationEnabled={goalCelebrationEnabled}
              appTheme={appTheme}
              appThemeOverride={appThemeOverride}
              resolvedAppTheme={resolvedAppTheme}
              editorTheme={editorTheme}
              editorTypography={editorTypography}
              imageReferenceFormat={imageReferenceFormat}
              markdownFormatting={markdownFormatting}
              sheetPreviewMode={sheetPreviewMode}
              assistantSendMode={assistantSendMode}
              agentProvider={agentProvider}
              providerBaseUrl={providerBaseUrl}
              credentialConfigured={credentialConfigured}
              credentialBusy={credentialBusy}
              credentialMessage={credentialMessage}
              quickPrompts={quickPrompts}
              quickPromptsReady={quickPromptsReady}
              publishingTargets={publishingTargets}
              publishingTargetsReady={publishingTargetsReady}
              publishingTargetsError={publishingTargetsError}
              onFocusModeChange={onFocusModeChange}
              onTypewriterModeChange={onTypewriterModeChange}
              onGoalCelebrationEnabledChange={onGoalCelebrationEnabledChange}
              onAppThemeChange={onAppThemeChange}
              onEditorThemeChange={onEditorThemeChange}
              onEditorTypographyChange={onEditorTypographyChange}
              onImageReferenceFormatChange={onImageReferenceFormatChange}
              onMarkdownFormattingChange={onMarkdownFormattingChange}
              onSheetPreviewModeChange={onSheetPreviewModeChange}
              onAssistantSendModeChange={onAssistantSendModeChange}
              onAgentProviderChange={onAgentProviderChange}
              onProviderBaseUrlChange={onProviderBaseUrlChange}
              onSaveCredential={onSaveCredential}
              onDeleteCredential={onDeleteCredential}
              onAddQuickPrompt={onAddQuickPrompt}
              onEditQuickPrompt={onEditQuickPrompt}
              onDeleteQuickPrompt={onDeleteQuickPrompt}
              onMoveQuickPrompt={onMoveQuickPrompt}
              onSavePublishingTarget={onSavePublishingTarget}
              onRevealLibrary={onRevealLibrary}
              onOpenExistingLibrary={onOpenExistingLibrary}
              onMoveLibrary={onMoveLibrary}
              onRebuildLibraryIndex={onRebuildLibraryIndex}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
