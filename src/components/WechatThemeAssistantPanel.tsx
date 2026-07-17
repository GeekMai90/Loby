import { Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { buildModelOptions, formatReasoningLevel, getReasoningLevels, modelSupportsQuickMode } from "../lib/assistantComposer";
import type { CodexModelCatalog } from "../types";
import type { WechatThemeConversation, WechatThemeConversationMessage } from "../lib/publishing/wechatThemeStore";
import { AssistantImageAttachments } from "./AssistantImageAttachments";
import {
  ASSISTANT_IMAGE_ACCEPT,
  getAssistantImageFilesFromClipboard,
  getAssistantImageFilesFromDataTransfer,
} from "../lib/assistantImageAttachments";
import { useAssistantImageAttachments } from "../hooks/useAssistantImageAttachments";
import type { AiImageAttachment } from "../types";
import { AssistantComposerShell } from "./AssistantComposerShell";
import { AssistantComposerToolbar } from "./AssistantComposerToolbar";
import { AssistantEmptyState, AssistantThreadViewport } from "./AssistantPanelChrome";
import { AssistantStaticMessage } from "./AssistantMessageSurface";
import { AiPanelHeader } from "./AiPanelHeader";

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
    <aside className="relative flex min-h-0 min-w-0 flex-col border-l border-border bg-background px-3 pb-1.5 text-sm">
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
        <AssistantThreadViewport>
          {messages.length === 0 ? (
            <AssistantEmptyState
              title="直接描述你想要的样子"
              description="AI 会直接修改当前主题，中间预览会实时更新。所有有效修改都会自动保存并可撤销。"
              icon={
                <div className="mx-auto mb-3 flex size-9 items-center justify-center rounded-xl bg-primary/8 text-primary">
                  <Sparkles className="size-4" />
                </div>
              }
              actions={
                <div className="mt-5 grid grid-cols-1 gap-1.5">
                  {SUGGESTIONS.map((suggestion) => (
                    <Button
                      key={suggestion}
                      type="button"
                      variant="outline"
                      className="h-8 justify-start px-2.5 text-xs font-normal"
                      onClick={() => submit(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              }
            />
          ) : (
            messages.map((message) => (
              <AssistantStaticMessage
                key={message.id}
                role={message.role}
                content={message.content}
                images={message.images}
                run={message.run}
                error={message.error}
              />
            ))
          )}
          {busy && !hasRunningMessage ? <AssistantStaticMessage role="assistant" content="" pending /> : null}
        </AssistantThreadViewport>

        <AssistantComposerShell
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
          <div className="block min-h-19 min-w-0">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="例如：主色换成墨绿色，标题更克制"
              rows={3}
              disabled={busy}
              className="resize-none rounded-none border-0 px-1 shadow-none focus-visible:border-transparent focus-visible:ring-0"
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
            onAttachImages={() => fileInputRef.current?.click()}
            attachmentDisabled={busy || attachmentSaving}
          />
        </AssistantComposerShell>
      </div>
    </aside>
  );
}
