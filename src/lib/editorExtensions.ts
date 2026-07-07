import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
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
  ".cm-image-preview": {
    display: "block",
    position: "relative",
    maxWidth: "100%",
    margin: "0 0 14px",
    borderRadius: "8px",
  },
  ".cm-image-reference-line": {
    paddingBottom: "0",
  },
  ".cm-image-reference-line-hidden": {
    lineHeight: "0",
  },
  ".cm-image-separator-line-hidden": {
    height: "0",
    paddingBottom: "0",
    lineHeight: "0",
  },
  ".cm-image-reference-hidden": {
    fontSize: "0",
    lineHeight: "0",
    color: "transparent",
  },
  ".cm-image-reference-hidden *": {
    color: "transparent",
  },
  ".cm-image-preview img": {
    display: "block",
    maxWidth: "100%",
    maxHeight: "420px",
    borderRadius: "8px",
    objectFit: "contain",
    boxShadow: "0 1px 2px rgb(0 0 0 / 8%)",
  },
  ".cm-image-preview-action": {
    position: "absolute",
    top: "8px",
    right: "8px",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    width: "30px",
    height: "30px",
    border: "1px solid rgb(255 255 255 / 72%)",
    borderRadius: "999px",
    padding: "0",
    color: "#1d1d1f",
    backgroundColor: "rgb(255 255 255 / 86%)",
    boxShadow: "0 4px 14px rgb(0 0 0 / 14%)",
    cursor: "pointer",
    backdropFilter: "blur(14px) saturate(140%)",
  },
  ".cm-image-preview-action svg": {
    width: "16px",
    height: "16px",
    stroke: "currentColor",
  },
  ".cm-image-preview-action:hover": {
    backgroundColor: "rgb(255 255 255 / 96%)",
  },
  ".cm-image-preview.selected .cm-image-preview-action, .cm-image-preview.source-visible .cm-image-preview-action": {
    display: "flex",
  },
  ".cm-image-preview-error": {
    display: "inline-flex",
    maxWidth: "100%",
    margin: "8px 0 14px",
    borderRadius: "7px",
    padding: "8px 10px",
    color: "#6e6e73",
    backgroundColor: "#f5f5f7",
    fontSize: "13px",
    lineHeight: "1.35",
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

const toggleImageSourceEffect = StateEffect.define<number>();

const imageSourceVisibilityField = StateField.define<Set<number>>({
  create() {
    return new Set();
  },
  update(value, transaction) {
    let next = value;

    if (transaction.docChanged && next.size > 0) {
      next = new Set(Array.from(next, (position) => transaction.changes.mapPos(position, -1)));
    }

    for (const effect of transaction.effects) {
      if (!effect.is(toggleImageSourceEffect)) continue;
      if (next === value) next = new Set(value);
      const lineStart = transaction.newDoc.lineAt(effect.value).from;
      if (next.has(lineStart)) {
        next.delete(lineStart);
      } else {
        next.add(lineStart);
      }
    }

    if (transaction.selection && next.size > 0) {
      const selectedLines = transaction.newSelection.ranges.map((range) => ({
        from: transaction.newDoc.lineAt(range.from).from,
        to: transaction.newDoc.lineAt(range.to).from,
      }));
      const retained = Array.from(next).filter((lineStart) =>
        selectedLines.some((selectedLine) => lineStart >= selectedLine.from && lineStart <= selectedLine.to),
      );
      next = retained.length === next.size ? next : new Set(retained);
    }

    return next;
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

class ImagePreviewWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
    readonly label: string,
    readonly lineStart: number,
    readonly sourceVisible: boolean,
    readonly sourcePinned: boolean,
  ) {
    super();
  }

  eq(widget: WidgetType) {
    return (
      widget instanceof ImagePreviewWidget &&
      widget.src === this.src &&
      widget.alt === this.alt &&
      widget.label === this.label &&
      widget.lineStart === this.lineStart &&
      widget.sourceVisible === this.sourceVisible &&
      widget.sourcePinned === this.sourcePinned
    );
  }

  toDOM(view: EditorView) {
    if (!this.src) {
      const error = document.createElement("span");
      error.className = "cm-image-preview-error";
      error.textContent = `无法预览图片：${this.label}`;
      return error;
    }

    const wrapper = document.createElement("div");
    wrapper.className = `cm-image-preview${this.sourcePinned ? " source-visible" : ""}`;
    wrapper.contentEditable = "false";

    const action = document.createElement("button");
    action.className = "cm-image-preview-action";
    action.type = "button";
    action.title = this.sourcePinned ? "隐藏 Markdown 源码" : "显示 Markdown 源码";
    action.setAttribute("aria-label", this.sourcePinned ? "隐藏 Markdown 源码" : "显示 Markdown 源码");
    action.innerHTML = codeIconSvg;
    action.addEventListener("mousedown", (event) => event.preventDefault());
    action.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      view.dispatch({
        effects: toggleImageSourceEffect.of(this.lineStart),
      });
    });

    const image = document.createElement("img");
    image.src = this.src;
    image.alt = this.alt || this.label;
    image.loading = "lazy";
    image.draggable = false;
    image.addEventListener("mousedown", (event) => event.preventDefault());
    image.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const selected = wrapper.classList.toggle("selected");
      if (selected) {
        const clearSelection = (nextEvent: MouseEvent) => {
          if (wrapper.contains(nextEvent.target as Node)) return;
          wrapper.classList.remove("selected");
          window.removeEventListener("mousedown", clearSelection, true);
        };
        window.addEventListener("mousedown", clearSelection, true);
      }
    });
    image.addEventListener("error", () => {
      wrapper.replaceChildren();
      const error = document.createElement("span");
      error.className = "cm-image-preview-error";
      error.textContent = `无法加载图片：${this.label}`;
      wrapper.append(error);
    });
    wrapper.append(action, image);
    return wrapper;
  }
}

