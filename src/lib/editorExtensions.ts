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
  ".cm-image-preview.size-thumbnail img": {
    maxWidth: "160px",
    maxHeight: "120px",
  },
  ".cm-image-preview.size-small img": {
    maxWidth: "320px",
    maxHeight: "240px",
  },
  ".cm-image-preview.size-medium img": {
    maxWidth: "520px",
    maxHeight: "360px",
  },
  ".cm-image-preview.size-large img": {
    maxWidth: "100%",
    maxHeight: "520px",
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
  ".cm-image-context-menu": {
    position: "fixed",
    zIndex: "10000",
    minWidth: "148px",
    border: "1px solid rgb(0 0 0 / 12%)",
    borderRadius: "8px",
    padding: "5px 6px",
    color: "#1d1d1f",
    backgroundColor: "rgb(255 255 255 / 92%)",
    boxShadow: "0 12px 30px rgb(0 0 0 / 18%)",
    font: "13px -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', sans-serif",
    backdropFilter: "blur(22px) saturate(160%)",
  },
  ".cm-image-context-menu button": {
    display: "grid",
    gridTemplateColumns: "14px 1fr",
    alignItems: "center",
    columnGap: "4px",
    width: "100%",
    minHeight: "26px",
    border: "0",
    borderRadius: "5px",
    padding: "0 9px 0 3px",
    color: "inherit",
    backgroundColor: "transparent",
    font: "inherit",
    textAlign: "left",
    cursor: "default",
  },
  ".cm-image-context-menu button:hover": {
    backgroundColor: "#0071e3",
    color: "#ffffff",
  },
  ".cm-image-context-check": {
    display: "inline-block",
    width: "14px",
    color: "inherit",
    textAlign: "center",
  },
  ".cm-image-context-label": {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  ".cm-image-context-menu-separator": {
    height: "1px",
    margin: "5px 10px",
    backgroundColor: "rgb(0 0 0 / 10%)",
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
const suppressImageSourceEffect = StateEffect.define<number | null>();

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

const suppressedImageSourceLineField = StateField.define<number | null>({
  create() {
    return null;
  },
  update(value, transaction) {
    let next = value;
    if (transaction.docChanged && next !== null) {
      next = transaction.changes.mapPos(next, -1);
    }
    for (const effect of transaction.effects) {
      if (effect.is(suppressImageSourceEffect)) {
        next = effect.value;
      }
    }
    if (transaction.selection && transaction.effects.every((effect) => !effect.is(suppressImageSourceEffect))) {
      next = null;
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
    readonly sourcePath: string,
    readonly size: ImageDisplaySize,
    readonly lineStart: number,
    readonly sourceVisible: boolean,
    readonly sourcePinned: boolean,
    readonly actions: ImagePreviewActions,
  ) {
    super();
  }

  eq(widget: WidgetType) {
    return (
      widget instanceof ImagePreviewWidget &&
      widget.src === this.src &&
      widget.alt === this.alt &&
      widget.label === this.label &&
      widget.sourcePath === this.sourcePath &&
      widget.size === this.size &&
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
    wrapper.className = `cm-image-preview size-${this.size}${this.sourcePinned ? " source-visible" : ""}`;
    wrapper.contentEditable = "false";
    const openContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      wrapper.classList.add("selected");
      view.dispatch({
        effects: suppressImageSourceEffect.of(this.lineStart),
      });
      showImageContextMenu(view, {
        alt: this.alt,
        label: this.label,
        lineStart: this.lineStart,
        size: this.size,
        sourcePath: this.sourcePath,
        x: event.clientX,
        y: event.clientY,
        actions: this.actions,
      });
    };
    wrapper.addEventListener("contextmenu", openContextMenu);

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

type ImageDisplaySize = "thumbnail" | "small" | "medium" | "large";

export interface ImagePreviewActions {
  onOpenImage?: (sourcePath: string) => void;
  onSaveImageAs?: (sourcePath: string, label: string) => void;
}

interface ImageContextMenuOptions {
  alt: string;
  label: string;
  lineStart: number;
  size: ImageDisplaySize;
  sourcePath: string;
  x: number;
  y: number;
  actions: ImagePreviewActions;
}

const imageSizeLabels: Array<{ value: ImageDisplaySize; label: string }> = [
  { value: "thumbnail", label: "显示为缩略图" },
  { value: "small", label: "显示为小图" },
  { value: "medium", label: "显示为中图" },
  { value: "large", label: "显示为大图" },
];

function showImageContextMenu(view: EditorView, options: ImageContextMenuOptions) {
  closeImageContextMenu();

  const menu = document.createElement("div");
  menu.className = "cm-image-context-menu";
  menu.addEventListener("mousedown", (event) => event.preventDefault());
  menu.addEventListener("contextmenu", (event) => event.preventDefault());

  for (const item of imageSizeLabels) {
    menu.append(
      createImageContextMenuButton(`${item.value === options.size ? "✓" : ""}`, item.label, () => {
        updateImageLineSize(view, options.lineStart, item.value);
      }),
    );
  }
  menu.append(createImageContextMenuSeparator());
  menu.append(
    createImageContextMenuButton("", "打开", () => {
      options.actions.onOpenImage?.(options.sourcePath);
    }),
  );
  menu.append(createImageContextMenuSeparator());
  menu.append(
    createImageContextMenuButton("", "剪切", () => {
      void writeClipboardText(getImageLine(view, options.lineStart).text);
      deleteImageLine(view, options.lineStart);
    }),
    createImageContextMenuButton("", "拷贝", () => {
      void writeClipboardText(getImageLine(view, options.lineStart).text);
    }),
    createImageContextMenuButton("", "粘贴", () => {
      void readClipboardText().then((text) => {
        if (!text.trim()) return;
        insertTextAfterImageLine(view, options.lineStart, text.trim());
      });
    }),
  );
  menu.append(createImageContextMenuSeparator());
  menu.append(
    createImageContextMenuButton("", "另存为...", () => {
      options.actions.onSaveImageAs?.(options.sourcePath, options.label || options.alt || "image");
    }),
  );
  menu.append(createImageContextMenuSeparator());
  menu.append(
    createImageContextMenuButton("", "删除", () => {
      deleteImageLine(view, options.lineStart);
    }),
  );

  view.dom.append(menu);
  const rect = menu.getBoundingClientRect();
  const left = Math.min(options.x, window.innerWidth - rect.width - 8);
  const top = Math.min(options.y, window.innerHeight - rect.height - 8);
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${Math.max(8, top)}px`;

  const close = (event?: Event) => {
    if (event && menu.contains(event.target as Node)) return;
    view.dispatch({
      effects: suppressImageSourceEffect.of(null),
    });
    closeImageContextMenu();
  };
  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      view.dispatch({
        effects: suppressImageSourceEffect.of(null),
      });
      closeImageContextMenu();
    }
  };
  menu.dataset.closeHandlers = "active";
  window.setTimeout(() => {
    window.addEventListener("mousedown", close, true);
    window.addEventListener("scroll", closeImageContextMenu, true);
    window.addEventListener("resize", closeImageContextMenu, true);
    window.addEventListener("keydown", closeOnEscape, true);
    activeImageContextMenuCleanup = () => {
      window.removeEventListener("mousedown", close, true);
      window.removeEventListener("scroll", closeImageContextMenu, true);
      window.removeEventListener("resize", closeImageContextMenu, true);
      window.removeEventListener("keydown", closeOnEscape, true);
    };
  }, 0);
}

let activeImageContextMenuCleanup: (() => void) | null = null;

function closeImageContextMenu() {
  document.querySelector(".cm-image-context-menu")?.remove();
  activeImageContextMenuCleanup?.();
  activeImageContextMenuCleanup = null;
}

function createImageContextMenuButton(shortcut: string, label: string, onSelect: () => void) {
  const button = document.createElement("button");
  button.type = "button";
  const checkNode = document.createElement("span");
  checkNode.className = "cm-image-context-check";
  checkNode.textContent = shortcut === "✓" ? shortcut : "";
  const labelNode = document.createElement("span");
  labelNode.className = "cm-image-context-label";
  labelNode.textContent = label;
  button.append(checkNode, labelNode);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeImageContextMenu();
    onSelect();
  });
  return button;
}

function createImageContextMenuSeparator() {
  const separator = document.createElement("div");
  separator.className = "cm-image-context-menu-separator";
  return separator;
}

async function writeClipboardText(text: string) {
  await navigator.clipboard?.writeText(text);
}

async function readClipboardText() {
  return navigator.clipboard?.readText() ?? "";
}

function getImageLine(view: EditorView, lineStart: number) {
  return view.state.doc.lineAt(lineStart);
}

function updateImageLineSize(view: EditorView, lineStart: number, size: ImageDisplaySize) {
  const line = getImageLine(view, lineStart);
  const nextText = rewriteImageLineSize(line.text, size);
  if (nextText === line.text) return;
  view.dispatch({
    changes: { from: line.from, to: line.to, insert: nextText },
    selection: { anchor: line.from + nextText.length },
    scrollIntoView: true,
  });
  view.focus();
}

function deleteImageLine(view: EditorView, lineStart: number) {
  const line = getImageLine(view, lineStart);
  let from = line.from;
  let to = line.to;
  if (line.number < view.state.doc.lines) {
    to = view.state.doc.line(line.number + 1).from;
  } else if (line.number > 1) {
    from = view.state.doc.line(line.number - 1).to;
  }
  view.dispatch({
    changes: { from, to, insert: "" },
    selection: { anchor: from },
    scrollIntoView: true,
  });
  view.focus();
}

function insertTextAfterImageLine(view: EditorView, lineStart: number, text: string) {
  const line = getImageLine(view, lineStart);
  const insert = `\n\n${text}`;
  view.dispatch({
    changes: { from: line.to, to: line.to, insert },
    selection: { anchor: line.to + insert.length },
    scrollIntoView: true,
  });
  view.focus();
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
  sourcePath: string;
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

function buildImagePreviewDecorations(
  view: EditorView,
  resolveImagePreview: ResolveEditorImagePreview,
  imagePreviewActions: ImagePreviewActions,
) {
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
      const sourceSuppressed = view.state.field(suppressedImageSourceLineField, false) === line.from;
      const sourceVisible = sourcePinned || (!sourceSuppressed && selectionTouchesLine(view, line.from, line.to));
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
          widget: new ImagePreviewWidget(
            preview.src,
            preview.alt,
            preview.label,
            preview.sourcePath,
            image.size,
            line.from,
            sourceVisible,
            sourcePinned,
            imagePreviewActions,
          ),
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

function parseImageLine(text: string): { path: string; alt: string; raw: string; size: ImageDisplaySize } | null {
  const raw = text.trim();
  const markdownMatch = raw.match(/^!\[([^\]\n]*)\]\(([^)\n]+)\)$/);
  if (markdownMatch) {
    const target = parseMarkdownImageTarget(markdownMatch[2] ?? "");
    return {
      alt: markdownMatch[1]?.trim() ?? "",
      path: target.path,
      raw,
      size: target.size,
    };
  }

  const obsidianMatch = raw.match(/^!\[\[([^\]\n]+)\]\]$/);
  if (!obsidianMatch) return null;
  const [path = "", alt = "", size = ""] = (obsidianMatch[1] ?? "").split("|");
  return { path: path.trim(), alt: alt.trim(), raw, size: normalizeImageSize(size) };
}

function rewriteImageLineSize(text: string, size: ImageDisplaySize): string {
  const raw = text.trim();
  const markdownMatch = raw.match(/^!\[([^\]\n]*)\]\(([^)\n]+)\)$/);
  if (markdownMatch) {
    const target = parseMarkdownImageTarget(markdownMatch[2] ?? "");
    const path = formatMarkdownImagePath(target.path);
    return `![${markdownMatch[1] ?? ""}](${path} "nibva-size=${size}")`;
  }

  const obsidianMatch = raw.match(/^!\[\[([^\]\n]+)\]\]$/);
  if (obsidianMatch) {
    const [path = "", alt = ""] = (obsidianMatch[1] ?? "").split("|");
    return `![[${path.trim()}|${alt.trim()}|${size}]]`;
  }

  return text;
}

function parseMarkdownImageTarget(target: string): { path: string; size: ImageDisplaySize } {
  const value = target.trim();
  if (!value) return { path: "", size: "large" };
  if (value.startsWith("<")) {
    const end = value.indexOf(">");
    const path = end > 1 ? value.slice(1, end).trim() : "";
    return { path, size: parseImageSizeFromText(value.slice(end + 1)) };
  }
  const quotedTitleIndex = value.search(/\s+["']/);
  const path = (quotedTitleIndex > 0 ? value.slice(0, quotedTitleIndex) : value).trim();
  const metadata = quotedTitleIndex > 0 ? value.slice(quotedTitleIndex) : "";
  return { path, size: parseImageSizeFromText(metadata) };
}

function parseMarkdownImageDestination(target: string): string {
  return parseMarkdownImageTarget(target).path;
}

function parseImageSizeFromText(value: string): ImageDisplaySize {
  const match = value.match(/nibva-size=(thumbnail|small|medium|large)/);
  return normalizeImageSize(match?.[1] ?? "");
}

function normalizeImageSize(value: string): ImageDisplaySize {
  if (value === "thumbnail" || value === "small" || value === "medium" || value === "large") return value;
  return "large";
}

function formatMarkdownImagePath(path: string): string {
  return /\s/.test(path) ? `<${path}>` : path;
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

export function imagePreviewDecorations(resolveImagePreview: ResolveEditorImagePreview, imagePreviewActions: ImagePreviewActions = {}) {
  return [
    imageSourceVisibilityField,
    suppressedImageSourceLineField,
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = buildImagePreviewDecorations(view, resolveImagePreview, imagePreviewActions);
        }

        update(update: ViewUpdate) {
          const sourceVisibilityChanged =
            update.startState.field(imageSourceVisibilityField) !== update.state.field(imageSourceVisibilityField) ||
            update.startState.field(suppressedImageSourceLineField) !== update.state.field(suppressedImageSourceLineField);
          if (update.docChanged || update.viewportChanged || update.selectionSet || sourceVisibilityChanged) {
            this.decorations = buildImagePreviewDecorations(update.view, resolveImagePreview, imagePreviewActions);
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
