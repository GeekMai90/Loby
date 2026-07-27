/**
 * [INPUT]: 依赖 CodeMirror 6、编辑器模块
 * [OUTPUT]: 对外提供 quoteLineDecorations、typewriterScrollExtension、editorTheme、markdownHighlighting、chineseEditorPhrases、markdownSyntaxDecorations、imagePreviewDecorations 等公开能力
 * [POS]: 编辑器 feature 的扩展聚合边界；Markdown 表格由语法树装饰器统一持有，不再保留正则行判断
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";

export { editorTheme } from "@/features/editor/model/editorTheme";
export { markdownHighlighting, chineseEditorPhrases } from "@/features/editor/model/editorLanguage";
export { markdownSyntaxDecorations } from "@/features/editor/model/editorMarkdownDecorations";
export {
  imagePreviewDecorations,
  type EditorImagePreview,
  type ImagePreviewActions,
  type ResolveEditorImagePreview,
} from "@/features/editor/model/editorImagePreview";

function buildQuoteLineDecorations(view: EditorView) {
  const decorations = [];

  for (const range of view.visibleRanges) {
    const startLine = view.state.doc.lineAt(range.from).number;
    const endLine = view.state.doc.lineAt(range.to).number;

    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
      const line = view.state.doc.line(lineNumber);
      if (!/^>\s?/.test(line.text)) continue;
      decorations.push(Decoration.line({ class: "cm-quote-line" }).range(line.from));
    }
  }

  return Decoration.set(decorations, true);
}

export const quoteLineDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildQuoteLineDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildQuoteLineDecorations(update.view);
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
);

export const typewriterScrollExtension = EditorView.updateListener.of((update) => {
  if ((!update.docChanged && !update.selectionSet) || !update.view.hasFocus) return;
  const head = update.state.selection.main.head;
  window.requestAnimationFrame(() => {
    update.view.dispatch({
      effects: EditorView.scrollIntoView(head, { y: "center" }),
    });
  });
});
