import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { search, searchKeymap } from "@codemirror/search";
import { EditorView, drawSelection, keymap } from "@codemirror/view";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { AiChangeBlock, EditorTypographySettings, WritingSheet } from "../types";
import {
  chineseEditorPhrases,
  editorTheme,
  imagePreviewDecorations,
  markdownHighlighting,
  markdownSyntaxDecorations,
  quoteLineDecorations,
  tableLineDecorations,
  type EditorImagePreview,
  typewriterScrollExtension,
} from "../lib/editorExtensions";
import { aiReviewDecorations } from "../lib/editorAiReviewDecorations";
import { createImageImportExtension } from "../lib/editorImageImport";
import { createEditorLinkNavigationExtension } from "../lib/editorLinkNavigation";
import { nibvaMarkdownExtensions } from "../lib/editorMarkdownLanguage";
import { applyEditorMarkdownFormat, markdownShortcutKeymap, type MarkdownFormat } from "../lib/editorMarkdown";
import { slashMenuExtension } from "../lib/editorSlashMenu";
import type { InlineAiHandoff, InlineAiPendingEdit, InlineAiResult, InlineAiSelection } from "../lib/inlineAi";
import { countWords } from "../lib/text";
import { copyTextToClipboard } from "../lib/export";
import { EditorSelectionToolbar, type EditorSelectionToolbarSession } from "./EditorSelectionToolbar";

interface EditorSelectionSnapshot extends InlineAiSelection {
  position: { left: number; top: number; width: number; placement: "above" | "below" };
}

interface EditorCanvasProps {
  sheet: WritingSheet;
  previewMode: boolean;
  previewHtml: string;
  previewBusy: boolean;
  typewriterMode: boolean;
  typography: EditorTypographySettings;
  reviewChanges: AiChangeBlock[];
  readOnly?: boolean;
  onCreateEditor: (view: EditorView) => void;
  onBodyChange: (body: string) => void;
  onSelectionChange: (text: string) => void;
  onRunInlineAi: (prompt: string, selection: InlineAiSelection) => Promise<InlineAiResult>;
  onCancelInlineAi: () => Promise<void> | void;
  onHandoffInlineAi: (handoff: InlineAiHandoff) => void;
  onApplyInlineAiEdit: (edit: InlineAiPendingEdit) => boolean;
  onRejectInlineAiEdit: (edit: InlineAiPendingEdit) => boolean;
  onImportImageFiles: (files: File[]) => Promise<string[]>;
  onResolveImagePreview: (referencePath: string, alt: string) => EditorImagePreview | null;
  onOpenImage: (sourcePath: string) => void;
  onSaveImageAs: (sourcePath: string, label: string) => void;
  onInsertImage: () => void;
}

