/**
 * [INPUT]: 依赖 CodeMirror 6
 * [OUTPUT]: 对外提供 editorCursor
 * [POS]: 编辑器 feature 的领域模型边界，集中 编辑器 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { RectangleMarker, EditorView, layer } from "@codemirror/view";

const cursorLayer = layer({
  above: true,
  markers(view) {
    const markers: RectangleMarker[] = [];
    for (const range of view.state.selection.ranges) {
      if (!range.empty) continue;
      const className = range === view.state.selection.main ? "cm-cursor cm-cursor-primary" : "cm-cursor cm-cursor-secondary";
      markers.push(...RectangleMarker.forRange(view, className, range));
    }
    return markers;
  },
  update(update, dom) {
    if (update.transactions.some((transaction) => transaction.selection)) {
      dom.style.animationName = dom.style.animationName === "cm-blink" ? "cm-blink2" : "cm-blink";
    }
    return update.docChanged || update.selectionSet || update.viewportChanged || update.geometryChanged;
  },
  mount(dom) {
    dom.style.animationDuration = "1200ms";
  },
  class: "cm-cursorLayer",
});

const hideNativeCaret = EditorView.theme({
  ".cm-content, .cm-line": {
    caretColor: "transparent !important",
  },
  ".cm-content :focus": {
    caretColor: "initial !important",
  },
});

/** Keep native text selection while drawing a stable, line-height-independent editor caret. */
export const editorCursor = [cursorLayer, hideNativeCaret];
