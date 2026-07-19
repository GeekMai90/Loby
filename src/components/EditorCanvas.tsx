import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AiChangeBlock, EditorTypographySettings, WritingSheet } from "../types";
import type { EditorImagePreview } from "../lib/editorExtensions";
import { useLatestCallback } from "../hooks/useLatestCallback";
import { aiReviewDecorations } from "../lib/editorAiReviewDecorations";
import { createEditorCoreExtensions } from "../lib/editorCoreExtensions";
import { applyEditorMarkdownFormat, type MarkdownFormat } from "../lib/editorMarkdown";
import { createEditorTypographyStyle } from "../lib/editorTypography";
import { resolveEditorSelectionToolbarPosition } from "../lib/editorSelectionToolbarPosition";
import type { InlineAiHandoff, InlineAiPendingEdit, InlineAiResult, InlineAiSelection } from "../lib/inlineAi";
import { countWords } from "../lib/text";
import { copyTextToClipboard } from "../lib/exportBrowser";
import { EditorSelectionToolbar, type EditorSelectionToolbarSession } from "./EditorSelectionToolbar";
import { WritingGoalProgress } from "./WritingGoalProgress";

interface EditorSelectionSnapshot extends InlineAiSelection {
  position: { left: number; top: number; width: number; placement: "above" | "below" };
}

const EDITOR_BASIC_SETUP = {
  lineNumbers: false,
  foldGutter: false,
  drawSelection: false,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
} as const;
const NO_REVIEW_CHANGES: AiChangeBlock[] = [];

interface EditorCanvasProps {
  sheet: WritingSheet;
  previewMode: boolean;
  previewHtml: string;
  previewBusy: boolean;
  typewriterMode: boolean;
  typography: EditorTypographySettings;
  reviewChanges: AiChangeBlock[];
  readOnly?: boolean;
  versionPreviewActive?: boolean;
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
  versionPreviewActive = false,
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
  const handleBodyChange = useLatestCallback(onBodyChange);
  const handleImportImageFiles = useLatestCallback(onImportImageFiles);
  const handleResolveImagePreview = useLatestCallback(onResolveImagePreview);
  const handleOpenImage = useLatestCallback(onOpenImage);
  const handleSaveImageAs = useLatestCallback(onSaveImageAs);
  const handleInsertImage = useLatestCallback(onInsertImage);
  const handleEditorViewUpdate = useLatestCallback(handleEditorUpdate);
  const editorStyle = createEditorTypographyStyle(typography);
  const wordCount = countWords(sheet.body);
  const inlineReviewChanges = useMemo<AiChangeBlock[]>(() => {
    if (!pendingEdit || toolbarSession?.status !== "edit" || sheet.body !== pendingEdit.proposedBody) return NO_REVIEW_CHANGES;
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
  const visibleReviewChanges = useMemo(() => [...reviewChanges, ...inlineReviewChanges], [inlineReviewChanges, reviewChanges]);
  const reviewDecorations = useMemo(() => aiReviewDecorations(visibleReviewChanges), [visibleReviewChanges]);
  const editorExtensions = useMemo(
    () =>
      createEditorCoreExtensions({
        readOnly,
        additionalExtensions: [reviewDecorations],
        typewriterMode,
        onImportImageFiles: handleImportImageFiles,
        onResolveImagePreview: handleResolveImagePreview,
        onOpenImage: handleOpenImage,
        onSaveImageAs: handleSaveImageAs,
        onInsertImage: handleInsertImage,
        onUpdate: (update) => {
          if (!update.selectionSet && !update.docChanged && !update.viewportChanged) return;
          handleEditorViewUpdate(update.view, update.selectionSet, update.docChanged);
        },
      }),
    [
      handleEditorViewUpdate,
      handleImportImageFiles,
      handleInsertImage,
      handleOpenImage,
      handleResolveImagePreview,
      handleSaveImageAs,
      readOnly,
      reviewDecorations,
      typewriterMode,
    ],
  );

  useEffect(() => {
    runSequenceRef.current += 1;
    setSelectionSnapshot(null);
    setToolbarSession(null);
    setPendingEdit(null);
    setHandoffDone(false);
  }, [readOnly, sheet.id]);

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
    const position = resolveEditorSelectionToolbarPosition(
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
    if (view.compositionStarted) {
      onSelectionChange("");
      if (selectionSnapshot) setSelectionSnapshot(null);
      if (currentSession?.status === "ready") setToolbarSession(null);
      return;
    }
    onSelectionChange(range.empty ? "" : view.state.sliceDoc(range.from, range.to));
    if (readOnly || previewMode) return;
    if (currentSession?.status === "running" || currentSession?.status === "edit") return;
    if (!selectionChanged && !documentChanged) {
      if (selectionSnapshot) {
        const position = resolveEditorSelectionToolbarPosition(
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

    const position = resolveEditorSelectionToolbarPosition(view, range.from, range.to, canvas, "ready");
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
    <section
      ref={canvasRef}
      className="editor-canvas relative flex min-h-0 flex-1 overflow-hidden bg-card"
      data-version-preview={versionPreviewActive || undefined}
      style={editorStyle}
    >
      <div className="absolute right-2.5 bottom-3 z-6">
        <WritingGoalProgress sheetId={sheet.id} wordCount={wordCount} targetWords={sheet.targetWords} />
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
          basicSetup={EDITOR_BASIC_SETUP}
          extensions={editorExtensions}
          onCreateEditor={(view) => {
            editorViewRef.current = view;
            onCreateEditor(view);
          }}
          onChange={handleBodyChange}
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
