/**
 * [INPUT]: 依赖 CodeMirror 6、编辑器模块
 * [OUTPUT]: 对外提供 EditorImagePreview、ResolveEditorImagePreview、imagePreviewDecorations
 * [POS]: 编辑器 feature 的领域模型边界，集中 编辑器 规则、数据转换与外部契约
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
    readonly alt: string,
    readonly label: string,
    readonly sourcePath: string,
    readonly size: ImageDisplaySize,
    readonly lineStart: number,
    readonly sourceVisible: boolean,
    readonly sourcePinned: boolean,
    readonly selected: boolean,
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
      widget.sourcePinned === this.sourcePinned &&
      widget.selected === this.selected
    );
  }

  toDOM(view: EditorView) {
    if (!this.src) {
      const error = document.createElement("span");
      error.className = "cm-image-preview-error";
      error.textContent = `无法预览图片：${this.label}`;
      return error;
    }

    const wrapper = document.createElement("span");
    wrapper.className = `cm-image-preview size-${this.size}${this.sourcePinned ? " source-visible" : ""}${this.selected ? " selected" : ""}`;
    wrapper.contentEditable = "false";
    wrapper.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      if (event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      event.stopPropagation();
      view.dispatch({
        effects: suppressImageSourceEffect.of(this.lineStart),
      });
    });
    wrapper.addEventListener("click", (event) => {
      if (event.target !== wrapper) return;
      event.preventDefault();
      event.stopPropagation();
    });
    const openContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      view.dispatch({
        effects: [suppressImageSourceEffect.of(this.lineStart), selectImagePreviewEffect.of(this.lineStart)],
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
      view.focus();
      const selectedLine = view.state.field(selectedImagePreviewLineField, false);
      const nextSelectedLine = selectedLine === this.lineStart ? null : this.lineStart;
      view.dispatch({ effects: selectImagePreviewEffect.of(nextSelectedLine) });
      if (nextSelectedLine === null) clearImageSelectionDismiss();
      else installImageSelectionDismiss(view);
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
            selected,
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
          const sourceVisibilityChanged =
            update.startState.field(imageSourceVisibilityField) !== update.state.field(imageSourceVisibilityField) ||
            update.startState.field(suppressedImageSourceLineField) !== update.state.field(suppressedImageSourceLineField);
          const selectedImageChanged =
            update.startState.field(selectedImagePreviewLineField) !== update.state.field(selectedImagePreviewLineField);
          if (update.docChanged || update.viewportChanged || update.selectionSet || sourceVisibilityChanged || selectedImageChanged) {
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
  ];
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
