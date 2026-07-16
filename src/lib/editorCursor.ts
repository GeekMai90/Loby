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
