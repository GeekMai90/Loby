/**
 * [INPUT]: 依赖 CodeMirror 6、编辑器 Markdown/脚注模块与 shared 快捷键契约
 * [OUTPUT]: 对外提供 createEditorCoreExtensions
 * [POS]: 编辑器 feature 的领域模型边界，集中 编辑器 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
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
  type EditorImagePreview,
  typewriterScrollExtension,
} from "@/features/editor/model/editorExtensions";
import { createImageImportExtension } from "@/features/editor/model/editorImageImport";
import { createEditorLinkNavigationExtension } from "@/features/editor/model/editorLinkNavigation";
import { createEditorFootnoteNavigationExtension } from "@/features/editor/model/editorFootnoteNavigation";
import { editorCursor } from "@/features/editor/model/editorCursor";
import { lobyMarkdownExtensions } from "@/features/editor/model/editorMarkdownLanguage";
import { markdownShortcutKeymap } from "@/features/editor/model/editorMarkdown";
import { slashMenuExtension } from "@/features/editor/model/editorSlashMenu";
import { APP_SHORTCUTS, codeMirrorShortcutKey } from "@/shared/lib/keyboardShortcuts";

const editorDefaultKeymap = defaultKeymap.filter((binding) => binding.key !== codeMirrorShortcutKey(APP_SHORTCUTS.openShortcuts));

interface EditorCoreExtensionsOptions {
  readOnly?: boolean;
  additionalExtensions?: Extension[];
  typewriterMode?: boolean;
  onImportImageFiles?: (files: File[]) => Promise<string[]>;
  onResolveImagePreview?: (referencePath: string, alt: string) => EditorImagePreview | null;
  onOpenImage?: (sourcePath: string) => void;
  onSaveImageAs?: (sourcePath: string, label: string) => void;
  onDeleteImage?: (sourcePath: string) => void;
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
  onDeleteImage,
  onInsertImage,
  onUpdate,
}: EditorCoreExtensionsOptions = {}): Extension[] {
  return [
    history(),
    search({ top: true }),
    EditorState.readOnly.of(readOnly),
    EditorView.editable.of(!readOnly),
    keymap.of([...markdownShortcutKeymap, ...searchKeymap, ...editorDefaultKeymap, ...historyKeymap]),
    onImportImageFiles ? createImageImportExtension(onImportImageFiles) : [],
    createEditorLinkNavigationExtension(),
    createEditorFootnoteNavigationExtension(),
    chineseEditorPhrases,
    markdown({ extensions: lobyMarkdownExtensions }),
    markdownHighlighting,
    markdownSyntaxDecorations,
    quoteLineDecorations,
    ...additionalExtensions,
    onResolveImagePreview
      ? imagePreviewDecorations(onResolveImagePreview, {
          onOpenImage,
          onSaveImageAs,
          onDeleteImage,
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
