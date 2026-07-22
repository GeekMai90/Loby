/**
 * [INPUT]: 依赖 CodeMirror 6
 * [OUTPUT]: 对外提供 EditorSelectionToolbarPosition、resolveEditorSelectionToolbarPosition
 * [POS]: 编辑器 feature 的领域模型边界，集中 编辑器 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { EditorView } from "@codemirror/view";

export type EditorSelectionToolbarPosition = {
  left: number;
  top: number;
  width: number;
  placement: "above" | "below";
};

export function resolveEditorSelectionToolbarPosition(
  view: EditorView,
  from: number,
  to: number,
  container: HTMLElement | null,
  status: "ready" | "format" | "running" | "answer" | "edit" | "error" = "ready",
): EditorSelectionToolbarPosition | null {
  if (!container) return null;
  const start = view.coordsAtPos(Math.max(0, Math.min(from, view.state.doc.length)), 1);
  const end = view.coordsAtPos(Math.max(0, Math.min(to, view.state.doc.length)), -1);
  if (!start || !end) return null;
  const bounds = container.getBoundingClientRect();
  const content = view.dom.querySelector<HTMLElement>(".cm-content");
  const contentBounds = content?.getBoundingClientRect();
  const contentStyle = content ? window.getComputedStyle(content) : null;
  const contentPaddingLeft = Number.parseFloat(contentStyle?.paddingLeft ?? "0") || 0;
  const contentPaddingRight = Number.parseFloat(contentStyle?.paddingRight ?? "0") || 0;
  const textColumnWidth = contentBounds
    ? Math.max(1, contentBounds.width - contentPaddingLeft - contentPaddingRight)
    : Math.max(1, bounds.width - 56);
  const preferredWidth = status === "ready" || status === "format" ? 240 : textColumnWidth;
  const width = Math.min(preferredWidth, Math.max(1, bounds.width - 24));
  const estimatedHeight = status === "answer" ? 180 : status === "ready" ? 178 : status === "format" ? 48 : 58;
  const selectionCenterX = (start.left + end.right) / 2 - bounds.left;
  const textColumnCenterX = contentBounds ? contentBounds.left + contentPaddingLeft + textColumnWidth / 2 - bounds.left : bounds.width / 2;
  const centerX = status === "ready" || status === "format" ? selectionCenterX : textColumnCenterX;
  const left = clamp(centerX - width / 2, 12, Math.max(12, bounds.width - width - 12));
  const below = end.bottom - bounds.top + 10;
  const fitsBelow = below + estimatedHeight <= bounds.height - 12;
  const placement = fitsBelow ? "below" : "above";
  const top = fitsBelow ? below : Math.max(12, start.top - bounds.top - 10);
  return { left, top, width, placement };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
