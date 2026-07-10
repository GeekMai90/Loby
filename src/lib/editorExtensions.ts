import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";

export { editorTheme } from "./editorTheme";
export { markdownHighlighting, chineseEditorPhrases } from "./editorLanguage";
export { markdownSyntaxDecorations } from "./editorMarkdownDecorations";
export {
  imagePreviewDecorations,
  type EditorImagePreview,
  type ImagePreviewActions,
  type ResolveEditorImagePreview,
} from "./editorImagePreview";

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

function buildTableLineDecorations(view: EditorView) {
  const decorations = [];

  for (const range of view.visibleRanges) {
    const startLine = view.state.doc.lineAt(range.from).number;
    const endLine = view.state.doc.lineAt(range.to).number;

    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
      const line = view.state.doc.line(lineNumber);
      if (!/^\s*\|.*\|\s*$/.test(line.text)) continue;
      decorations.push(Decoration.line({ class: "cm-table-line" }).range(line.from));
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

export const tableLineDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildTableLineDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildTableLineDecorations(update.view);
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
