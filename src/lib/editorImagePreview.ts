import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";

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
