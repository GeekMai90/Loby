import type { EditorView } from "@codemirror/view";
import { rewriteImageLineSize, type ImageDisplaySize } from "./editorImageMarkdown";

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
  onDismiss: () => void;
}

const imageSizeLabels: Array<{ value: ImageDisplaySize; label: string }> = [
  { value: "thumbnail", label: "显示为缩略图" },
  { value: "small", label: "显示为小图" },
  { value: "medium", label: "显示为中图" },
  { value: "large", label: "显示为大图" },
];

export function showImageContextMenu(view: EditorView, options: ImageContextMenuOptions) {
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
    createImageContextMenuButton(
      "",
      "删除",
      () => {
        deleteImageLine(view, options.lineStart);
      },
      "danger-menu-item",
    ),
  );

  view.dom.append(menu);
  const rect = menu.getBoundingClientRect();
  const left = Math.min(options.x, window.innerWidth - rect.width - 8);
  const top = Math.min(options.y, window.innerHeight - rect.height - 8);
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${Math.max(8, top)}px`;

  const close = (event?: Event) => {
    if (event && menu.contains(event.target as Node)) return;
    options.onDismiss();
    closeImageContextMenu();
  };
  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      options.onDismiss();
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

function createImageContextMenuButton(shortcut: string, label: string, onSelect: () => void, className?: string) {
  const button = document.createElement("button");
  button.type = "button";
  if (className) button.className = className;
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
