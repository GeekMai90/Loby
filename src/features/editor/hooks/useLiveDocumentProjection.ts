/**
 * [INPUT]: 依赖当前文稿、CodeMirror live session、待确认正文 reader、预览/发布打开态与 App 注入的 Markdown HTML renderer
 * [OUTPUT]: 对外提供 useLiveDocumentProjection、PendingEditorDocumentReader，返回实时文稿物化函数、发布快照与异步预览 HTML/忙碌状态
 * [POS]: editor feature 的实时正文投影边界；CodeMirror/pending reader 保持正文权威，hook 只为覆盖性动作与外部 surface 生成一致快照，不持久化或改写文稿
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { EditorView } from "@codemirror/view";
import { useCallback, useEffect, useState, type RefObject } from "react";
import { extractFirstHeadingTitle } from "@/shared/lib/markdownTitle";
import type { WritingSheet } from "@/shared/types";

const PREVIEW_RENDER_ERROR_HTML = "<pre>Markdown preview failed.</pre>";

export interface PendingEditorDocumentReader {
  readBody: () => string;
  updatedAt: string;
}

interface UseLiveDocumentProjectionOptions {
  activeSheet: WritingSheet | undefined;
  editorDocumentSessionKey: string;
  editorRef: RefObject<EditorView | null>;
  pendingDocumentsRef: RefObject<Map<string, PendingEditorDocumentReader>>;
  previewMode: boolean;
  publishingMode: boolean;
  renderPreviewHtml: (markdown: string) => Promise<string>;
}

export function useLiveDocumentProjection({
  activeSheet,
  editorDocumentSessionKey,
  editorRef,
  pendingDocumentsRef,
  previewMode,
  publishingMode,
  renderPreviewHtml,
}: UseLiveDocumentProjectionOptions) {
  const [latestExternalSheet, setLatestExternalSheet] = useState<WritingSheet | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewBusy, setPreviewBusy] = useState(false);

  const materializeLatestSheet = useCallback(
    (sheet: WritingSheet): WritingSheet => {
      const pending = pendingDocumentsRef.current.get(sheet.id);
      const liveBody =
        editorDocumentSessionKey === `live:${sheet.id}`
          ? (editorRef.current?.state.doc.toString() ?? pending?.readBody() ?? sheet.body)
          : (pending?.readBody() ?? sheet.body);
      if (liveBody === sheet.body) return sheet;
      return {
        ...sheet,
        title: extractFirstHeadingTitle(liveBody) || sheet.title,
        body: liveBody,
        updatedAt: pending?.updatedAt ?? sheet.updatedAt,
      };
    },
    [editorDocumentSessionKey, editorRef, pendingDocumentsRef],
  );

  useEffect(() => {
    if (!activeSheet || (!previewMode && !publishingMode)) {
      setLatestExternalSheet(null);
      return;
    }
    setLatestExternalSheet(materializeLatestSheet(activeSheet));
  }, [activeSheet, materializeLatestSheet, previewMode, publishingMode]);

  const externalSheet = latestExternalSheet?.id === activeSheet?.id ? latestExternalSheet : activeSheet;
  const latestSheetForPreview = previewMode ? externalSheet : activeSheet;
  const latestSheetForPublishing = publishingMode ? externalSheet : activeSheet;

  useEffect(() => {
    let cancelled = false;
    if (!previewMode || !latestSheetForPreview) {
      setPreviewBusy(false);
      return;
    }

    setPreviewBusy(true);
    renderPreviewHtml(latestSheetForPreview.body)
      .then((html) => {
        if (!cancelled) setPreviewHtml(html);
      })
      .catch(() => {
        if (!cancelled) setPreviewHtml(PREVIEW_RENDER_ERROR_HTML);
      })
      .finally(() => {
        if (!cancelled) setPreviewBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [latestSheetForPreview, previewMode, renderPreviewHtml]);

  return {
    materializeLatestSheet,
    latestSheetForPublishing,
    previewHtml,
    previewBusy,
  };
}
