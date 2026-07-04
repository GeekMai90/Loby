import type { EditorView } from "@codemirror/view";

export function getEditorSelection(view: EditorView | null): string {
  if (!view) return "";
  const range = view.state.selection.main;
  if (range.empty) return "";
  return view.state.sliceDoc(range.from, range.to);
}

export function getEditorSelectionRange(view: EditorView | null): { from: number; to: number } | null {
  if (!view) return null;
  const range = view.state.selection.main;
  if (range.empty) return null;
  return { from: range.from, to: range.to };
}
