import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { search, searchKeymap } from "@codemirror/search";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap, type ViewUpdate } from "@codemirror/view";
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
} from "./editorExtensions";
import { createImageImportExtension } from "./editorImageImport";
import { createEditorLinkNavigationExtension } from "./editorLinkNavigation";
import { editorCursor } from "./editorCursor";
import { lobyMarkdownExtensions } from "./editorMarkdownLanguage";
import { markdownShortcutKeymap } from "./editorMarkdown";
import { slashMenuExtension } from "./editorSlashMenu";

interface EditorCoreExtensionsOptions {
  readOnly?: boolean;
  additionalExtensions?: Extension[];
  typewriterMode?: boolean;
  onImportImageFiles?: (files: File[]) => Promise<string[]>;
  onResolveImagePreview?: (referencePath: string, alt: string) => EditorImagePreview | null;
  onOpenImage?: (sourcePath: string) => void;
  onSaveImageAs?: (sourcePath: string, label: string) => void;
  onInsertImage?: () => void;
  onUpdate?: (update: ViewUpdate) => void;
}

export function createEditorCoreExtensions({
  readOnly = false,
  additionalExtensions = [],
  typewriterMode = false,
  onImportImageFiles,
  onResolveImagePreview,
  onOpenImage,
  onSaveImageAs,
  onInsertImage,
  onUpdate,
}: EditorCoreExtensionsOptions = {}): Extension[] {
  return [
    history(),
    search({ top: true }),
    EditorState.readOnly.of(readOnly),
    EditorView.editable.of(!readOnly),
    keymap.of([...markdownShortcutKeymap, ...searchKeymap, ...defaultKeymap, ...historyKeymap]),
    onImportImageFiles ? createImageImportExtension(onImportImageFiles) : [],
    createEditorLinkNavigationExtension(),
    chineseEditorPhrases,
    markdown({ extensions: lobyMarkdownExtensions }),
    markdownHighlighting,
    markdownSyntaxDecorations,
    quoteLineDecorations,
    tableLineDecorations,
    ...additionalExtensions,
    onResolveImagePreview
      ? imagePreviewDecorations(onResolveImagePreview, {
          onOpenImage,
          onSaveImageAs,
        })
      : [],
    slashMenuExtension({ onInsertImage }),
    EditorView.lineWrapping,
    editorCursor,
    editorTheme,
    onUpdate ? EditorView.updateListener.of(onUpdate) : [],
    typewriterMode ? typewriterScrollExtension : [],
  ];
}
