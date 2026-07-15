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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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
  formatOnly?: boolean;
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
  formatOnly = false,
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
      className={cn(
        "editor-selection-toolbar absolute z-12 w-[min(var(--selection-toolbar-width,240px),calc(100%-24px))] origin-top-center overflow-hidden rounded-[var(--menu-radius)] border border-[var(--menu-border)] bg-[var(--menu-surface)] text-[13px] text-foreground shadow-[var(--menu-shadow)] animate-in fade-in duration-120 motion-reduce:animate-none",
        position.placement === "above" && "-translate-y-full origin-bottom-center",
      )}
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
          <div className="flex h-9.5 min-w-0 items-center justify-center gap-1.25 px-2 py-1" aria-label="文字格式">
            {FORMAT_ACTIONS.map(({ format, label, icon: Icon }) => (
              <Button
                key={format}
                type="button"
                variant="ghost"
                size="icon-sm"
                title={label}
                aria-label={label}
                onMouseDown={preserveEditorSelection}
                onClick={() => onFormat(format)}
              >
                <Icon size={15} strokeWidth={1.9} />
              </Button>
            ))}
          </div>
          {!formatOnly && (
            <div className="flex min-h-10.5 min-w-0 items-end gap-2 border-t border-foreground/10 pt-1.25 pr-1.75 pb-1.5 pl-2.5">
              <Sparkles className="mb-1.75 shrink-0 text-primary" size={15} />
              <Textarea
                ref={inputRef}
                className="min-h-0 flex-1 resize-none border-0 bg-transparent px-0 py-1 shadow-none focus-visible:ring-0"
                rows={1}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="使用 AI 编辑选区"
                aria-label="使用 AI 编辑选区"
              />
              <Button type="button" size="icon-sm" className="mb-px rounded-full" onClick={submit} disabled={!prompt.trim()} title="提交">
                <ArrowUp size={15} strokeWidth={2.2} />
              </Button>
            </div>
          )}
        </>
      )}

      {session.status === "running" && (
        <div className="flex min-h-12 min-w-0 items-center gap-2.25 px-2.5 py-2 pl-3.25 text-foreground/60">
          <LoaderCircle className="animate-spin text-primary motion-reduce:duration-1500" size={16} />
          <span>正在处理</span>
          <Button type="button" variant="destructive" size="icon-sm" className="ml-auto" onClick={onCancel} title="停止" aria-label="停止">
            <Square size={11} fill="currentColor" />
          </Button>
        </div>
      )}

      {session.status === "answer" && (
        <div className="min-w-0">
          <div className="max-h-[min(240px,42vh)] overflow-auto px-3.5 pt-3.25 pb-2.5 text-[13px] leading-[1.62] whitespace-pre-wrap text-foreground break-words">
            {session.content}
          </div>
          <div className="flex min-h-9.5 min-w-0 items-center justify-end gap-0.75 border-t border-foreground/10 px-1.75 py-1">
            <Button type="button" variant="ghost" size="sm" onClick={onCopyAnswer} title="复制">
              <Copy size={14} />
              <span>复制</span>
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onHandoff} title="在 AI 助手中继续">
              <MessageCircle size={14} />
              <span>对话</span>
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} title="关闭" aria-label="关闭">
              <X size={14} />
            </Button>
          </div>
        </div>
      )}

      {session.status === "edit" && (
        <div className="flex min-h-12 min-w-0 items-center gap-1.75 px-2 py-1.75 pl-2.5">
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles size={15} />
          </span>
          <span className="min-w-0 truncate text-foreground/80">{session.summary}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={onHandoff}
            title="在 AI 助手中继续"
            disabled={handoffDone}
          >
            <MessageCircle size={14} />
            <span>{handoffDone ? "已转入" : "对话"}</span>
          </Button>
          <span className="mx-1 h-4.5 w-px shrink-0 bg-foreground/15" />
          <Button type="button" variant="outline" size="icon-sm" onClick={onRejectEdit} title="撤销修改" aria-label="撤销修改">
            <Undo2 size={15} />
          </Button>
          <Button type="button" size="icon-sm" onClick={onAcceptEdit} title="接受修改" aria-label="接受修改">
            <Check size={16} />
          </Button>
        </div>
      )}

      {session.status === "error" && (
        <div className="flex min-h-12 min-w-0 items-center gap-2.25 px-2.5 py-2 pl-3.25 text-destructive">
          <span>{session.message}</span>
          <Button type="button" variant="ghost" size="icon-sm" className="ml-auto" onClick={onClose} title="关闭" aria-label="关闭">
            <X size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}
