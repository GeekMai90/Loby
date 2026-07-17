import { ImagePlus, Send, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { buildModelOptions, formatReasoningLevel, getReasoningLevels, modelSupportsQuickMode } from "../lib/assistantComposer";
import type { CodexModelCatalog } from "../types";
import type { WechatThemeConversationMessage } from "../lib/publishing/wechatThemeStore";
import { AssistantModelSettingsMenu } from "./AssistantModelSettingsMenu";
import { AssistantImageAttachments } from "./AssistantImageAttachments";
import {
  ASSISTANT_IMAGE_ACCEPT,
  getAssistantImageFilesFromClipboard,
  getAssistantImageFilesFromDataTransfer,
} from "../lib/assistantImageAttachments";
import { useAssistantImageAttachments } from "../hooks/useAssistantImageAttachments";
import type { AiImageAttachment } from "../types";

export type WechatThemeAssistantMessage = WechatThemeConversationMessage;

interface WechatThemeAssistantPanelProps {
  messages: WechatThemeAssistantMessage[];
  busy: boolean;
  modelCatalog: CodexModelCatalog | null;
  agentModel: string;
  agentReasoningEffort: string;
  agentQuickMode: boolean;
  onModelChange: (value: string) => void;
  onReasoningEffortChange: (value: string) => void;
  onQuickModeChange: (enabled: boolean) => void;
  onSend: (prompt: string, images: AiImageAttachment[]) => void;
}

const SUGGESTIONS = ["整体更简洁一点", "标题更有层次感", "换成温暖的配色", "弱化引用框的存在感"];

export function WechatThemeAssistantPanel({
  messages,
  busy,
  modelCatalog,
  agentModel,
  agentReasoningEffort,
  agentQuickMode,
  onModelChange,
  onReasoningEffortChange,
  onQuickModeChange,
  onSend,
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

  function submit(prompt = draft) {
    const value = prompt.trim();
    if ((!value && attachments.length === 0) || busy || attachmentSaving) return;
    setDraft("");
    clearAttachments();
    onSend(value, attachments);
  }

  return (
    <aside className="flex min-h-0 min-w-0 flex-col border-l border-border bg-background">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3.5">
        <Sparkles className="size-4 text-primary" />
        <strong className="text-sm font-medium">主题 AI 助手</strong>
        <div className="min-w-0 flex-1" />
        <AssistantModelSettingsMenu
          modelOptions={modelOptions}
          reasoningOptions={reasoningOptions}
          agentModel={agentModel}
          agentReasoningEffort={agentReasoningEffort}
          agentQuickMode={agentQuickMode}
          quickModeSupported={modelSupportsQuickMode(modelCatalog, agentModel)}
          onModelChange={onModelChange}
          onReasoningEffortChange={onReasoningEffortChange}
          onQuickModeChange={onQuickModeChange}
        />
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 py-4">
        {messages.length === 0 ? (
          <div className="pt-5">
            <div className="mx-auto mb-3 flex size-9 items-center justify-center rounded-xl bg-primary/8 text-primary">
              <Sparkles className="size-4" />
            </div>
            <h2 className="text-center text-sm font-medium">直接描述你想要的样子</h2>
            <p className="mx-auto mt-1.5 max-w-58 text-center text-xs leading-5 text-muted-foreground">
              AI 会直接修改当前主题，中间预览会实时更新。所有有效修改都会自动保存并可撤销。
            </p>
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
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[92%] rounded-2xl px-3 py-2 text-xs leading-5 ${
                message.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : message.error
                    ? "border border-destructive/25 bg-destructive/6 text-destructive"
                    : "bg-muted text-foreground"
              }`}
            >
              {message.images?.length ? (
                <div className={message.content ? "mb-1.5" : ""}>
                  <AssistantImageAttachments attachments={message.images} size="message" />
                </div>
              ) : null}
              {message.content}
            </div>
          ))
        )}
        {busy && <div className="max-w-[92%] rounded-2xl bg-muted px-3 py-2 text-xs text-muted-foreground">正在调整主题并验证预览…</div>}
      </div>
      <form
        className="shrink-0 border-t border-border p-3"
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
        <div className="rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:border-primary/35 focus-within:ring-3 focus-within:ring-primary/10">
          <AssistantImageAttachments attachments={attachments} onRemove={attachmentSaving ? undefined : removeAttachment} />
          {attachmentError && <p className="mt-1 px-1 text-[11px] leading-4 text-destructive">{attachmentError}</p>}
          {attachmentSaving && <p className="mt-1 px-1 text-[11px] leading-4 text-muted-foreground">正在保存图片附件…</p>}
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="例如：主色换成墨绿色，标题更克制"
            rows={3}
            disabled={busy}
            className="min-h-18 resize-none rounded-none border-0 px-1 text-xs shadow-none focus-visible:ring-0"
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
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              disabled={busy || attachmentSaving}
              onClick={() => fileInputRef.current?.click()}
              title="添加图片"
            >
              <ImagePlus />
            </Button>
            <Button
              type="submit"
              size="icon-sm"
              disabled={busy || attachmentSaving || (!draft.trim() && attachments.length === 0)}
              title="发送"
            >
              <Send />
            </Button>
          </div>
        </div>
      </form>
    </aside>
  );
}
