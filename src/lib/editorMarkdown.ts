import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export type MarkdownFormat =
  "h1" | "h2" | "bold" | "italic" | "underline" | "strike" | "highlight" | "link" | "code" | "list" | "task" | "quote" | "divider";

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
    wrapEditorSelection(view, "++", "下划线文本");
    return;
  }
  if (format === "strike") {
    wrapEditorSelection(view, "~~", "删除文本");
    return;
  }
  if (format === "highlight") {
    wrapEditorSelection(view, "::", "高亮文本");
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
  formatEditorLines(view, format);
}

export const markdownShortcutKeymap = [
  { key: "Mod-b", preventDefault: true, run: (view: EditorView) => runMarkdownShortcut(view, "bold") },
  { key: "Mod-i", preventDefault: true, run: (view: EditorView) => runMarkdownShortcut(view, "italic") },
  { key: "Mod-k", preventDefault: true, run: (view: EditorView) => runMarkdownShortcut(view, "link") },
  { key: "Mod-e", preventDefault: true, run: (view: EditorView) => runMarkdownShortcut(view, "code") },
  { key: "Mod-Alt-1", preventDefault: true, run: (view: EditorView) => runMarkdownShortcut(view, "h1") },
  { key: "Mod-Alt-2", preventDefault: true, run: (view: EditorView) => runMarkdownShortcut(view, "h2") },
  { key: "Mod-Shift-8", preventDefault: true, run: (view: EditorView) => runMarkdownShortcut(view, "list") },
  { key: "Mod-Shift-9", preventDefault: true, run: (view: EditorView) => runMarkdownShortcut(view, "quote") },
  { key: "Mod-Alt-t", preventDefault: true, run: (view: EditorView) => runMarkdownShortcut(view, "task") },
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
  format: Exclude<MarkdownFormat, "bold" | "italic" | "underline" | "strike" | "highlight" | "link" | "code" | "divider">,
) {
  const range = view.state.selection.main;
  const startLine = view.state.doc.lineAt(range.from);
  const rawEndLine = view.state.doc.lineAt(range.to);
  const endLine = range.to > range.from && range.to === rawEndLine.from ? view.state.doc.line(rawEndLine.number - 1) : rawEndLine;
  const lines: string[] = [];

  for (let lineNumber = startLine.number; lineNumber <= endLine.number; lineNumber += 1) {
    lines.push(transformMarkdownLine(view.state.doc.line(lineNumber).text, format));
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
  format: Exclude<MarkdownFormat, "bold" | "italic" | "underline" | "strike" | "highlight" | "link" | "code" | "divider">,
): string {
  if (!line.trim()) return line;
  const trimmedLeft = line.trimStart();
  const leading = line.slice(0, line.length - trimmedLeft.length);

  if (format === "h1") return `${leading}# ${trimmedLeft.replace(/^#{1,6}\s+/, "")}`;
  if (format === "h2") return `${leading}## ${trimmedLeft.replace(/^#{1,6}\s+/, "")}`;
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
