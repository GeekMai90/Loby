/**
 * [INPUT]: 依赖 CodeMirror 6、编辑器模块
 * [OUTPUT]: 对外提供 EditorImagePreview、ResolveEditorImagePreview、imagePreviewDecorations，并让本地、远程与失效图片引用都可选择、复制、剪切、查看源码和删除
 * [POS]: 编辑器图片预览的节点选择与输入边界，以 CodeMirror StateField 隔离图片节点和文字光标，选中装饰不重建图片 DOM；剪切只移除 Markdown 引用并保留资源，实际删除才进入资源清理；widget 身份不含文档位置，行首在事件发生时从实时视图解析，纯选区变化不重扫视口
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Prec, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, keymap, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { deleteEditorImageLine, showImageContextMenu, type ImagePreviewActions } from "@/features/editor/model/editorImageContextMenu";
import { parseImageLine, type ImageDisplaySize } from "@/features/editor/model/editorImageMarkdown";

export type { ImagePreviewActions } from "@/features/editor/model/editorImageContextMenu";

const toggleImageSourceEffect = StateEffect.define<number>();
const suppressImageSourceEffect = StateEffect.define<number | null>();
const selectImagePreviewEffect = StateEffect.define<number | null>();
let activeImageSelectionCleanup: (() => void) | null = null;

const selectedImagePreviewLineField = StateField.define<number | null>({
  create() {
    return null;
  },
  update(value, transaction) {
    let next = transaction.docChanged && value !== null ? transaction.changes.mapPos(value, -1) : value;
    for (const effect of transaction.effects) {
      if (effect.is(selectImagePreviewEffect)) next = effect.value;
    }
    if (transaction.selection && transaction.effects.every((effect) => !effect.is(selectImagePreviewEffect))) return null;
    return next;
  },
});

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
    readonly loadSrc: (() => Promise<string>) | undefined,
    readonly alt: string,
    readonly label: string,
    readonly sourcePath: string,
    readonly size: ImageDisplaySize,
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
      widget.sourceVisible === this.sourceVisible &&
      widget.sourcePinned === this.sourcePinned
    );
  }

  toDOM(view: EditorView) {
    const wrapper = document.createElement("span");
    wrapper.className = `cm-image-preview size-${this.size}${this.sourcePinned ? " source-visible" : ""}`;
    wrapper.contentEditable = "false";
    // 行首位置只在事件发生时解析，widget 身份因此不随上方输入位移而失效
    const lineStart = () => imagePreviewLineStart(view, wrapper);
    wrapper.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      if (event.target instanceof HTMLButtonElement) return;
      const position = lineStart();
      if (position === null) return;
      event.preventDefault();
      event.stopPropagation();
      view.dispatch({
        effects: suppressImageSourceEffect.of(position),
      });
    });
    wrapper.addEventListener("click", (event) => {
      if (event.target !== wrapper) return;
      event.preventDefault();
      event.stopPropagation();
    });
    const openContextMenu = (event: MouseEvent) => {
      const position = lineStart();
      if (position === null) return;
      event.preventDefault();
      event.stopPropagation();
      view.dispatch({
        effects: [suppressImageSourceEffect.of(position), selectImagePreviewEffect.of(position)],
      });
      showImageContextMenu(view, {
        alt: this.alt,
        label: this.label,
        lineStart: position,
        size: this.size,
        sourcePath: this.sourcePath,
        x: event.clientX,
        y: event.clientY,
        actions: this.actions,
        onDismiss: () => {
          view.dispatch({ effects: [suppressImageSourceEffect.of(null), selectImagePreviewEffect.of(null)] });
        },
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
      const position = lineStart();
      if (position === null) return;
      view.dispatch({
        effects: toggleImageSourceEffect.of(position),
      });
    });

    const image = document.createElement("img");
    image.alt = this.alt || this.label;
    image.loading = "lazy";
    image.draggable = false;
    image.addEventListener("mousedown", (event) => event.preventDefault());
    image.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const position = lineStart();
      if (position === null) return;
      toggleImagePreviewSelection(view, position);
    });
    image.addEventListener("error", () => {
      wrapper.classList.add("load-failed");
      image.replaceWith(createFailedImagePreview(view, lineStart, this.label, this.sourcePinned));
    });
    wrapper.append(action);
    if (this.src) {
      image.src = this.src;
      wrapper.append(image);
    } else if (this.loadSrc) {
      const loading = document.createElement("span");
      loading.className = "cm-image-preview-loading";
      loading.textContent = "正在加载图片…";
      wrapper.append(loading);
      void this.loadSrc?.()
        .then((src) => {
          if (!wrapper.isConnected) return;
          image.src = src;
          loading.replaceWith(image);
        })
        .catch(() => {
          if (!wrapper.isConnected) return;
          wrapper.classList.add("load-failed");
          loading.replaceWith(createFailedImagePreview(view, lineStart, this.label, this.sourcePinned));
        });
    } else {
      wrapper.classList.add("load-failed");
      wrapper.append(createFailedImagePreview(view, lineStart, this.label, this.sourcePinned));
    }
    return wrapper;
  }
}

/** Resolve the image line from the live view so a widget stays valid while text above it shifts. */
function imagePreviewLineStart(view: EditorView, element: HTMLElement): number | null {
  if (!element.isConnected) return null;
  try {
    return view.state.doc.lineAt(view.posAtDOM(element)).from;
  } catch {
    return null;
  }
}

