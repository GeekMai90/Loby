/**
 * [INPUT]: 依赖 lucide-react、React 运行时、shadcn/ui 基础控件、AI 助手模块、shared 公共契约、发布模块
 * [OUTPUT]: 对外提供 WechatThemeAssistantMessage、WechatThemeAssistantPanel
 * [POS]: 发布 feature 的界面组合单元，连接 发布 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Plus, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  buildModelOptions,
  formatReasoningLevel,
  getReasoningLevels,
  modelSupportsQuickMode,
} from "@/features/assistant/model/assistantComposer";
import { resizeTextareaToContent } from "@/shared/lib/textarea";
import type { AiImageAttachment, CodexModelCatalog } from "@/shared/types";
import type { WechatThemeConversation, WechatThemeConversationMessage } from "@/features/publishing/model/wechatThemeStore";
import { AssistantImageAttachments } from "@/features/assistant/components/AssistantImageAttachments";
import {
  ASSISTANT_IMAGE_ACCEPT,
  getAssistantImageFilesFromClipboard,
  getAssistantImageFilesFromDataTransfer,
} from "@/features/assistant/model/assistantImageAttachments";
import { useAssistantImageAttachments } from "@/features/assistant/hooks/useAssistantImageAttachments";
import { AssistantComposerShell } from "@/features/assistant/components/AssistantComposerShell";
import { AssistantComposerTextarea } from "@/features/assistant/components/AssistantComposerTextarea";
import { AssistantComposerToolbar } from "@/features/assistant/components/AssistantComposerToolbar";
import {
  ASSISTANT_PROMPT_ACTION_CLASS_NAME,
  AssistantPromptEmptyState,
  AssistantThreadViewport,
} from "@/features/assistant/components/AssistantPanelChrome";
import { AssistantStaticMessage } from "@/features/assistant/components/AssistantMessageSurface";
import { AiPanelHeader } from "@/features/assistant/components/AiPanelHeader";

export type WechatThemeAssistantMessage = WechatThemeConversationMessage;

interface WechatThemeAssistantPanelProps {
  messages: WechatThemeAssistantMessage[];
  conversations: WechatThemeConversation[];
  activeConversationId: string;
  busy: boolean;
  modelCatalog: CodexModelCatalog | null;
  agentModel: string;
  agentReasoningEffort: string;
  agentQuickMode: boolean;
  onModelChange: (value: string) => void;
  onReasoningEffortChange: (value: string) => void;
  onQuickModeChange: (enabled: boolean) => void;
  onSend: (prompt: string, images: AiImageAttachment[]) => void;
  onCancel?: () => Promise<void> | void;
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: () => void;
  onDeleteConversation: () => void;
  onRenameConversation: (conversationId: string, title: string) => void;
}

const SUGGESTIONS = ["整体更简洁一点", "标题更有层次感", "换成温暖的配色", "弱化引用框的存在感"];

export function WechatThemeAssistantPanel({
  messages,
  conversations,
  activeConversationId,
  busy,
  modelCatalog,
  agentModel,
  agentReasoningEffort,
  agentQuickMode,
  onModelChange,
  onReasoningEffortChange,
  onQuickModeChange,
  onSend,
  onCancel,
  onSelectConversation,
  onCreateConversation,
  onDeleteConversation,
  onRenameConversation,
}: WechatThemeAssistantPanelProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    attachments,
    saving: attachmentSaving,
    error: attachmentError,
    addFiles,
    removeAttachment,
    clearAttachments,
  } = useAssistantImageAttachments();
  const modelOptions = buildModelOptions(modelCatalog, agentModel);
  const reasoningOptions = getReasoningLevels(modelCatalog, agentModel, agentReasoningEffort).map((level) => ({
    value: level,
    label: formatReasoningLevel(level),
  }));
  const canSend = !busy && !attachmentSaving && Boolean(draft.trim() || attachments.length > 0);
  const hasRunningMessage = messages.some((message) => message.run?.status === "running");

  useEffect(() => {
    resizeTextareaToContent(inputRef.current);
  }, [draft]);

  function submit(prompt = draft) {
    const value = prompt.trim();
    if ((!value && attachments.length === 0) || busy || attachmentSaving) return;
    setDraft("");
    clearAttachments();
    onSend(value, attachments);
  }

  function changeModel(nextModel: string) {
    onModelChange(nextModel);
    const model = modelCatalog?.models.find((item) => item.slug === nextModel);
    if (model?.defaultReasoningLevel) onReasoningEffortChange(model.defaultReasoningLevel);
  }

  return (
    <aside
      data-slot="wechat-theme-assistant-panel"
      className="relative flex min-h-0 min-w-0 flex-col overflow-hidden border-l border-border bg-background text-sm [--assistant-panel-gutter:10px]"
    >
      <AiPanelHeader
        messages={messages}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={onSelectConversation}
        onCreateConversation={onCreateConversation}
        onDeleteConversation={onDeleteConversation}
        onRenameConversation={onRenameConversation}
        conversationActionsDisabled={busy}
      />
      <div className="flex min-h-0 flex-auto flex-col gap-2.5">
        <AssistantThreadViewport className="px-[var(--assistant-panel-gutter)]">
          {messages.length === 0 ? (
            <AssistantPromptEmptyState
              title="✨ 直接描述你想要的样子"
              description="AI 会直接修改当前主题，中间预览会实时更新。所有有效修改都会自动保存并可撤销。"
            >
              <div className="mt-4 grid gap-0">
                {SUGGESTIONS.map((suggestion) => (
                  <Button
                    key={suggestion}
                    type="button"
                    variant="ghost"
                    className={ASSISTANT_PROMPT_ACTION_CLASS_NAME}
                    onClick={() => submit(suggestion)}
                  >
                    <Sparkles />
                    {suggestion}
                  </Button>
                ))}
              </div>
            </AssistantPromptEmptyState>
          ) : (
            messages.map((message) => (
              <AssistantStaticMessage
                key={message.id}
                role={message.role}
                content={message.content}
                attachments={message.images}
                run={message.run}
                error={message.error}
              />
            ))
          )}
          {busy && !hasRunningMessage ? <AssistantStaticMessage role="assistant" content="" pending /> : null}
        </AssistantThreadViewport>

        <AssistantComposerShell
          glowActive={busy}
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept={ASSISTANT_IMAGE_ACCEPT}
            multiple
            tabIndex={-1}
            onChange={(event) => {
              void addFiles(Array.from(event.target.files ?? []));
              event.currentTarget.value = "";
            }}
          />
          <AssistantImageAttachments attachments={attachments} onRemove={attachmentSaving ? undefined : removeAttachment} />
          {attachmentError && <p className="px-1 text-xs leading-4 text-destructive">{attachmentError}</p>}
          {attachmentSaving && <p className="px-1 text-xs leading-4 text-muted-foreground">正在保存图片附件…</p>}
          <div data-slot="assistant-composer-input-group" className="grid gap-0">
            <div className="block min-w-0">
              <AssistantComposerTextarea
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="例如：主色换成墨绿色，标题更克制"
                aria-label="给 AI 助手发送消息"
                disabled={busy}
                onPaste={(event) => {
                  const files = getAssistantImageFilesFromClipboard(event.clipboardData);
                  if (files.length === 0) return;
                  event.preventDefault();
                  void addFiles(files);
                }}
                onDragOver={(event) => {
                  if (event.dataTransfer.types.includes("Files")) event.preventDefault();
                }}
                onDrop={(event) => {
                  const files = getAssistantImageFilesFromDataTransfer(event.dataTransfer);
                  if (files.length === 0) return;
                  event.preventDefault();
                  void addFiles(files);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    submit();
                  }
                }}
              />
            </div>
          </div>
          <AssistantComposerToolbar
            busy={busy}
            canSend={canSend}
            modelOptions={modelOptions}
            reasoningOptions={reasoningOptions}
            agentModel={agentModel}
            agentReasoningEffort={agentReasoningEffort}
            agentQuickMode={agentQuickMode}
            quickModeSupported={modelSupportsQuickMode(modelCatalog, agentModel)}
            onModelChange={changeModel}
            onReasoningEffortChange={onReasoningEffortChange}
            onQuickModeChange={onQuickModeChange}
            onCancel={onCancel}
            onAttachAttachments={() => fileInputRef.current?.click()}
            attachmentTitle="添加图片"
            attachmentDisabled={busy || attachmentSaving}
            attachmentIcon={<Plus />}
          />
        </AssistantComposerShell>
      </div>
    </aside>
  );
}