export function EditorCanvas({
  sheet,
  previewMode,
  previewHtml,
  previewBusy,
  typewriterMode,
  typography,
  reviewChanges,
  readOnly = false,
  onCreateEditor,
  onBodyChange,
  onSelectionChange,
  onRunInlineAi,
  onCancelInlineAi,
  onHandoffInlineAi,
  onApplyInlineAiEdit,
  onRejectInlineAiEdit,
  onImportImageFiles,
  onResolveImagePreview,
  onOpenImage,
  onSaveImageAs,
  onInsertImage,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const runSequenceRef = useRef(0);
  const [selectionSnapshot, setSelectionSnapshot] = useState<EditorSelectionSnapshot | null>(null);
  const [toolbarSession, setToolbarSession] = useState<EditorSelectionToolbarSession | null>(null);
  const [pendingEdit, setPendingEdit] = useState<InlineAiPendingEdit | null>(null);
  const [handoffDone, setHandoffDone] = useState(false);
  const editorStyle = {
    "--editor-font-family": resolveEditorFontFamily(typography),
    "--editor-line-height": String(typography.lineHeight),
    "--editor-paragraph-spacing": `${typography.paragraphSpacing}px`,
    "--editor-body-font-size": `${typography.bodyFontSize}px`,
    "--editor-h1-font-size": `${typography.h1FontSize}px`,
    "--editor-h2-font-size": `${typography.h2FontSize}px`,
    "--editor-h3-font-size": `${typography.h3FontSize}px`,
    "--editor-table-font-size": `${typography.tableFontSize}px`,
  } as CSSProperties;
  const wordCount = countWords(sheet.body);
  const inlineReviewChanges = useMemo<AiChangeBlock[]>(() => {
    if (!pendingEdit || toolbarSession?.status !== "edit" || sheet.body !== pendingEdit.proposedBody) return [];
    return [
      {
        id: `inline-ai-${pendingEdit.sheetId}-${pendingEdit.from}`,
        status: "pending",
        fromText: pendingEdit.text,
        toText: pendingEdit.replacement,
        reason: pendingEdit.summary,
        anchor: {
          from: pendingEdit.from,
          to: pendingEdit.from + pendingEdit.replacement.length,
        },
      },
    ];
  }, [pendingEdit, sheet.body, toolbarSession?.status]);

  useEffect(() => {
    runSequenceRef.current += 1;
    setSelectionSnapshot(null);
    setToolbarSession(null);
    setPendingEdit(null);
    setHandoffDone(false);
  }, [sheet.id]);

  useEffect(() => {
    if (!toolbarSession || toolbarSession.status === "running" || toolbarSession.status === "edit") return;
    function closeFromOutside(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const toolbar = canvasRef.current?.querySelector(".editor-selection-toolbar");
      if (toolbar?.contains(target) || canvasRef.current?.contains(target)) return;
      runSequenceRef.current += 1;
      setToolbarSession(null);
      setSelectionSnapshot(null);
      setHandoffDone(false);
      setPendingEdit(null);
    }
    window.addEventListener("pointerdown", closeFromOutside);
    return () => window.removeEventListener("pointerdown", closeFromOutside);
  }, [toolbarSession]);

  useEffect(() => {
    if (!selectionSnapshot || !toolbarSession || !editorViewRef.current) return;
    const position = resolveSelectionToolbarPosition(
      editorViewRef.current,
      selectionSnapshot.from,
      toolbarSession.status === "edit" && pendingEdit ? pendingEdit.from + pendingEdit.replacement.length : selectionSnapshot.to,
      canvasRef.current,
      toolbarSession.status,
    );
    if (!position) return;
    setSelectionSnapshot((current) => {
      if (
        !current ||
        (current.position.left === position.left &&
          current.position.top === position.top &&
          current.position.width === position.width &&
          current.position.placement === position.placement)
      ) {
        return current;
      }
      return { ...current, position };
    });
  }, [pendingEdit, selectionSnapshot, toolbarSession]);

  function closeToolbar() {
    runSequenceRef.current += 1;
    setToolbarSession(null);
    setSelectionSnapshot(null);
    setHandoffDone(false);
    if (toolbarSession?.status !== "edit") setPendingEdit(null);
  }

  function applySelectionFormat(format: MarkdownFormat) {
    applyEditorMarkdownFormat(editorViewRef.current, format);
    setToolbarSession(null);
    setSelectionSnapshot(null);
    setHandoffDone(false);
  }

  async function submitInlineAi(prompt: string) {
    if (!selectionSnapshot || toolbarSession?.status !== "ready") return;
    const selection: InlineAiSelection = {
      sheetId: selectionSnapshot.sheetId,
      sheetTitle: selectionSnapshot.sheetTitle,
      baseBody: selectionSnapshot.baseBody,
      from: selectionSnapshot.from,
      to: selectionSnapshot.to,
      text: selectionSnapshot.text,
    };
    const sequence = runSequenceRef.current + 1;
    runSequenceRef.current = sequence;
    setHandoffDone(false);
    setToolbarSession({ status: "running", prompt });

    try {
      const result = await onRunInlineAi(prompt, selection);
      if (runSequenceRef.current !== sequence) return;
      if (result.resultType === "answer") {
        setToolbarSession({ status: "answer", prompt, content: result.content });
        return;
      }

      const edit: InlineAiPendingEdit = {
        ...selection,
        prompt,
        replacement: result.replacement,
        summary: result.summary,
        proposedBody: `${selection.baseBody.slice(0, selection.from)}${result.replacement}${selection.baseBody.slice(selection.to)}`,
      };
      if (!onApplyInlineAiEdit(edit)) {
        setToolbarSession({ status: "error", prompt, message: "正文已经变化，请重新选择文字后再试。" });
        return;
      }
      setPendingEdit(edit);
      setToolbarSession({ status: "edit", prompt, summary: result.summary });
    } catch (error) {
      if (runSequenceRef.current !== sequence) return;
      setToolbarSession({
        status: "error",
        prompt,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function cancelInlineAi() {
    runSequenceRef.current += 1;
    await onCancelInlineAi();
    setToolbarSession((current) => ({
      status: "error",
      prompt: current && "prompt" in current ? current.prompt : "",
      message: "已取消本次请求。",
    }));
  }

  function handoffInlineAi() {
    if (!selectionSnapshot || !toolbarSession || handoffDone) return;
    let result: InlineAiResult | null = null;
    if (toolbarSession.status === "answer") {
      result = { resultType: "answer", content: toolbarSession.content };
    } else if (toolbarSession.status === "edit" && pendingEdit) {
      result = { resultType: "edit", replacement: pendingEdit.replacement, summary: pendingEdit.summary };
    }
    if (!result || !("prompt" in toolbarSession)) return;
    onHandoffInlineAi({
      prompt: toolbarSession.prompt,
      selection: {
        sheetId: selectionSnapshot.sheetId,
        sheetTitle: selectionSnapshot.sheetTitle,
        baseBody: selectionSnapshot.baseBody,
        from: selectionSnapshot.from,
        to: selectionSnapshot.to,
        text: selectionSnapshot.text,
      },
      result,
    });
    setHandoffDone(true);
    if (toolbarSession.status === "answer") closeToolbar();
  }

  function acceptInlineAiEdit() {
    setPendingEdit(null);
    setToolbarSession(null);
    setSelectionSnapshot(null);
    setHandoffDone(false);
    const view = editorViewRef.current;
    if (view && pendingEdit) {
      const cursor = Math.min(pendingEdit.from + pendingEdit.replacement.length, view.state.doc.length);
      view.dispatch({ selection: { anchor: cursor } });
      view.focus();
    }
  }

  function rejectInlineAiEdit() {
    if (!pendingEdit) return;
    const rejectedEdit = pendingEdit;
    if (!onRejectInlineAiEdit(pendingEdit)) {
      setToolbarSession({ status: "error", prompt: pendingEdit.prompt, message: "正文已继续变化，无法自动撤销这次修改。" });
      setPendingEdit(null);
      return;
    }
    setPendingEdit(null);
    setToolbarSession(null);
    setSelectionSnapshot(null);
    setHandoffDone(false);
    const view = editorViewRef.current;
    if (view) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const nextView = editorViewRef.current;
          if (!nextView) return;
          const cursor = Math.min(rejectedEdit.from + rejectedEdit.text.length, nextView.state.doc.length);
          nextView.dispatch({ selection: { anchor: cursor } });
          nextView.focus();
        });
      });
    }
  }

  function handleEditorUpdate(view: EditorView, selectionChanged: boolean, documentChanged: boolean) {
    const currentSession = toolbarSession;
    const currentPendingEdit = pendingEdit;
    const canvas = view.dom.closest(".editor-canvas") as HTMLElement | null;
    if (documentChanged && currentPendingEdit && view.state.doc.toString() !== currentPendingEdit.proposedBody) {
      setPendingEdit(null);
      setToolbarSession(null);
    }

    const range = view.state.selection.main;
    onSelectionChange(range.empty ? "" : view.state.sliceDoc(range.from, range.to));
    if (readOnly || previewMode) return;
    if (currentSession?.status === "running" || currentSession?.status === "edit") return;
    if (!selectionChanged && !documentChanged) {
      if (selectionSnapshot) {
        const position = resolveSelectionToolbarPosition(
          view,
          selectionSnapshot.from,
          selectionSnapshot.to,
          canvas,
          currentSession?.status,
        );
        if (position) setSelectionSnapshot((current) => (current ? { ...current, position } : current));
      }
      return;
    }
    if (range.empty) {
      setSelectionSnapshot(null);
      if (!currentSession || currentSession.status === "ready") setToolbarSession(null);
      return;
    }

    const position = resolveSelectionToolbarPosition(view, range.from, range.to, canvas, "ready");
    if (!position) return;
    setSelectionSnapshot({
      sheetId: sheet.id,
      sheetTitle: sheet.title,
      baseBody: view.state.doc.toString(),
      from: range.from,
      to: range.to,
      text: view.state.sliceDoc(range.from, range.to),
      position,
    });
    setHandoffDone(false);
    setToolbarSession({ status: "ready" });
  }

  return (
    <section ref={canvasRef} className="editor-canvas relative flex min-h-0 flex-1 overflow-hidden bg-card" style={editorStyle}>
      <div
        className="pointer-events-none absolute top-16.5 right-2 z-6 rounded-full bg-card/60 px-1.5 py-0.5 text-[11px] leading-tight font-medium whitespace-nowrap text-foreground/45 shadow-xs"
        aria-label={`当前文稿 ${wordCount} 字`}
        title="当前文稿字数"
      >
        {wordCount.toLocaleString("zh-CN")} 字
      </div>
      {previewMode ? (
        <article className="sheet-preview">
          {previewBusy && <p className="text-xs leading-4.5 text-muted-foreground">正在生成预览...</p>}
          <div dangerouslySetInnerHTML={{ __html: previewHtml || "<p></p>" }} />
        </article>
      ) : (
        <CodeMirror
          className="editor-instance"
          value={sheet.body}
          height="100%"
          theme="light"
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            drawSelection: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
          }}
          extensions={[
            history(),
            search({ top: true }),
            EditorState.readOnly.of(readOnly),
            EditorView.editable.of(!readOnly),
            keymap.of([...markdownShortcutKeymap, ...searchKeymap, ...defaultKeymap, ...historyKeymap]),
            createImageImportExtension(onImportImageFiles),
            createEditorLinkNavigationExtension(),
            chineseEditorPhrases,
            markdown({ extensions: nibvaMarkdownExtensions }),
            markdownHighlighting,
            markdownSyntaxDecorations,
            quoteLineDecorations,
            tableLineDecorations,
            aiReviewDecorations(sheet.body, [...reviewChanges, ...inlineReviewChanges]),
            imagePreviewDecorations(onResolveImagePreview, {
              onOpenImage,
              onSaveImageAs,
            }),
            slashMenuExtension({ onInsertImage }),
            EditorView.lineWrapping,
            drawSelection(),
            editorTheme,
            EditorView.updateListener.of((update) => {
              if (!update.selectionSet && !update.docChanged && !update.viewportChanged) return;
              handleEditorUpdate(update.view, update.selectionSet, update.docChanged);
            }),
            typewriterMode ? typewriterScrollExtension : [],
          ]}
          onCreateEditor={(view) => {
            editorViewRef.current = view;
            onCreateEditor(view);
          }}
          onChange={onBodyChange}
        />
      )}
      {selectionSnapshot && toolbarSession && !previewMode && !readOnly && (
        <EditorSelectionToolbar
          position={selectionSnapshot.position}
          session={toolbarSession}
          handoffDone={handoffDone}
          onFormat={applySelectionFormat}
          onSubmit={submitInlineAi}
          onCancel={cancelInlineAi}
          onClose={closeToolbar}
          onCopyAnswer={() => {
            if (toolbarSession.status === "answer") void copyTextToClipboard(toolbarSession.content);
          }}
          onHandoff={handoffInlineAi}
          onRejectEdit={rejectInlineAiEdit}
          onAcceptEdit={acceptInlineAiEdit}
        />
      )}
    </section>
  );
}

