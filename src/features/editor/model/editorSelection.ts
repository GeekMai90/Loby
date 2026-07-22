/**
 * [INPUT]: 依赖 CodeMirror 6
 * [OUTPUT]: 对外提供 getEditorSelection、getEditorSelectionRange
 * [POS]: 编辑器 feature 的领域模型边界，集中 编辑器 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
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
