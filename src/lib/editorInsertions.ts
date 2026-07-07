import type { EditorView } from "@codemirror/view";

interface MarkdownBlockInsertion {
  text: string;
  cursorOffset: number;
}

export function insertImageReferenceBlocks(view: EditorView, references: string[], from: number, to: number) {
  const insertion = buildImageReferenceBlockInsertion(view.state.doc.sliceString(0), from, to, references);
  if (!insertion) return;

  view.dispatch({
    changes: { from, to, insert: insertion.text },
    selection: { anchor: from + insertion.cursorOffset },
    scrollIntoView: true,
  });
  view.focus();
}

function buildImageReferenceBlockInsertion(doc: string, from: number, to: number, references: string[]): MarkdownBlockInsertion | null {
  const block = references
    .map((reference) => reference.trim())
    .filter(Boolean)
    .join("\n\n");
  if (!block) return null;

  const before = doc.slice(0, from);
  const after = doc.slice(to);
  const prefix = buildLeadingBlockSeparator(before);
  const suffix = buildTrailingBlockSeparator(after);
  const text = `${prefix}${block}${suffix}`;

  return {
    text,
    cursorOffset: text.length,
  };
}

function buildLeadingBlockSeparator(before: string) {
  if (before.trim().length === 0) return "";
  return "\n".repeat(Math.max(0, 2 - countTrailingNewlines(before)));
}

function buildTrailingBlockSeparator(after: string) {
  if (after.trim().length === 0) return "\n\n";
  return "\n".repeat(Math.max(0, 2 - countLeadingNewlines(after)));
}

function countTrailingNewlines(value: string) {
  const match = value.match(/\n*$/);
  return match ? match[0].length : 0;
}

function countLeadingNewlines(value: string) {
  const match = value.match(/^\n*/);
  return match ? match[0].length : 0;
}
