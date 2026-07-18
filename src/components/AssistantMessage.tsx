import { useContext, useEffect, useRef, useState } from "react";
import { MessagePrimitive, useMessage } from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import { Copy, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import remarkGfm from "remark-gfm";
import { copyTextToClipboard } from "../lib/exportBrowser";
import { resizeTextareaToContent } from "../lib/textarea";
import { AssistantActionCards } from "./AssistantActionCards";
import { AiChangeReviewPanel } from "./AiChangeReviewPanel";
import { AssistantMessageContextPreview } from "./AssistantMessageContextPreview";
import { AssistantRunPanel } from "./AssistantRunPanel";
import { AssistantImageAttachments } from "./AssistantImageAttachments";
import { AssistantMessageBody, AssistantPendingIndicator } from "./AssistantMessageSurface";
import { assistantMessageRootClassName } from "../lib/assistantMessageStyles";
import {
  AssistantContextPreviewMapContext,
  AssistantChangeSetActionsContext,
  AssistantMessageMapContext,
  AssistantRunMapContext,
  AssistantUserMessageActionsContext,
} from "./AssistantMessageContexts";
import { filterReviewPanelChangeSets } from "../lib/aiChangeSets";

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
    if (!nextContent && !sourceMessage.images?.length) return;
    setEditing(false);
    void onEditUserMessage(sourceMessage.id, nextContent, sourceMessage.contexts ?? [], sourceMessage.images ?? []);
  }

  return (
    <MessagePrimitive.Root data-slot="assistant-message" className={assistantMessageRootClassName(role)}>
      {run && <AssistantRunPanel run={run} />}
      {role === "user" && contextPreviews.length > 0 && <AssistantMessageContextPreview contexts={contextPreviews} />}
      {role === "user" && editing ? (
        <form
          className="grid w-[calc(100%-28px)] max-w-full gap-2 rounded-2xl border border-primary/30 bg-card p-2.5 shadow-[0_1px_2px_rgb(0_0_0_/_4%),0_0_0_3px_rgb(0_122_255_/_7%)]"
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
          <AssistantImageAttachments attachments={sourceMessage?.images ?? []} />
          <div className="flex justify-end gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={cancelEditing}>
              取消
            </Button>
            <Button type="submit" size="sm" disabled={busy || (!draft.trim() && !sourceMessage?.images?.length)}>
              发送
            </Button>
          </div>
        </form>
      ) : (
        <>
          <AssistantMessageBody role={role} hasContent={role !== "user" || Boolean(sourceMessage?.content)} images={sourceMessage?.images}>
            <MessagePrimitive.Parts components={{ Text: AssistantMarkdownText, Empty: AssistantPendingPart }} />
          </AssistantMessageBody>
          {role === "assistant" && sourceMessage?.actions && sourceMessage.actions.length > 0 && (
            <AssistantActionCards actions={sourceMessage.actions} />
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