function createFailedImagePreview(view: EditorView, lineStart: () => number | null, label: string, sourcePinned: boolean) {
  const error = document.createElement("button");
  error.type = "button";
  error.className = "cm-image-preview-error";
  error.title = "显示 Markdown 源码";

  const message = document.createElement("span");
  message.className = "cm-image-preview-error-message";
  message.textContent = `无法加载图片：${label}`;
  const hint = document.createElement("span");
  hint.className = "cm-image-preview-error-hint";
  hint.textContent = "点击查看源码，选中后可删除";
  error.append(message, hint);

  error.addEventListener("mousedown", (event) => event.preventDefault());
  error.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const position = lineStart();
    if (position === null) return;
    view.focus();
    const effects = [selectImagePreviewEffect.of(position)];
    if (!sourcePinned) effects.push(toggleImageSourceEffect.of(position));
    view.dispatch({ effects });
    installImageSelectionDismiss(view);
  });
  return error;
}

function toggleImagePreviewSelection(view: EditorView, lineStart: number) {
  view.focus();
  const selectedLine = view.state.field(selectedImagePreviewLineField, false);
  const nextSelectedLine = selectedLine === lineStart ? null : lineStart;
  view.dispatch({ effects: selectImagePreviewEffect.of(nextSelectedLine) });
  if (nextSelectedLine === null) clearImageSelectionDismiss();
  else installImageSelectionDismiss(view);
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
  loadSrc?: () => Promise<string>;
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
      const sourceVisible = sourcePinned;
      const selected = view.state.field(selectedImagePreviewLineField, false) === line.from;

      decorations.push(
        Decoration.line({
          class: `cm-image-reference-line${selected ? " cm-image-reference-line-selected" : ""}`,
        }).range(line.from),
      );
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
            preview.loadSrc,
            preview.alt,
            preview.label,
            preview.sourcePath,
            image.size,
            sourceVisible,
            sourcePinned,
            imagePreviewActions,
          ),
        }).range(line.to),
      );

      continue;
    }
  }

  return Decoration.set(decorations, true);
}

