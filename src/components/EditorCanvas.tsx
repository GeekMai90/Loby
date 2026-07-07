import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { keymap } from "@codemirror/view";
import { search, searchKeymap } from "@codemirror/search";
import { EditorView } from "@codemirror/view";
import type { CSSProperties } from "react";
import type { EditorTypographySettings, WritingSheet } from "../types";
import {
  chineseEditorPhrases,
  emphasisDecorations,
  editorTheme,
  headingMarkerDecorations,
  highlightDecorations,
  imagePreviewDecorations,
  markdownHighlighting,
  quoteLineDecorations,
  tableLineDecorations,
  type EditorImagePreview,
  typewriterScrollExtension,
} from "../lib/editorExtensions";
import { insertImageReferenceBlocks } from "../lib/editorInsertions";
import { markdownShortcutKeymap } from "../lib/editorMarkdown";

interface EditorCanvasProps {
  sheet: WritingSheet;
  previewMode: boolean;
  previewHtml: string;
  previewBusy: boolean;
  typewriterMode: boolean;
  typography: EditorTypographySettings;
  onCreateEditor: (view: EditorView) => void;
  onBodyChange: (body: string) => void;
  onSelectionChange: (text: string) => void;
  onImportImageFiles: (files: File[]) => Promise<string[]>;
  onResolveImagePreview: (referencePath: string, alt: string) => EditorImagePreview | null;
  onOpenImage: (sourcePath: string) => void;
  onSaveImageAs: (sourcePath: string, label: string) => void;
}

export function EditorCanvas({
  sheet,
  previewMode,
  previewHtml,
  previewBusy,
  typewriterMode,
  typography,
  onCreateEditor,
  onBodyChange,
  onSelectionChange,
  onImportImageFiles,
  onResolveImagePreview,
  onOpenImage,
  onSaveImageAs,
}: EditorCanvasProps) {
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

  return (
    <section className="editor-canvas" style={editorStyle}>
      {previewMode ? (
        <article className="sheet-preview">
          {previewBusy && <p className="muted-text">正在生成预览...</p>}
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
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
          }}
          extensions={[
            history(),
            search({ top: true }),
            keymap.of([...markdownShortcutKeymap, ...searchKeymap, ...defaultKeymap, ...historyKeymap]),
            createImageImportExtension(onImportImageFiles),
            chineseEditorPhrases,
            markdown(),
            markdownHighlighting,
            headingMarkerDecorations,
            emphasisDecorations,
            highlightDecorations,
            quoteLineDecorations,
            tableLineDecorations,
            imagePreviewDecorations(onResolveImagePreview, {
              onOpenImage,
              onSaveImageAs,
            }),
            EditorView.lineWrapping,
            editorTheme,
            EditorView.updateListener.of((update) => {
              if (!update.selectionSet && !update.docChanged) return;
              const range = update.state.selection.main;
              onSelectionChange(range.empty ? "" : update.state.sliceDoc(range.from, range.to));
            }),
            typewriterMode ? typewriterScrollExtension : [],
          ]}
          onCreateEditor={onCreateEditor}
          onChange={onBodyChange}
        />
      )}
    </section>
  );
}

function createImageImportExtension(onImportImageFiles: (files: File[]) => Promise<string[]>) {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const files = getImageFilesFromClipboard(event.clipboardData);
      if (files.length === 0) return false;
      event.preventDefault();
      void onImportImageFiles(files).then((references) => {
        insertImageReferenceBlocks(view, references, view.state.selection.main.from, view.state.selection.main.to);
      });
      return true;
    },
    drop(event, view) {
      const files = getImageFilesFromDataTransfer(event.dataTransfer);
      if (files.length === 0) return false;
      event.preventDefault();
      const position = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.from;
      void onImportImageFiles(files).then((references) => {
        insertImageReferenceBlocks(view, references, position, position);
      });
      return true;
    },
  });
}

function getImageFilesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return [];
  return Array.from(data.items)
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
}

function getImageFilesFromDataTransfer(data: DataTransfer | null): File[] {
  if (!data) return [];
  return Array.from(data.files).filter((file) => file.type.startsWith("image/"));
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
