/**
 * [INPUT]: 依赖 @uiw/react-codemirror、CodeMirror 6、React 运行时、shared 公共契约、编辑器模块、AI 助手模块
 * [OUTPUT]: 对外提供以 CodeMirror 为输入权威、带目录安全区定位、延迟快照耐久化、低频有界模型提交、隔离 React 重渲染的编辑器 session、无卸载预览、跨 session 隔离、可恢复光标与视口的同 session 外部正文同步、编辑区右键菜单、工具栏跨焦点选区高亮和选区去重通知的 EditorCanvas
 * [POS]: 编辑器 feature 的界面组合单元，持有目录滚动几何与编辑器菜单边界；逐键输入不重渲染 CodeMirror，旁路模型与目录投影低频追赶，同一 live session 在预览切换时保留 EditorView，跨文稿切换不得改写旧 EditorView，图片 widget 继续拥有自己的右键菜单
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import CodeMirror from "@uiw/react-codemirror";
import { EditorSelection, Transaction, type Extension } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { AiChangeBlock, EditorTypographySettings, WritingSheet } from "@/shared/types";
import type { EditorImagePreview } from "@/features/editor/model/editorExtensions";
import { useLatestCallback } from "@/shared/hooks/useLatestCallback";
import { aiReviewDecorations } from "@/features/editor/model/editorAiReviewDecorations";
import { createEditorCoreExtensions } from "@/features/editor/model/editorCoreExtensions";
import { applyEditorMarkdownFormat, type MarkdownFormat } from "@/features/editor/model/editorMarkdown";
import { createEditorTypographyStyle } from "@/features/editor/model/editorTypography";
import { resolveEditorSelectionToolbarPosition } from "@/features/editor/model/editorSelectionToolbarPosition";
import { DocumentChangeBuffer } from "@/features/editor/model/documentChangeBuffer";
import { EditorDocumentAuthority } from "@/features/editor/model/editorDocumentAuthority";
import type { InlineAiHandoff, InlineAiPendingEdit, InlineAiResult, InlineAiSelection } from "@/features/assistant/model/inlineAi";
import { copyTextToClipboard } from "@/features/publishing/model/exportBrowser";
import { EditorOutlineNavigator } from "@/features/editor/components/EditorOutlineNavigator";
import { EditorContextMenu } from "@/features/editor/components/EditorContextMenu";
import { EditorSelectionToolbar, type EditorSelectionToolbarSession } from "@/features/editor/components/EditorSelectionToolbar";
import { editorOutlineTopMargin } from "@/features/editor/model/editorOutlineNavigator";
import { setEditorSelectionHighlightActive } from "@/features/editor/model/editorSelectionHighlight";
import { buildTextDiffParts, type TextDiffPart } from "@/shared/lib/diff";

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
const MODEL_COMMIT_DELAY_MS = 240;
const MODEL_COMMIT_MAX_DELAY_MS = 1_000;

interface EditorCodeMirrorSessionProps {
  initialBody: string;
  extensions: Extension[];
  onCreateEditor: (view: EditorView) => void;
}

const EditorCodeMirrorSession = memo(function EditorCodeMirrorSession({
  initialBody,
  extensions,
  onCreateEditor,
}: EditorCodeMirrorSessionProps) {
  const [seedBody] = useState(initialBody);
  return (
    <CodeMirror
      className="editor-instance"
      value={seedBody}
      height="100%"
      theme="light"
      basicSetup={EDITOR_BASIC_SETUP}
      extensions={extensions}
      onCreateEditor={onCreateEditor}
    />
  );
}, editorCodeMirrorSessionPropsEqual);

function editorCodeMirrorSessionPropsEqual(previous: EditorCodeMirrorSessionProps, next: EditorCodeMirrorSessionProps) {
  return previous.extensions === next.extensions && previous.onCreateEditor === next.onCreateEditor;
}

interface EditorCanvasProps {
  sheet: WritingSheet;
  documentSessionKey: string;
  previewMode: boolean;
  previewHtml: string;
  previewBusy: boolean;
  typewriterMode: boolean;
  typography: EditorTypographySettings;
  reviewChanges: AiChangeBlock[];
  readOnly?: boolean;
  versionPreviewActive?: boolean;
  onCreateEditor: (view: EditorView) => void;
  onBodyInput: (sheetId: string, readBody: () => string) => void;
  onBodyChange: (sheetId: string, body: string, readBody: () => string) => void;
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
  onDeleteImage: (sourcePath: string) => void;
  onInsertImage: () => void;
}

export function EditorCanvas({
  sheet,
  documentSessionKey,
  previewMode,
  previewHtml,
  previewBusy,
  typewriterMode,
  typography,
  reviewChanges,
  readOnly = false,
  versionPreviewActive = false,
  onCreateEditor,
  onBodyInput,
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
  onDeleteImage,
  onInsertImage,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const editorViewSessionKeyRef = useRef("");
  const [documentAuthority] = useState(() => new EditorDocumentAuthority());
  const pendingExternalDocumentRef = useRef<{ sessionKey: string; body: string } | null>(null);

  function revealOutlinePosition(position: number) {
    const view = editorViewRef.current;
    if (!view) return;
    const safePosition = Math.max(0, Math.min(position, view.state.doc.length));
    view.dispatch({
      selection: { anchor: safePosition },
      effects: EditorView.scrollIntoView(safePosition, {
        y: "start",
        yMargin: editorOutlineTopMargin(view.scrollDOM.clientHeight),
      }),
    });
    view.focus();
  }
  const runSequenceRef = useRef(0);
  const lastSelectionTextRef = useRef("");
  const [selectionSnapshot, setSelectionSnapshot] = useState<EditorSelectionSnapshot | null>(null);
  const [toolbarSession, setToolbarSession] = useState<EditorSelectionToolbarSession | null>(null);
  const [toolbarFocusWithin, setToolbarFocusWithin] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<InlineAiPendingEdit | null>(null);
  const [handoffDone, setHandoffDone] = useState(false);
  const handleBodyInput = useLatestCallback(onBodyInput);
  const handleBodyChange = useLatestCallback(onBodyChange);
  const handleCreateEditorSession = useLatestCallback((view: EditorView) => {
    editorViewRef.current = view;
    editorViewSessionKeyRef.current = documentSessionKey;
    onCreateEditor(view);
  });
  const [documentChangeBuffer] = useState(
    () =>
      new DocumentChangeBuffer({
        delayMs: MODEL_COMMIT_DELAY_MS,
        maxDelayMs: MODEL_COMMIT_MAX_DELAY_MS,
        commit: (change) => {
          documentAuthority.recordLocalCommit(`live:${change.sheetId}`, change.body);
          handleBodyChange(change.sheetId, change.body, change.readBody);
        },
      }),
  );
  const handleImportImageFiles = useLatestCallback(onImportImageFiles);
  const handleResolveImagePreview = useLatestCallback(onResolveImagePreview);
  const handleOpenImage = useLatestCallback(onOpenImage);
  const handleSaveImageAs = useLatestCallback(onSaveImageAs);
  const handleDeleteImage = useLatestCallback(onDeleteImage);
  const handleInsertImage = useLatestCallback(onInsertImage);
  const handleExternalDocument = useLatestCallback(applyExternalDocument);
  const handleEditorViewUpdate = useLatestCallback(handleEditorUpdate);
  const editorStyle = createEditorTypographyStyle(typography);
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
        onDeleteImage: handleDeleteImage,
        onInsertImage: handleInsertImage,
        onUpdate: (update) => {
          if (!update.selectionSet && !update.docChanged && !update.viewportChanged && !update.focusChanged) return;
          handleEditorViewUpdate(update);
        },
      }),
    [
      handleEditorViewUpdate,
      handleImportImageFiles,
      handleInsertImage,
      handleOpenImage,
      handleResolveImagePreview,
      handleSaveImageAs,
      handleDeleteImage,
      readOnly,
      reviewDecorations,
      typewriterMode,
    ],
  );

  useEffect(() => {
    documentAuthority.beginSession(documentSessionKey);
    runSequenceRef.current += 1;
    setSelectionSnapshot(null);
    setToolbarSession(null);
    setToolbarFocusWithin(false);
    setPendingEdit(null);
    setHandoffDone(false);
  }, [documentAuthority, documentSessionKey, readOnly, sheet.id]);

  const preserveSelectionHighlight = toolbarFocusWithin && toolbarSession?.status === "ready" && selectionSnapshot !== null;

  useEffect(() => {
    if (editorViewSessionKeyRef.current !== documentSessionKey) return;
    setEditorSelectionHighlightActive(editorViewRef.current, preserveSelectionHighlight);
  }, [documentSessionKey, preserveSelectionHighlight, selectionSnapshot?.from, selectionSnapshot?.to]);

  useEffect(() => {
    if (documentAuthority.consumeLocalEcho(documentSessionKey, sheet.body)) return;
    handleExternalDocument({ sessionKey: documentSessionKey, body: sheet.body });
  }, [documentAuthority, documentSessionKey, handleExternalDocument, sheet.body]);

  useEffect(
    () => () => {
      documentChangeBuffer.flush();
    },
    [documentChangeBuffer, previewMode, readOnly, sheet.id],
  );

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

  function applyExternalDocument(document: { sessionKey: string; body: string }) {
    if (document.sessionKey !== documentSessionKey) return;
    const view = editorViewRef.current;
    if (!view || editorViewSessionKeyRef.current !== document.sessionKey) return;
    if (view.composing) {
      pendingExternalDocumentRef.current = document;
      return;
    }
    pendingExternalDocumentRef.current = null;
    const currentBody = view.state.doc.toString();
    if (currentBody === document.body) return;
    const currentSelection = view.state.selection;
    const scrollTop = view.scrollDOM.scrollTop;
    const diffParts = buildTextDiffParts(currentBody, document.body);
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: document.body },
      selection: EditorSelection.create(
        currentSelection.ranges.map((range) => {
          const anchor = mapDocumentPosition(currentBody.length, document.body.length, range.anchor, diffParts);
          const head =
            range.head === range.anchor ? anchor : mapDocumentPosition(currentBody.length, document.body.length, range.head, diffParts);
          return EditorSelection.range(anchor, head);
        }),
        currentSelection.mainIndex,
      ),
      annotations: Transaction.addToHistory.of(false),
    });
    restoreEditorScrollPosition(view, scrollTop);
  }

  function handleEditorUpdate(update: ViewUpdate) {
    const { view } = update;
    const selectionChanged = update.selectionSet;
    const documentChanged = update.docChanged;
    const currentSession = toolbarSession;
    const currentPendingEdit = pendingEdit;
    const canvas = view.dom.closest(".editor-canvas") as HTMLElement | null;
    if (update.focusChanged && view.hasFocus) setToolbarFocusWithin(false);
    if (documentChanged && !readOnly && !previewMode) {
      const document = view.state.doc;
      const readBody = () => document.toString();
      handleBodyInput(sheet.id, readBody);
      documentChangeBuffer.schedule({ sheetId: sheet.id, readBody });
    }
    if (documentChanged && currentPendingEdit && view.state.doc.toString() !== currentPendingEdit.proposedBody) {
      setPendingEdit(null);
      setToolbarSession(null);
    }

    const pendingExternalDocument = pendingExternalDocumentRef.current;
    if (pendingExternalDocument && !view.composing) {
      pendingExternalDocumentRef.current = null;
      queueMicrotask(() => handleExternalDocument(pendingExternalDocument));
    }

    const range = view.state.selection.main;
    if (view.compositionStarted) {
      if (lastSelectionTextRef.current) {
        lastSelectionTextRef.current = "";
        onSelectionChange("");
      }
      if (selectionSnapshot) setSelectionSnapshot(null);
      if (currentSession?.status === "ready") setToolbarSession(null);
      return;
    }
    const selectionText = range.empty ? "" : view.state.sliceDoc(range.from, range.to);
    if (selectionText !== lastSelectionTextRef.current) {
      lastSelectionTextRef.current = selectionText;
      onSelectionChange(selectionText);
    }
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
      if (selectionSnapshot) setSelectionSnapshot(null);
      if (currentSession?.status === "ready") setToolbarSession(null);
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
      {!previewMode && <EditorOutlineNavigator key={documentSessionKey} body={sheet.body} onRevealPosition={revealOutlinePosition} />}
      {previewMode && (
        <article className="sheet-preview">
          {previewBusy && <p className="text-xs leading-4.5 text-muted-foreground">正在生成预览...</p>}
          <div dangerouslySetInnerHTML={{ __html: previewHtml || "<p></p>" }} />
        </article>
      )}
      <EditorContextMenu editorViewRef={editorViewRef} readOnly={readOnly}>
        <div className={previewMode ? "hidden" : "contents"} aria-hidden={previewMode || undefined}>
          <EditorCodeMirrorSession
            key={documentSessionKey}
            initialBody={sheet.body}
            extensions={editorExtensions}
            onCreateEditor={handleCreateEditorSession}
          />
        </div>
      </EditorContextMenu>
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
          onFocusWithinChange={setToolbarFocusWithin}
        />
      )}
    </section>
  );
}

function mapDocumentPosition(sourceLength: number, resultLength: number, position: number, diffParts: TextDiffPart[]): number {
  const safePosition = Math.max(0, Math.min(position, sourceLength));
  if (sourceLength > 0 && diffParts.length === 2 && diffParts[0]?.kind === "removed" && diffParts[1]?.kind === "added") {
    return Math.min(resultLength, Math.round((safePosition / sourceLength) * resultLength));
  }

  let sourceOffset = 0;
  let resultOffset = 0;

  for (const part of diffParts) {
    const length = part.text.length;
    if (part.kind === "same") {
      if (safePosition < sourceOffset + length) return Math.min(resultLength, resultOffset + safePosition - sourceOffset);
      sourceOffset += length;
      resultOffset += length;
      continue;
    }
    if (part.kind === "removed") {
      if (safePosition < sourceOffset + length) return Math.min(resultLength, resultOffset);
      sourceOffset += length;
      continue;
    }
    resultOffset += length;
  }

  return Math.min(resultLength, resultOffset);
}

function restoreEditorScrollPosition(view: EditorView, scrollTop: number) {
  if (!Number.isFinite(scrollTop)) return;
  view.scrollDOM.scrollTop = scrollTop;
  window.requestAnimationFrame(() => {
    view.scrollDOM.scrollTop = scrollTop;
  });
}