export function imagePreviewDecorations(resolveImagePreview: ResolveEditorImagePreview, imagePreviewActions: ImagePreviewActions = {}) {
  return [
    imageSourceVisibilityField,
    suppressedImageSourceLineField,
    selectedImagePreviewLineField,
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = buildImagePreviewDecorations(view, resolveImagePreview, imagePreviewActions);
        }

        update(update: ViewUpdate) {
          // 选区本身不进入图片装饰；源码显隐与选中图片都由 StateField 表达，
          // 纯移动光标因此不再重扫视口每一行。
          const sourceVisibilityChanged =
            update.startState.field(imageSourceVisibilityField) !== update.state.field(imageSourceVisibilityField) ||
            update.startState.field(suppressedImageSourceLineField) !== update.state.field(suppressedImageSourceLineField);
          const selectedImageChanged =
            update.startState.field(selectedImagePreviewLineField) !== update.state.field(selectedImagePreviewLineField);
          if (update.docChanged || update.viewportChanged || sourceVisibilityChanged || selectedImageChanged) {
            this.decorations = buildImagePreviewDecorations(update.view, resolveImagePreview, imagePreviewActions);
          }
        }

        destroy() {
          clearImageSelectionDismiss();
        }
      },
      {
        decorations: (plugin) => plugin.decorations,
      },
    ),
    EditorView.editorAttributes.compute([selectedImagePreviewLineField], (state) => ({
      class: state.field(selectedImagePreviewLineField) === null ? "" : "cm-image-selection-active",
    })),
    Prec.high(
      keymap.of([
        {
          key: "Backspace",
          run: (view) => deleteSelectedImagePreview(view, resolveImagePreview, imagePreviewActions),
        },
        {
          key: "Delete",
          run: (view) => deleteSelectedImagePreview(view, resolveImagePreview, imagePreviewActions),
        },
      ]),
    ),
    EditorView.domEventHandlers({
      copy: (event, view) => handleSelectedImageClipboard(event, view, false),
      cut: (event, view) => handleSelectedImageClipboard(event, view, true),
    }),
  ];
}

function handleSelectedImageClipboard(event: ClipboardEvent, view: EditorView, remove: boolean): boolean {
  const lineStart = view.state.field(selectedImagePreviewLineField, false);
  if (lineStart == null) return false;
  const line = view.state.doc.lineAt(lineStart);
  const image = parseImageLine(line.text);
  if (!image) return false;

  event.preventDefault();
  if (event.clipboardData) {
    event.clipboardData.setData("text/plain", line.text);
    event.clipboardData.setData("text/markdown", line.text);
  } else {
    void navigator.clipboard?.writeText(line.text).catch(() => undefined);
  }
  if (!remove) return true;

  if (!deleteEditorImageLine(view, lineStart)) return true;
  clearImageSelectionDismiss();
  return true;
}

function deleteSelectedImagePreview(
  view: EditorView,
  resolveImagePreview: ResolveEditorImagePreview,
  imagePreviewActions: ImagePreviewActions,
): boolean {
  const lineStart = view.state.field(selectedImagePreviewLineField, false);
  if (lineStart == null) return false;
  const line = view.state.doc.lineAt(lineStart);
  const image = parseImageLine(line.text);
  if (!image) return false;
  const preview = resolveImagePreview(image.path, image.alt);
  if (!deleteEditorImageLine(view, lineStart)) return false;
  clearImageSelectionDismiss();
  if (preview?.sourcePath) imagePreviewActions.onDeleteImage?.(preview.sourcePath);
  return true;
}

function installImageSelectionDismiss(view: EditorView) {
  clearImageSelectionDismiss();
  const dismiss = (event: MouseEvent) => {
    const target = event.target;
    if (target instanceof Element && target.closest(".cm-image-preview")) return;
    view.dispatch({ effects: selectImagePreviewEffect.of(null) });
    clearImageSelectionDismiss();
  };
  window.addEventListener("mousedown", dismiss, true);
  activeImageSelectionCleanup = () => window.removeEventListener("mousedown", dismiss, true);
}

function clearImageSelectionDismiss() {
  activeImageSelectionCleanup?.();
  activeImageSelectionCleanup = null;
}