const codeIconSvg = [
  '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">',
  '<path d="m16 18 6-6-6-6"></path>',
  '<path d="m8 6-6 6 6 6"></path>',
  '<path d="m14.5 4-5 16"></path>',
  "</svg>",
].join("");

export interface EditorImagePreview {
  src: string;
  alt: string;
  label: string;
}

export type ResolveEditorImagePreview = (referencePath: string, alt: string) => EditorImagePreview | null;

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

function buildImagePreviewDecorations(view: EditorView, resolveImagePreview: ResolveEditorImagePreview) {
  const decorations = [];
  const decoratedLines = new Set<number>();

  for (const range of view.visibleRanges) {
    const startLine = view.state.doc.lineAt(range.from).number;
    const endLine = view.state.doc.lineAt(range.to).number;

    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
      if (decoratedLines.has(lineNumber)) continue;
      decoratedLines.add(lineNumber);

      const line = view.state.doc.line(lineNumber);
      const image = parseImageLine(line.text);
      if (!image) continue;

      const preview = resolveImagePreview(image.path, image.alt);
      if (!preview) continue;
      const sourcePinned = view.state.field(imageSourceVisibilityField, false)?.has(line.from) ?? false;
      const sourceVisible = sourcePinned || selectionTouchesLine(view, line.from, line.to);
      decorations.push(Decoration.line({ class: "cm-image-reference-line" }).range(line.from));
      if (!sourceVisible) {
        decorations.push(
          Decoration.line({ class: "cm-image-reference-line-hidden" }).range(line.from),
          Decoration.mark({ class: "cm-image-reference-hidden" }).range(line.from, line.to),
        );
      }
      decorations.push(
        Decoration.widget({
          side: 1,
          widget: new ImagePreviewWidget(preview.src, preview.alt, preview.label, line.from, sourceVisible, sourcePinned),
        }).range(line.to),
      );

      const nextLineNumber = lineNumber + 1;
      if (nextLineNumber <= view.state.doc.lines) {
        const nextLine = view.state.doc.line(nextLineNumber);
        if (nextLine.text.trim() === "" && !selectionTouchesLine(view, nextLine.from, nextLine.to)) {
          decorations.push(Decoration.line({ class: "cm-image-separator-line-hidden" }).range(nextLine.from));
        }
      }
    }
  }

  return Decoration.set(decorations, true);
}

function selectionTouchesLine(view: EditorView, lineFrom: number, lineTo: number) {
  return view.state.selection.ranges.some((range) => range.from <= lineTo && range.to >= lineFrom);
}

function parseImageLine(text: string): { path: string; alt: string; raw: string } | null {
  const raw = text.trim();
  const markdownMatch = raw.match(/^!\[([^\]\n]*)\]\(([^)\n]+)\)$/);
  if (markdownMatch) {
    return {
      alt: markdownMatch[1]?.trim() ?? "",
      path: parseMarkdownImageDestination(markdownMatch[2] ?? ""),
      raw,
    };
  }

  const obsidianMatch = raw.match(/^!\[\[([^\]\n]+)\]\]$/);
  if (!obsidianMatch) return null;
  const [path = "", alt = ""] = (obsidianMatch[1] ?? "").split("|");
  return { path: path.trim(), alt: alt.trim(), raw };
}

function parseMarkdownImageDestination(target: string): string {
  const value = target.trim();
  if (!value) return "";
  if (value.startsWith("<")) {
    const end = value.indexOf(">");
    return end > 1 ? value.slice(1, end).trim() : "";
  }
  const quotedTitleIndex = value.search(/\s+["']/);
  return (quotedTitleIndex > 0 ? value.slice(0, quotedTitleIndex) : value).trim();
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

export function imagePreviewDecorations(resolveImagePreview: ResolveEditorImagePreview) {
  return [
    imageSourceVisibilityField,
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = buildImagePreviewDecorations(view, resolveImagePreview);
        }

        update(update: ViewUpdate) {
          const sourceVisibilityChanged =
            update.startState.field(imageSourceVisibilityField) !== update.state.field(imageSourceVisibilityField);
          if (update.docChanged || update.viewportChanged || update.selectionSet || sourceVisibilityChanged) {
            this.decorations = buildImagePreviewDecorations(update.view, resolveImagePreview);
          }
        }
      },
      {
        decorations: (plugin) => plugin.decorations,
      },
    ),
  ];
}

export const typewriterScrollExtension = EditorView.updateListener.of((update) => {
  if ((!update.docChanged && !update.selectionSet) || !update.view.hasFocus) return;
  const head = update.state.selection.main.head;
  window.requestAnimationFrame(() => {
    update.view.dispatch({
      effects: EditorView.scrollIntoView(head, { y: "center" }),
    });
  });
});
