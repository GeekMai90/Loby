import { createContext, useContext, useEffect, useRef, useState } from "react";
import { MessagePrimitive, useMessage } from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import clsx from "clsx";
import { Copy, FileText, Pencil, TextSelect } from "lucide-react";
import remarkGfm from "remark-gfm";
import { copyTextToClipboard } from "../lib/export";
import { resizeTextareaToContent } from "../lib/textarea";
import type { AgentRunInfo, ChatContextPreview, ChatMessage } from "../types";
import { AssistantRunPanel } from "./AssistantRunPanel";

export const AssistantRunMapContext = createContext<Map<string, AgentRunInfo>>(new Map());
export const AssistantContextPreviewMapContext = createContext<Map<string, ChatContextPreview[]>>(new Map());
export const AssistantMessageMapContext = createContext<Map<string, ChatMessage>>(new Map());
export const AssistantUserMessageActionsContext = createContext<{
  busy: boolean;
  onEditUserMessage: (messageId: string, content: string, contexts?: ChatContextPreview[]) => Promise<void> | void;
}>({
  busy: false,
  onEditUserMessage: () => {},
});

export const ASSISTANT_MESSAGE_COMPONENTS = { Message: AssistantMessage };
export const ASSISTANT_MESSAGE_PARTS = { Text: AssistantMarkdownText, Empty: AssistantPendingPart };

function AssistantMessage() {
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
            <MessagePrimitive.Parts components={ASSISTANT_MESSAGE_PARTS} />
          </div>
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

function AssistantMessageContextPreview({ contexts }: { contexts: ChatContextPreview[] }) {
  return (
    <div className="assistant-message-contexts">
      {contexts.map((context) => {
        const ContextIcon = context.type === "selection" ? TextSelect : FileText;
        return (
          <div key={context.id} className={clsx("assistant-message-context", context.type)}>
            <ContextIcon size={12} />
            <span>{context.type === "document" ? context.title : context.excerpt || context.title}</span>
          </div>
        );
      })}
    </div>
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
