import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";

export const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    color: "#1d1d1f",
    backgroundColor: "#ffffff",
    fontSize: "var(--editor-body-font-size, 18px)",
  },
  ".cm-scroller": {
    height: "100%",
    fontFamily: "var(--editor-font-family, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Microsoft YaHei', sans-serif)",
    lineHeight: "var(--editor-line-height, 1.76)",
    padding: "28px 0 0",
  },
  ".cm-content": {
    maxWidth: "760px",
    minHeight: "100%",
    margin: "0 auto",
    padding: "0 44px 128px",
    caretColor: "#0071e3",
  },
  ".cm-line": {
    padding: "0 2px var(--editor-paragraph-spacing, 0px)",
  },
  ".cm-table-line": {
    fontSize: "var(--editor-table-font-size, 15px)",
  },
  ".cm-heading-marker-widget": {
    display: "inline-block",
    width: "44px",
    marginLeft: "-50px",
    marginRight: "6px",
    overflow: "visible",
    color: "#d7d7dc",
    fontSize: "13px",
    fontFamily: "'SF Mono', 'SFMono-Regular', Menlo, Consolas, monospace",
    fontWeight: "620",
    letterSpacing: "0",
    lineHeight: "inherit",
    pointerEvents: "none",
    textAlign: "right",
    verticalAlign: "baseline",
    whiteSpace: "pre",
  },
  ".cm-emphasis-rendered": {
    display: "inline-block",
    color: "#4f4f57",
    fontStyle: "normal",
    fontWeight: "520",
    transform: "skewX(-10deg)",
    transformOrigin: "left center",
  },
  ".cm-highlight-rendered": {
    borderRadius: "5px",
    padding: "0 3px",
    color: "#1d1d1f",
    backgroundColor: "#fff3a8",
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
  },
  ".cm-quote-line": {
    borderLeft: "3px solid #d7d7dd",
    borderRadius: "0",
    paddingLeft: "12px",
    color: "#5f6068",
    backgroundColor: "#f7f7f9",
  },
  ".cm-activeLine": {
    backgroundColor: "transparent",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-panels": {
    color: "#1d1d1f",
    backgroundColor: "#fbfbfc",
    borderColor: "#ececf0",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    fontSize: "13px",
  },
  ".cm-panel.cm-search": {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
  },
  ".cm-panel.cm-search input": {
    height: "28px",
    border: "1px solid #d7d7dd",
    borderRadius: "7px",
    padding: "0 8px",
    color: "#1d1d1f",
    backgroundColor: "#ffffff",
    outline: "none",
  },
  ".cm-panel.cm-search button": {
    minHeight: "28px",
    border: "1px solid #d7d7dd",
    borderRadius: "7px",
    padding: "0 8px",
    color: "#1d1d1f",
    backgroundColor: "#ffffff",
    font: "inherit",
  },
  ".cm-panel.cm-search button:hover": {
    backgroundColor: "#f2f2f4",
  },
  ".cm-searchMatch": {
    backgroundColor: "#fff3b0",
  },
  ".cm-searchMatch-selected": {
    backgroundColor: "#ffd85a",
  },
});

export const chineseEditorPhrases = EditorState.phrases.of({
  Find: "查找",
  Replace: "替换",
  next: "下一个",
  previous: "上一个",
  all: "全选",
  "match case": "区分大小写",
  regexp: "正则",
  "by word": "整词",
  replace: "替换",
  "replace all": "全部替换",
  close: "关闭",
  "current match": "当前匹配",
  "on line": "位于行",
  "replaced match on line $": "已替换第 $ 行的匹配",
  "replaced $ matches": "已替换 $ 个匹配",
});

export const markdownHighlighting = syntaxHighlighting(
  HighlightStyle.define([
    {
      tag: tags.heading1,
      color: "#1d1d1f",
      fontSize: "var(--editor-h1-font-size, 25px)",
      fontWeight: "750",
    },
    {
      tag: tags.heading2,
      color: "#1d1d1f",
      fontSize: "var(--editor-h2-font-size, 22px)",
      fontWeight: "720",
    },
    {
      tag: tags.heading3,
      color: "#1d1d1f",
      fontSize: "var(--editor-h3-font-size, 19px)",
      fontWeight: "700",
    },
    {
      tag: tags.heading4,
      color: "#1d1d1f",
      fontWeight: "680",
    },
    {
      tag: tags.strong,
      fontWeight: "720",
    },
    {
      tag: tags.emphasis,
      color: "#4f4f57",
      fontStyle: "oblique 11deg",
      fontWeight: "520",
    },
    {
      tag: tags.quote,
      color: "#5f6068",
      fontStyle: "normal",
    },
    {
      tag: [tags.link, tags.url],
      color: "#0057d9",
      textDecoration: "none",
    },
    {
      tag: tags.monospace,
      color: "#3a3a3c",
      backgroundColor: "#f2f2f7",
      fontFamily: "'SF Mono', 'SFMono-Regular', Consolas, monospace",
    },
  ]),
);

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
