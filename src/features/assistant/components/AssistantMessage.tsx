/**
 * [INPUT]: 依赖 React、assistant-ui runtime、remark-gfm、消息/审阅组件、shadcn 控件与 assistant message 语义 Token
 * [OUTPUT]: 对外提供 AssistantMessage
 * [POS]: AI 助手 feature 的界面组合单元，连接 AI 助手状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useContext, useEffect, useRef, useState } from "react";
import { MessagePrimitive, useMessage } from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import { Copy, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import remarkGfm from "remark-gfm";
import { copyTextToClipboard } from "@/features/publishing/model/exportBrowser";
import { resizeTextareaToContent } from "@/shared/lib/textarea";
import { AssistantActionArtifacts } from "@/features/assistant/components/AssistantActionArtifacts";
import { AssistantActionCards } from "@/features/assistant/components/AssistantActionCards";
import { AiChangeReviewPanel } from "@/features/assistant/components/AiChangeReviewPanel";
import { AssistantMessageContextPreview } from "@/features/assistant/components/AssistantMessageContextPreview";
import { AssistantRunPanel } from "@/features/assistant/components/AssistantRunPanel";
import { AssistantAttachments } from "@/features/assistant/components/AssistantAttachments";
import { AssistantMessageBody, AssistantPendingIndicator } from "@/features/assistant/components/AssistantMessageSurface";
import { assistantMessageRootClassName } from "@/features/assistant/model/assistantMessageStyles";
import {
  AssistantContextPreviewMapContext,
  AssistantChangeSetActionsContext,
  AssistantMessageMapContext,
  AssistantRunMapContext,
  AssistantUserMessageActionsContext,
} from "@/features/assistant/components/AssistantMessageContexts";
import { filterReviewPanelChangeSets } from "@/features/assistant/model/aiChangeSets";

export function AssistantMessage() {
  const runByMessageId = useContext(AssistantRunMapContext);
  const contextPreviewsByMessageId = useContext(AssistantContextPreviewMapContext);
  const messageById = useContext(AssistantMessageMapContext);
  const changeSetActions = useContext(AssistantChangeSetActionsContext);
  const { busy, onEditUserMessage } = useContext(AssistantUserMessageActionsContext);
  const id = useMessage((message) => message.id);
  const role = useMessage((message) => message.role);
  const run = id ? runByMessageId.get(id) : undefined;
  const contextPreviews = id ? (contextPreviewsByMessageId.get(id) ?? []).filter((context) => context.visible !== false) : [];
  const sourceMessage = id ? messageById.get(id) : undefined;
  const messageChangeSets = sourceMessage?.changeSets
    ? filterReviewPanelChangeSets(sourceMessage.changeSets, changeSetActions.activeSheetId)
    : [];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) return;
    setDraft(sourceMessage?.content ?? "");
    window.requestAnimationFrame(() => {
      editRef.current?.focus();
      editRef.current?.select();
      resizeTextareaToContent(editRef.current);
    });
  }, [editing, sourceMessage?.content]);

  function startEditing() {
    if (!sourceMessage || busy) return;
    setDraft(sourceMessage.content);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setDraft("");
  }

  function submitEdit() {
    if (!sourceMessage || busy) return;
    const nextContent = draft.trim();
    if (!nextContent && !sourceMessage.attachments?.length) return;
    setEditing(false);
    void onEditUserMessage(sourceMessage.id, nextContent, sourceMessage.contexts ?? [], sourceMessage.attachments ?? []);
  }

  return (
    <MessagePrimitive.Root data-slot="assistant-message" className={assistantMessageRootClassName(role)}>
      {run && <AssistantRunPanel run={run} />}
      {role === "user" && contextPreviews.length > 0 && <AssistantMessageContextPreview contexts={contextPreviews} />}
      {role === "user" && editing ? (
        <form
          className="grid w-[calc(100%-28px)] max-w-full gap-2 rounded-md bg-[var(--assistant-user-message-bg)] px-3 py-2 shadow-[var(--assistant-user-message-edit-shadow)]"
          onSubmit={(event) => {
            event.preventDefault();
            submitEdit();
          }}
        >
          <Textarea
            ref={editRef}
            className="max-h-45 resize-none"
            value={draft}
            rows={3}
            onChange={(event) => {
              setDraft(event.target.value);
              resizeTextareaToContent(event.currentTarget);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                cancelEditing();
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submitEdit();
              }
            }}
          />
          <AssistantAttachments attachments={sourceMessage?.attachments ?? []} />
          <div className="flex justify-end gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={cancelEditing}>
              取消
            </Button>
            <Button type="submit" size="sm" disabled={busy || (!draft.trim() && !sourceMessage?.attachments?.length)}>
              发送
            </Button>
          </div>
        </form>
      ) : (
        <>
          <AssistantMessageBody
            role={role}
            hasContent={role !== "user" || Boolean(sourceMessage?.content)}
            attachments={sourceMessage?.attachments}
          >
            <MessagePrimitive.Parts components={{ Text: AssistantMarkdownText, Empty: AssistantPendingPart }} />
          </AssistantMessageBody>
          {role === "assistant" && sourceMessage?.actions && sourceMessage.actions.length > 0 && (
            <>
              <AssistantActionArtifacts actions={sourceMessage.actions} messageContent={sourceMessage.content} />
              <AssistantActionCards actions={sourceMessage.actions} />
            </>
          )}
          {role === "assistant" && messageChangeSets.length > 0 && (
            <div className="mt-2.5">
              <AiChangeReviewPanel
                changeSets={messageChangeSets}
                shownChangeSetIds={changeSetActions.shownChangeSetIds}
                onShowChanges={changeSetActions.onShowChanges}
                onHideChanges={changeSetActions.onHideChanges}
                onRollbackChangeSet={changeSetActions.onRollbackChangeSet}
                onRejectChangeSet={changeSetActions.onRejectChangeSet}
                onOpenChangeSetTarget={changeSetActions.onOpenChangeSetTarget}
                activeSheetId={changeSetActions.activeSheetId}
              />
            </div>
          )}
          {role === "user" && sourceMessage && (
            <div className="pointer-events-none relative z-10 -mt-0.5 inline-flex h-3.5 translate-y-[-2px] gap-0.5 overflow-visible pr-1.5 opacity-0 transition-[opacity,transform] duration-120 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 focus-within:pointer-events-auto focus-within:translate-y-0 focus-within:opacity-100">
              <Button type="button" variant="ghost" size="icon-xs" onClick={startEditing} disabled={busy} title="编辑并重新发送">
                <Pencil />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => void copyTextToClipboard(sourceMessage.content)}
                title="复制"
              >
                <Copy />
              </Button>
            </div>
          )}
        </>
      )}
    </MessagePrimitive.Root>
  );
}

function AssistantMarkdownText() {
  return <MarkdownTextPrimitive className="assistant-markdown" remarkPlugins={[remarkGfm]} />;
}

function AssistantPendingPart() {
  const runByMessageId = useContext(AssistantRunMapContext);
  const id = useMessage((message) => message.id);
  if (id && runByMessageId.has(id)) return null;

  return <AssistantPendingIndicator />;
}
