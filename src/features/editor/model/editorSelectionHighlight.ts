/**
 * [INPUT]: 依赖 CodeMirror 6 的 EditorView 与 RectangleMarker
 * [OUTPUT]: 对外提供 setEditorSelectionHighlightActive
 * [POS]: 编辑器选区的跨焦点视觉桥接；仅在选区工具栏接管焦点时挂载不参与编辑的覆盖层，不派发事务、不改变 selection、编辑焦点或 IME 行为
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { RectangleMarker, type EditorView } from "@codemirror/view";

const highlightLayers = new WeakMap<EditorView, HTMLElement>();

export function setEditorSelectionHighlightActive(view: EditorView | null, active: boolean) {
  if (!view) return;
  highlightLayers.get(view)?.remove();
  highlightLayers.delete(view);
  if (!active) return;

  const range = view.state.selection.main;
  if (range.empty) return;
  const markers = RectangleMarker.forRange(view, "cm-selection-toolbar-highlight", range);
  if (markers.length === 0) return;

  const layer = document.createElement("div");
  layer.className = "cm-layer cm-selection-toolbar-layer";
  layer.setAttribute("aria-hidden", "true");
  layer.style.zIndex = "-1";
  layer.style.transform = `scale(${1 / view.scaleX}, ${1 / view.scaleY})`;
  for (const marker of markers) layer.append(marker.draw());
  view.scrollDOM.append(layer);
  highlightLayers.set(view, layer);
}
