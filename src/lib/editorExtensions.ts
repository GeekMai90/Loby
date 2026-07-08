import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";

export { editorTheme } from "./editorTheme";
export { markdownHighlighting, chineseEditorPhrases } from "./editorLanguage";
export { imagePreviewDecorations, type EditorImagePreview, type ImagePreviewActions, type ResolveEditorImagePreview } from "./editorImagePreview";



class HeadingMarkerWidget extends WidgetType {
  constructor(readonly marker: string) {
    super();
  }

  eq(widget: WidgetType) {
    return widget instanceof HeadingMarkerWidget && widget.marker === this.marker;
  }

  toDOM() {
    const marker = document.createElement("span");
    marker.className = "cm-heading-marker-widget";
    marker.textContent = this.marker;
    return marker;
  }
}


function buildHeadingMarkerDecorations(view: EditorView) {
  const decorations = [];
  const decoratedLines = new Set<number>();

  for (const range of view.visibleRanges) {
    const startLine = view.state.doc.lineAt(range.from).number;
    const endLine = view.state.doc.lineAt(range.to).number;

    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
      if (decoratedLines.has(lineNumber)) continue;
      decoratedLines.add(lineNumber);

      const line = view.state.doc.line(lineNumber);
      const match = line.text.match(/^(#{1,4})([ \t]+)/);
      if (!match) continue;

      const marker = match[1];
      const markerLength = marker.length;

      decorations.push(
        Decoration.replace({
          widget: new HeadingMarkerWidget(marker),
        }).range(line.from, line.from + markerLength + match[2].length),
      );
    }
  }

  return Decoration.set(decorations, true);
}

function buildEmphasisDecorations(view: EditorView) {
  const decorations = [];

  for (const range of view.visibleRanges) {
    const startLine = view.state.doc.lineAt(range.from).number;
    const endLine = view.state.doc.lineAt(range.to).number;

    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
      const line = view.state.doc.line(lineNumber);

      for (const match of line.text.matchAll(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g)) {
        const prefixLength = match[1].length;
        const from = line.from + match.index + prefixLength + 1;
        const to = from + match[2].length;
        decorations.push(Decoration.mark({ class: "cm-emphasis-rendered" }).range(from, to));
      }

      for (const match of line.text.matchAll(/(^|[^_])_([^_\n]+?)_(?!_)/g)) {
        const prefixLength = match[1].length;
        const from = line.from + match.index + prefixLength + 1;
        const to = from + match[2].length;
        decorations.push(Decoration.mark({ class: "cm-emphasis-rendered" }).range(from, to));
      }
    }
  }

  return Decoration.set(decorations, true);
}

function buildHighlightDecorations(view: EditorView) {
  const decorations = [];

  for (const range of view.visibleRanges) {
    const startLine = view.state.doc.lineAt(range.from).number;
    const endLine = view.state.doc.lineAt(range.to).number;

    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
      const line = view.state.doc.line(lineNumber);

      for (const match of line.text.matchAll(/::([^:\n]+?)::/g)) {
        const from = line.from + match.index + 2;
        const to = from + match[1].length;
        decorations.push(Decoration.mark({ class: "cm-highlight-rendered" }).range(from, to));
      }
    }
  }

  return Decoration.set(decorations, true);
}

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

export const headingMarkerDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildHeadingMarkerDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildHeadingMarkerDecorations(update.view);
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
);

export const emphasisDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildEmphasisDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildEmphasisDecorations(update.view);
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
);

export const highlightDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildHighlightDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildHighlightDecorations(update.view);
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
);

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
