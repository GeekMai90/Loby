/**
 * [INPUT]: 依赖 lucide-react、React 运行时、shadcn/ui 基础控件、AI 助手通用附件链路、shared 公共契约、发布模块
 * [OUTPUT]: 对外提供 WechatThemeAssistantMessage、WechatThemeAssistantPanel
 * [POS]: 发布 feature 的界面组合单元，连接 发布 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { resizeTextareaToContent } from "@/shared/lib/textarea";
import type { AgentConversationSelection, AgentProvider, AiAttachment, AgentModelCatalog } from "@/shared/types";
import type { WechatThemeConversation, WechatThemeConversationMessage } from "@/features/publishing/model/wechatThemeStore";
import {
  ASSISTANT_ATTACHMENT_ACCEPT,
  createAssistantPastedTextFile,
  getAssistantFilesFromClipboard,
  getAssistantFilesFromDataTransfer,
  getAssistantTextFromClipboard,
  shouldMountAssistantPastedText,
} from "@/features/assistant/model/assistantAttachments";
import { useAssistantAttachments } from "@/features/assistant/hooks/useAssistantAttachments";
import { AssistantAttachments } from "@/features/assistant/components/AssistantAttachments";
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
  modelCatalog: AgentModelCatalog | null;
  agentProvider: AgentProvider;
  agentModel: string;
  agentReasoningEffort: string;
  onModelChange: (value: string) => void;
  onReasoningEffortChange: (value: string) => void;
  onSend: (prompt: string, attachments: AiAttachment[]) => void;
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
  agentProvider,
  agentModel,
  agentReasoningEffort,
  onModelChange,
  onReasoningEffortChange,
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
  } = useAssistantAttachments();
  const connections = [{ provider: agentProvider, label: "当前连接", modelCatalog }];
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

  function changeSelection(selection: AgentConversationSelection) {
    onModelChange(selection.model);
    onReasoningEffortChange(selection.reasoningEffort);
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
                attachments={message.attachments}
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
            accept={ASSISTANT_ATTACHMENT_ACCEPT}
            multiple
            tabIndex={-1}
            onChange={(event) => {
              void addFiles(Array.from(event.target.files ?? []));
              event.currentTarget.value = "";
            }}
          />
          <AssistantAttachments attachments={attachments} onRemove={attachmentSaving ? undefined : removeAttachment} />
          {attachmentError && <p className="px-1 text-xs leading-4 text-destructive">{attachmentError}</p>}
          {attachmentSaving && <p className="px-1 text-xs leading-4 text-muted-foreground">正在保存附件…</p>}
          <div data-slot="assistant-composer-input-group" className="grid gap-0">
            <div className="block min-w-0">
              <AssistantComposerTextarea
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="例如：主色换成墨绿色，标题更克制"
                aria-label="给 AI 助手发送消息"
                disabled={busy || attachmentSaving}
                onPaste={(event) => {
                  if (busy) return;
                  const files = getAssistantFilesFromClipboard(event.clipboardData);
                  if (files.length > 0) {
                    event.preventDefault();
                    void addFiles(files);
                    return;
                  }
                  const pastedText = getAssistantTextFromClipboard(event.clipboardData);
                  if (!shouldMountAssistantPastedText(pastedText)) return;
                  event.preventDefault();
                  void addFiles([createAssistantPastedTextFile(pastedText)]);
                }}
                onDragOver={(event) => {
                  if (!busy && event.dataTransfer.types.includes("Files")) event.preventDefault();
                }}
                onDrop={(event) => {
                  if (busy) return;
                  const files = getAssistantFilesFromDataTransfer(event.dataTransfer);
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
            connections={connections}
            agentProvider={agentProvider}
            agentModel={agentModel}
            agentReasoningEffort={agentReasoningEffort}
            onAgentSelectionChange={changeSelection}
            onCancel={onCancel}
            onAttachAttachments={() => fileInputRef.current?.click()}
            attachmentDisabled={busy || attachmentSaving}
          />
        </AssistantComposerShell>
      </div>
    </aside>
  );
}
