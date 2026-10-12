/**
 * [INPUT]: 依赖 CodeMirror 6、shared 公共契约
 * [OUTPUT]: 对外提供 MarkdownFormat、applyEditorMarkdownFormat、markdownShortcutKeymap，支持底部格式栏的三级标题、有序列表与表格插入
 * [POS]: 编辑器 feature 的领域模型边界，集中 编辑器 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { insertMarkdownTextBlock } from "@/features/editor/model/editorInsertions";
import { APP_SHORTCUTS, codeMirrorShortcutKey } from "@/shared/lib/keyboardShortcuts";

export type MarkdownFormat =
  | "h1"
  | "h2"
  | "h3"
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "highlight"
  | "link"
  | "code"
  | "list"
  | "ordered"
  | "task"
  | "quote"
  | "divider"
  | "table";

export function applyEditorMarkdownFormat(view: EditorView | null, format: MarkdownFormat) {
  if (!view) return;
  if (format === "bold") {
    wrapEditorSelection(view, "**", "加粗文本");
    return;
  }
  if (format === "italic") {
    wrapEditorSelection(view, "*", "斜体文本");
    return;
  }
  if (format === "underline") {
    wrapEditorSelection(view, "~", "下划线文本");
    return;
  }
  if (format === "strike") {
    wrapEditorSelection(view, "~~", "删除文本");
    return;
  }
  if (format === "highlight") {
    wrapEditorSelection(view, "==", "高亮文本");
    return;
  }
  if (format === "link") {
    insertMarkdownLink(view);
    return;
  }
  if (format === "code") {
    wrapEditorSelection(view, "`", "code");
    return;
  }
  if (format === "divider") {
    insertMarkdownDivider(view);
    return;
  }
  if (format === "table") {
    insertEditorTable(view);
    return;
  }
  formatEditorLines(view, format);
}

function insertEditorTable(view: EditorView) {
  const line = view.state.doc.lineAt(view.state.selection.main.to);
  const table = ["| 列 1 | 列 2 | 列 3 |", "| --- | --- | --- |", "|  |  |  |", "|  |  |  |"].join("\n");
  insertMarkdownTextBlock(view, table, line.to, line.to);
}

export const markdownShortcutKeymap = [
  { key: codeMirrorShortcutKey(APP_SHORTCUTS.bold), preventDefault: true, run: (view: EditorView) => runMarkdownShortcut(view, "bold") },
  {
    key: codeMirrorShortcutKey(APP_SHORTCUTS.italic),
    preventDefault: true,
    run: (view: EditorView) => runMarkdownShortcut(view, "italic"),
  },
  { key: codeMirrorShortcutKey(APP_SHORTCUTS.link), preventDefault: true, run: (view: EditorView) => runMarkdownShortcut(view, "link") },
  {
    key: codeMirrorShortcutKey(APP_SHORTCUTS.inlineCode),
    preventDefault: true,
    run: (view: EditorView) => runMarkdownShortcut(view, "code"),
  },
];

function wrapEditorSelection(view: EditorView, marker: string, placeholder: string) {
  const range = view.state.selection.main;
  const selected = view.state.sliceDoc(range.from, range.to);
  const content = selected || placeholder;
  const replacement = `${marker}${content}${marker}`;
  const contentFrom = range.from + marker.length;
  const contentTo = contentFrom + content.length;

  view.dispatch({
    changes: { from: range.from, to: range.to, insert: replacement },
    selection: selected ? EditorSelection.cursor(range.from + replacement.length) : EditorSelection.range(contentFrom, contentTo),
  });
  view.focus();
}

function insertMarkdownLink(view: EditorView) {
  const range = view.state.selection.main;
  const selected = view.state.sliceDoc(range.from, range.to);
  const label = selected || "链接文字";
  const url = "https://";
  const replacement = `[${label}](${url})`;
  const labelFrom = range.from + 1;
  const labelTo = labelFrom + label.length;
  const urlFrom = range.from + replacement.length - url.length - 1;
  const urlTo = urlFrom + url.length;

  view.dispatch({
    changes: { from: range.from, to: range.to, insert: replacement },
    selection: selected ? EditorSelection.range(urlFrom, urlTo) : EditorSelection.range(labelFrom, labelTo),
  });
  view.focus();
}

function insertMarkdownDivider(view: EditorView) {
  const range = view.state.selection.main;
  const line = view.state.doc.lineAt(range.from);
  const lineIsBlank = line.text.trim() === "";
  const insertion = lineIsBlank ? "---" : "\n\n---\n\n";
  const from = lineIsBlank ? line.from : line.to;
  const to = lineIsBlank ? line.to : line.to;

  view.dispatch({
    changes: { from, to, insert: insertion },
    selection: EditorSelection.cursor(from + insertion.length),
  });
  view.focus();
}

function formatEditorLines(
  view: EditorView,
  format: Exclude<MarkdownFormat, "bold" | "italic" | "underline" | "strike" | "highlight" | "link" | "code" | "divider" | "table">,
) {
  const range = view.state.selection.main;
  const startLine = view.state.doc.lineAt(range.from);
  const rawEndLine = view.state.doc.lineAt(range.to);
  const endLine = range.to > range.from && range.to === rawEndLine.from ? view.state.doc.line(rawEndLine.number - 1) : rawEndLine;
  const lines: string[] = [];
  let ordinal = 0;

  for (let lineNumber = startLine.number; lineNumber <= endLine.number; lineNumber += 1) {
    const text = view.state.doc.line(lineNumber).text;
    if (text.trim()) ordinal += 1;
    lines.push(transformMarkdownLine(text, format, ordinal));
  }

  const replacement = lines.join("\n");
  view.dispatch({
    changes: { from: startLine.from, to: endLine.to, insert: replacement },
    selection: EditorSelection.range(startLine.from, startLine.from + replacement.length),
  });
  view.focus();
}

function transformMarkdownLine(
  line: string,
  format: Exclude<MarkdownFormat, "bold" | "italic" | "underline" | "strike" | "highlight" | "link" | "code" | "divider" | "table">,
  ordinal: number,
): string {
  if (!line.trim()) return line;
  const trimmedLeft = line.trimStart();
  const leading = line.slice(0, line.length - trimmedLeft.length);

  if (format === "h1") return `${leading}# ${trimmedLeft.replace(/^#{1,6}\s+/, "")}`;
  if (format === "h2") return `${leading}## ${trimmedLeft.replace(/^#{1,6}\s+/, "")}`;
  if (format === "h3") return `${leading}### ${trimmedLeft.replace(/^#{1,6}\s+/, "")}`;
  if (format === "ordered") {
    return /^\d+[.)]\s+/.test(trimmedLeft)
      ? `${leading}${trimmedLeft.replace(/^\d+[.)]\s+/, "")}`
      : `${leading}${ordinal}. ${trimmedLeft.replace(/^[-*+]\s+(?:\[[ xX]\]\s+)?/, "").replace(/^>\s?/, "")}`;
  }
  if (format === "list") {
    return /^[-*+]\s+/.test(trimmedLeft)
      ? `${leading}${trimmedLeft.replace(/^[-*+]\s+/, "")}`
      : `${leading}- ${trimmedLeft.replace(/^>\s?/, "")}`;
  }
  if (format === "task") {
    return /^[-*+]\s+\[[ xX]\]\s+/.test(trimmedLeft)
      ? `${leading}${trimmedLeft.replace(/^[-*+]\s+\[[ xX]\]\s+/, "")}`
      : `${leading}- [ ] ${trimmedLeft.replace(/^>\s?/, "").replace(/^[-*+]\s+/, "")}`;
  }
  return /^>\s?/.test(trimmedLeft)
    ? `${leading}${trimmedLeft.replace(/^>\s?/, "")}`
    : `${leading}> ${trimmedLeft.replace(/^[-*+]\s+/, "")}`;
}

function runMarkdownShortcut(view: EditorView, format: MarkdownFormat): boolean {
  applyEditorMarkdownFormat(view, format);
  return true;
}
