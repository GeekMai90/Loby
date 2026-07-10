import {
  ArrowUp,
  Bold,
  Check,
  Copy,
  Highlighter,
  Italic,
  LoaderCircle,
  MessageCircle,
  Sparkles,
  Square,
  Strikethrough,
  Underline,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import type { MarkdownFormat } from "../lib/editorMarkdown";

export type EditorSelectionToolbarSession =
  | { status: "ready" }
  | { status: "running"; prompt: string }
  | { status: "answer"; prompt: string; content: string }
  | { status: "edit"; prompt: string; summary: string }
  | { status: "error"; prompt: string; message: string };

interface EditorSelectionToolbarProps {
  position: { left: number; top: number; width: number; placement: "above" | "below" };
  session: EditorSelectionToolbarSession;
  handoffDone: boolean;
  onFormat: (format: MarkdownFormat) => void;
  onSubmit: (prompt: string) => void;
  onCancel: () => void;
  onClose: () => void;
  onCopyAnswer: () => void;
  onHandoff: () => void;
  onRejectEdit: () => void;
  onAcceptEdit: () => void;
}

const FORMAT_ACTIONS: Array<{ format: MarkdownFormat; label: string; icon: typeof Bold }> = [
  { format: "bold", label: "加粗", icon: Bold },
  { format: "italic", label: "斜体", icon: Italic },
  { format: "underline", label: "下划线", icon: Underline },
  { format: "strike", label: "删除线", icon: Strikethrough },
  { format: "highlight", label: "高亮", icon: Highlighter },
];

export function EditorSelectionToolbar({
  position,
  session,
  handoffDone,
  onFormat,
  onSubmit,
  onCancel,
  onClose,
  onCopyAnswer,
  onHandoff,
  onRejectEdit,
  onAcceptEdit,
}: EditorSelectionToolbarProps) {
  const [prompt, setPrompt] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (session.status === "ready") setPrompt("");
  }, [session.status]);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    const nextHeight = Math.min(input.scrollHeight, 120);
    input.style.height = `${nextHeight}px`;
    input.style.overflowY = input.scrollHeight > 120 ? "auto" : "hidden";
  }, [prompt]);

  function submit() {
    const normalized = prompt.trim();
    if (normalized) onSubmit(normalized);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  function preserveEditorSelection(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
  }

  return (
    <div
      className={`editor-selection-toolbar ${session.status} ${position.placement}`}
      style={
        {
          "--selection-toolbar-left": `${position.left}px`,
          "--selection-toolbar-top": `${position.top}px`,
          "--selection-toolbar-width": `${position.width}px`,
        } as CSSProperties
      }
      role="dialog"
      aria-label="选区工具栏"
    >
      {session.status === "ready" && (
        <>
          <div className="selection-format-row" aria-label="文字格式">
            {FORMAT_ACTIONS.map(({ format, label, icon: Icon }) => (
              <button
                key={format}
                type="button"
                className="selection-icon-button"
                title={label}
                aria-label={label}
                onMouseDown={preserveEditorSelection}
                onClick={() => onFormat(format)}
              >
                <Icon size={15} strokeWidth={1.9} />
              </button>
            ))}
          </div>
          <div className="selection-ai-input-row">
            <Sparkles className="selection-ai-input-icon" size={15} />
            <textarea
              ref={inputRef}
              rows={1}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="使用 AI 编辑选区"
              aria-label="使用 AI 编辑选区"
            />
            <button type="button" className="selection-submit-button" onClick={submit} disabled={!prompt.trim()} title="提交">
              <ArrowUp size={15} strokeWidth={2.2} />
            </button>
          </div>
        </>
      )}

      {session.status === "running" && (
        <div className="selection-ai-status-row">
          <LoaderCircle className="selection-ai-spinner" size={16} />
          <span>正在处理</span>
          <button type="button" className="selection-icon-button trailing" onClick={onCancel} title="停止" aria-label="停止">
            <Square size={11} fill="currentColor" />
          </button>
        </div>
      )}

      {session.status === "answer" && (
        <div className="selection-ai-result">
          <div className="selection-ai-result-content">{session.content}</div>
          <div className="selection-ai-result-actions">
            <button type="button" className="selection-result-action" onClick={onCopyAnswer} title="复制">
              <Copy size={14} />
              <span>复制</span>
            </button>
            <button type="button" className="selection-result-action" onClick={onHandoff} title="在 AI 助手中继续">
              <MessageCircle size={14} />
              <span>对话</span>
            </button>
            <button type="button" className="selection-icon-button" onClick={onClose} title="关闭" aria-label="关闭">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {session.status === "edit" && (
        <div className="selection-ai-edit-row">
          <span className="selection-ai-mark">
            <Sparkles size={15} />
          </span>
          <span className="selection-ai-edit-summary">{session.summary}</span>
          <button
            type="button"
            className="selection-result-action compact"
            onClick={onHandoff}
            title="在 AI 助手中继续"
            disabled={handoffDone}
          >
            <MessageCircle size={14} />
            <span>{handoffDone ? "已转入" : "对话"}</span>
          </button>
          <span className="selection-format-divider" />
          <button type="button" className="selection-review-button reject" onClick={onRejectEdit} title="撤销修改" aria-label="撤销修改">
            <Undo2 size={15} />
          </button>
          <button type="button" className="selection-review-button accept" onClick={onAcceptEdit} title="接受修改" aria-label="接受修改">
            <Check size={16} />
          </button>
        </div>
      )}

      {session.status === "error" && (
        <div className="selection-ai-error-row">
          <span>{session.message}</span>
          <button type="button" className="selection-icon-button trailing" onClick={onClose} title="关闭" aria-label="关闭">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
