import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { keymap } from "@codemirror/view";
import { search, searchKeymap } from "@codemirror/search";
import { EditorView } from "@codemirror/view";
import type { WritingSheet } from "../types";
import {
  chineseEditorPhrases,
  emphasisDecorations,
  editorTheme,
  headingMarkerDecorations,
  highlightDecorations,
  markdownHighlighting,
  quoteLineDecorations,
  typewriterScrollExtension,
} from "../lib/editorExtensions";
import { markdownShortcutKeymap } from "../lib/editorMarkdown";

interface EditorCanvasProps {
  sheet: WritingSheet;
  previewMode: boolean;
  previewHtml: string;
  previewBusy: boolean;
  typewriterMode: boolean;
  onCreateEditor: (view: EditorView) => void;
  onBodyChange: (body: string) => void;
}

export function EditorCanvas({
  sheet,
  previewMode,
  previewHtml,
  previewBusy,
  typewriterMode,
  onCreateEditor,
  onBodyChange,
}: EditorCanvasProps) {
  return (
    <section className="editor-canvas">
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
            chineseEditorPhrases,
            markdown(),
            markdownHighlighting,
            headingMarkerDecorations,
            emphasisDecorations,
            highlightDecorations,
            quoteLineDecorations,
            EditorView.lineWrapping,
            editorTheme,
            typewriterMode ? typewriterScrollExtension : [],
          ]}
          onCreateEditor={onCreateEditor}
          onChange={onBodyChange}
        />
      )}
    </section>
  );
}
