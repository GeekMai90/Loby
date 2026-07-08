import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState, RangeSetBuilder, type Extension } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { search, searchKeymap } from "@codemirror/search";
import { Decoration, EditorView, WidgetType, keymap } from "@codemirror/view";
import type { CSSProperties } from "react";
import type { AiChangeBlock, EditorTypographySettings, WritingSheet } from "../types";
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
import { slashMenuExtension } from "../lib/editorSlashMenu";

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
  onImportImageFiles,
  onResolveImagePreview,
  onOpenImage,
  onSaveImageAs,
  onInsertImage,
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
            chineseEditorPhrases,
            markdown(),
            markdownHighlighting,
            headingMarkerDecorations,
            emphasisDecorations,
            highlightDecorations,
            quoteLineDecorations,
            tableLineDecorations,
            aiReviewDecorations(sheet.body, reviewChanges),
            imagePreviewDecorations(onResolveImagePreview, {
              onOpenImage,
              onSaveImageAs,
            }),
            slashMenuExtension({ onInsertImage }),
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

function aiReviewDecorations(body: string, changes: AiChangeBlock[]): Extension {
  const decorations = changes
    .flatMap((change) => buildInlineDiffDecorations(body, change))
    .sort((a, b) => a.from - b.from || a.to - b.to || a.order - b.order);
  const builder = new RangeSetBuilder<Decoration>();
  for (const item of decorations) {
    builder.add(item.from, item.to, item.decoration);
  }
  return EditorView.decorations.of(builder.finish());
}

function buildInlineDiffDecorations(
  body: string,
  change: AiChangeBlock,
): Array<{ from: number; to: number; order: number; decoration: Decoration }> {
  const items: Array<{ from: number; to: number; order: number; decoration: Decoration }> = [];
  const insertedText = change.toText || "";
  const insertedRange = findInsertedRange(body, change);
  if (!insertedRange) return items;

  const diffParts = buildTextDiffParts(change.fromText || "", insertedText);
  let cursor = insertedRange.from;

  for (const part of diffParts) {
    if (part.kind === "same") {
      cursor += part.text.length;
      continue;
    }

    if (part.kind === "added") {
      const from = cursor;
      const to = cursor + part.text.length;
      if (from < to) {
        items.push({
          from,
          to,
          order: 1,
          decoration: Decoration.mark({ class: "cm-ai-inserted" }),
        });
      }
      cursor = to;
      continue;
    }

    items.push({
      from: cursor,
      to: cursor,
      order: 0,
      decoration: Decoration.widget({
        widget: new DeletedTextWidget(part.text),
        side: -1,
      }),
    });
  }

  if (diffParts.length === 0 && insertedRange.from < insertedRange.to) {
    items.push({ ...insertedRange, order: 1, decoration: Decoration.mark({ class: "cm-ai-inserted" }) });
  }

  return items;
}

function findInsertedRange(body: string, change: AiChangeBlock): { from: number; to: number } | null {
  if (!change.toText) return null;
  const index = body.indexOf(change.toText);
  if (index === -1) return null;
  return { from: index, to: index + change.toText.length };
}

class DeletedTextWidget extends WidgetType {
  constructor(private readonly text: string) {
    super();
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-ai-deleted";
    span.textContent = this.text;
    return span;
  }

  eq(other: DeletedTextWidget) {
    return other.text === this.text;
  }
}

type TextDiffPart = { kind: "same" | "added" | "removed"; text: string };

function buildTextDiffParts(source: string, result: string): TextDiffPart[] {
  if (!source && !result) return [];
  if (!source) return [{ kind: "added", text: result }];
  if (!result) return [{ kind: "removed", text: source }];

  const sourceTokens = splitDiffTokens(source);
  const resultTokens = splitDiffTokens(result);
  const table = Array.from({ length: sourceTokens.length + 1 }, () => Array(resultTokens.length + 1).fill(0));

  for (let i = sourceTokens.length - 1; i >= 0; i -= 1) {
    for (let j = resultTokens.length - 1; j >= 0; j -= 1) {
      table[i][j] =
        sourceTokens[i] === resultTokens[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const parts: TextDiffPart[] = [];
  let i = 0;
  let j = 0;

  function push(kind: TextDiffPart["kind"], text: string) {
    if (!text) return;
    const previous = parts[parts.length - 1];
    if (previous?.kind === kind) {
      previous.text += text;
    } else {
      parts.push({ kind, text });
    }
  }

  while (i < sourceTokens.length && j < resultTokens.length) {
    if (sourceTokens[i] === resultTokens[j]) {
      push("same", sourceTokens[i]);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      push("removed", sourceTokens[i]);
      i += 1;
    } else {
      push("added", resultTokens[j]);
      j += 1;
    }
  }

  while (i < sourceTokens.length) {
    push("removed", sourceTokens[i]);
    i += 1;
  }

  while (j < resultTokens.length) {
    push("added", resultTokens[j]);
    j += 1;
  }

  return parts;
}

function splitDiffTokens(text: string): string[] {
  if (!text) return [];
  return Array.from(text);
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