function resolveSelectionToolbarPosition(
  view: EditorView,
  from: number,
  to: number,
  container: HTMLElement | null,
  status: EditorSelectionToolbarSession["status"] = "ready",
): { left: number; top: number; width: number; placement: "above" | "below" } | null {
  if (!container) return null;
  const start = view.coordsAtPos(Math.max(0, Math.min(from, view.state.doc.length)), 1);
  const end = view.coordsAtPos(Math.max(0, Math.min(to, view.state.doc.length)), -1);
  if (!start || !end) return null;
  const bounds = container.getBoundingClientRect();
  const content = view.dom.querySelector<HTMLElement>(".cm-content");
  const contentBounds = content?.getBoundingClientRect();
  const contentStyle = content ? window.getComputedStyle(content) : null;
  const contentPaddingLeft = Number.parseFloat(contentStyle?.paddingLeft ?? "0") || 0;
  const contentPaddingRight = Number.parseFloat(contentStyle?.paddingRight ?? "0") || 0;
  const textColumnWidth = contentBounds
    ? Math.max(1, contentBounds.width - contentPaddingLeft - contentPaddingRight)
    : Math.max(1, bounds.width - 56);
  const preferredWidth = status === "ready" ? 240 : textColumnWidth;
  const width = Math.min(preferredWidth, Math.max(1, bounds.width - 24));
  const estimatedHeight = status === "answer" ? 180 : status === "ready" ? 178 : 58;
  const selectionCenterX = (start.left + end.right) / 2 - bounds.left;
  const textColumnCenterX = contentBounds ? contentBounds.left + contentPaddingLeft + textColumnWidth / 2 - bounds.left : bounds.width / 2;
  const centerX = status === "ready" ? selectionCenterX : textColumnCenterX;
  const left = clamp(centerX - width / 2, 12, Math.max(12, bounds.width - width - 12));
  const below = end.bottom - bounds.top + 10;
  const fitsBelow = below + estimatedHeight <= bounds.height - 12;
  const placement = fitsBelow ? "below" : "above";
  const top = fitsBelow ? below : Math.max(12, start.top - bounds.top - 10);
  return { left, top, width, placement };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolveEditorFontFamily(typography: EditorTypographySettings): string {
  if (typography.fontPreset === "pingfang") return "'PingFang SC', 'SF Pro Text', sans-serif";
  if (typography.fontPreset === "songti") return "'Songti SC', 'STSong', 'SimSun', serif";
  if (typography.fontPreset === "kaiti") return "'Kaiti SC', 'STKaiti', KaiTi, serif";
  if (typography.fontPreset === "lxgw-wenkai") return "'LXGW WenKai', 'LXGW WenKai SC', '霞鹜文楷', '霞鹜文楷 GB', serif";
  if (typography.fontPreset === "huiwen-mincho") return "'Huiwen-mincho', 'Huiwen Mincho', '汇文明朝体', '汇文明朝', serif";
  if (typography.fontPreset === "mono") return "'SF Mono', 'SFMono-Regular', Menlo, Consolas, monospace";
  if (typography.fontPreset === "custom" && typography.customFontFamily.trim()) {
    return typography.customFontFamily.trim();
  }
  return "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Microsoft YaHei', sans-serif";
}
