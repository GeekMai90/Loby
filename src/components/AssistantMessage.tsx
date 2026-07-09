import { useContext, useEffect, useRef, useState } from "react";
import { MessagePrimitive, useMessage } from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import clsx from "clsx";
import { Copy, Pencil } from "lucide-react";
import remarkGfm from "remark-gfm";
import { copyTextToClipboard } from "../lib/export";
import { resizeTextareaToContent } from "../lib/textarea";
import { AssistantActionCards } from "./AssistantActionCards";
import { AssistantMessageContextPreview } from "./AssistantMessageContextPreview";
import { AssistantRunPanel } from "./AssistantRunPanel";
import {
  AssistantContextPreviewMapContext,
  AssistantMessageMapContext,
  AssistantRunMapContext,
  AssistantUserMessageActionsContext,
} from "./AssistantMessageContexts";

export function AssistantMessage() {
  const runByMessageId = useContext(AssistantRunMapContext);
  const contextPreviewsByMessageId = useContext(AssistantContextPreviewMapContext);
  const messageById = useContext(AssistantMessageMapContext);
  const { busy, onEditUserMessage } = useContext(AssistantUserMessageActionsContext);
  const id = useMessage((message) => message.id);
  const role = useMessage((message) => message.role);
  const run = id ? runByMessageId.get(id) : undefined;
  const contextPreviews = id ? (contextPreviewsByMessageId.get(id) ?? []).filter((context) => context.visible !== false) : [];
  const sourceMessage = id ? messageById.get(id) : undefined;
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
    if (!nextContent) return;
    setEditing(false);
    void onEditUserMessage(sourceMessage.id, nextContent, sourceMessage.contexts ?? []);
  }

  return (
    <MessagePrimitive.Root className={clsx("assistant-message", `assistant-message-${role}`)}>
      {run && <AssistantRunPanel run={run} />}
      {role === "user" && contextPreviews.length > 0 && <AssistantMessageContextPreview contexts={contextPreviews} />}
      {role === "user" && editing ? (
        <form
          className="assistant-message-edit"
          onSubmit={(event) => {
            event.preventDefault();
            submitEdit();
          }}
        >
          <textarea
            ref={editRef}
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
          <div>
            <button type="button" className="secondary" onClick={cancelEditing}>
              取消
            </button>
            <button type="submit" disabled={busy || !draft.trim()}>
              发送
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="assistant-message-body">
            <MessagePrimitive.Parts components={{ Text: AssistantMarkdownText, Empty: AssistantPendingPart }} />
          </div>
          {role === "assistant" && sourceMessage?.actions && sourceMessage.actions.length > 0 && (
            <AssistantActionCards actions={sourceMessage.actions} />
          )}
          {role === "user" && sourceMessage && (
            <div className="assistant-message-actions">
              <button type="button" onClick={startEditing} disabled={busy} title="编辑并重新发送">
                <Pencil size={13} />
              </button>
              <button type="button" onClick={() => void copyTextToClipboard(sourceMessage.content)} title="复制">
                <Copy size={13} />
              </button>
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

  return (
    <span className="assistant-thinking">
      <span />
      <span />
      <span />
    </span>
  );
}
