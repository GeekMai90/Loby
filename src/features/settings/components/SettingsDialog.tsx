/**
 * [INPUT]: 依赖 shadcn/ui 基础控件、lucide-react、React 运行时、设置模块、收件箱新文稿默认值、应用级发布目标、shared 公共契约与全局设置 Dialog 表面 Token
 * [OUTPUT]: 对外提供包含收件箱默认值读写契约且不暴露图片方言偏好的 SettingsDialogProps、SettingsDialog
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
  AgentModel,
  AgentModelCatalog,
  AgentProvider,
  AgentReasoningEffort,
  AssistantSendMode,
  EditorThemeId,
  EditorTypographySettings,
  MarkdownFormattingSettings,
} from "@/shared/types";
import { SettingsDialogSidebar } from "@/features/settings/components/SettingsDialogSidebar";
import { SettingsPanelContent } from "@/features/settings/components/SettingsPanelContent";
import type { LibraryRebuildProgress, LibraryRebuildSummary } from "@/features/library/model/persistence";
import type { PublishingTarget, PublishingTargetStore } from "@/features/publishing/model/publishingTargets";

export interface SettingsDialogProps {
  open: boolean;
  initialTab?: SettingsTabId;
  libraryPath: string;
  inboxTargetWords: number;
  goalCelebrationEnabled: boolean;
  appTheme: AppThemePreference;
  editorTheme: EditorThemeId;
  editorTypography: EditorTypographySettings;
  markdownFormatting: MarkdownFormattingSettings;
  assistantSendMode: AssistantSendMode;
  agentProvider: AgentProvider;
  providerBaseUrl: string;
  agentModel: AgentModel;
  agentReasoningEffort: AgentReasoningEffort;
  modelCatalog: AgentModelCatalog | null;
  quickPrompts: AiQuickPrompt[];
  quickPromptsReady: boolean;
  publishingTargets: PublishingTargetStore;
  publishingTargetsReady: boolean;
  publishingTargetsError: string;
  onClose: () => void;
  onInboxTargetWordsChange: (targetWords: number) => void;
  onGoalCelebrationEnabledChange: (enabled: boolean) => void;
  onAppThemeChange: (theme: AppThemePreference) => void;
  onEditorThemeChange: (theme: EditorThemeId) => void;
  onEditorTypographyChange: (settings: EditorTypographySettings) => void;
  onMarkdownFormattingChange: (settings: MarkdownFormattingSettings) => void;
  onAssistantSendModeChange: (mode: AssistantSendMode) => void;
  onAgentProviderChange: (provider: AgentProvider) => void;
  onProviderBaseUrlChange: (url: string) => void;
  onAgentModelChange: (model: AgentModel) => void;
  onAgentReasoningEffortChange: (effort: AgentReasoningEffort) => void;
  onAddQuickPrompt: (title: string, content: string) => void;
  onEditQuickPrompt: (promptId: string, title: string, content: string) => void;
  onDeleteQuickPrompt: (promptId: string) => void;
  onMoveQuickPrompt: (promptId: string, direction: -1 | 1) => void;
  onSavePublishingTarget: (target: PublishingTarget) => Promise<unknown>;
  onRevealLibrary: () => void;
  onOpenExistingLibrary: () => Promise<void>;
  onMoveLibrary: () => Promise<void>;
  onRebuildLibraryIndex: (onProgress?: (progress: LibraryRebuildProgress) => void) => Promise<LibraryRebuildSummary>;
}

export function SettingsDialog({
  open,
  initialTab = "appearance",
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
  onClose,
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
}: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);
  const activeTabTitle = useMemo(() => SETTINGS_TABS.find((tab) => tab.id === activeTab)?.label ?? "设置", [activeTab]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="grid h-[min(660px,calc(100vh-56px))] min-h-115 w-[min(900px,calc(100vw-56px))] max-w-[min(900px,calc(100vw-56px))] grid-cols-[190px_minmax(0,1fr)] gap-0 overflow-hidden rounded-2xl border border-[var(--settings-dialog-divider)] bg-[var(--settings-dialog-content-background)] p-0 shadow-2xl sm:max-w-[min(900px,calc(100vw-56px))] max-[1180px]:h-[min(620px,calc(100vh-32px))] max-[1180px]:w-[min(820px,calc(100vw-32px))] max-[1180px]:max-w-[min(820px,calc(100vw-32px))] max-[1180px]:grid-cols-[172px_minmax(0,1fr)]"
      >
        <SettingsDialogSidebar activeTab={activeTab} onActiveTabChange={setActiveTab} />

        <div className="flex min-h-0 min-w-0 flex-col bg-[var(--settings-dialog-content-background)]">
          <header className="flex min-h-14.5 flex-none items-center justify-between gap-3 border-b border-[var(--settings-dialog-divider)] px-4.5">
            <div>
              <DialogTitle className="m-0 text-base font-bold">{activeTabTitle}</DialogTitle>
              <DialogDescription className="sr-only">配置落笔的通用、写作、AI 助手、发布和本地文件存储选项。</DialogDescription>
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
              inboxTargetWords={inboxTargetWords}
              goalCelebrationEnabled={goalCelebrationEnabled}
              appTheme={appTheme}
              editorTheme={editorTheme}
              editorTypography={editorTypography}
              markdownFormatting={markdownFormatting}
              assistantSendMode={assistantSendMode}
              agentProvider={agentProvider}
              providerBaseUrl={providerBaseUrl}
              agentModel={agentModel}
              agentReasoningEffort={agentReasoningEffort}
              modelCatalog={modelCatalog}
              quickPrompts={quickPrompts}
              quickPromptsReady={quickPromptsReady}
              publishingTargets={publishingTargets}
              publishingTargetsReady={publishingTargetsReady}
              publishingTargetsError={publishingTargetsError}
              onInboxTargetWordsChange={onInboxTargetWordsChange}
              onGoalCelebrationEnabledChange={onGoalCelebrationEnabledChange}
              onAppThemeChange={onAppThemeChange}
              onEditorThemeChange={onEditorThemeChange}
              onEditorTypographyChange={onEditorTypographyChange}
              onMarkdownFormattingChange={onMarkdownFormattingChange}
              onAssistantSendModeChange={onAssistantSendModeChange}
              onAgentProviderChange={onAgentProviderChange}
              onProviderBaseUrlChange={onProviderBaseUrlChange}
              onAgentModelChange={onAgentModelChange}
              onAgentReasoningEffortChange={onAgentReasoningEffortChange}
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
