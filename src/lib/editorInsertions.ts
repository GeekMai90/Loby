import type { EditorView } from "@codemirror/view";

interface MarkdownBlockInsertion {
  from: number;
  to: number;
  text: string;
  cursorOffset: number;
}

export interface MarkdownDocumentInsertion {
  body: string;
  cursor: number;
}

export function insertImageReferenceBlocks(view: EditorView, references: string[], from: number, to: number): string | null {
  const doc = view.state.doc.sliceString(0);
  const insertion = buildImageReferenceBlockInsertion(doc, from, to, references);
  if (!insertion) return null;

  view.dispatch({
    changes: { from: insertion.from, to: insertion.to, insert: insertion.text },
    selection: { anchor: insertion.from + insertion.cursorOffset },
    scrollIntoView: true,
  });
  view.focus();
  return view.state.doc.sliceString(0);
}

export function insertMarkdownTextBlock(view: EditorView, markdown: string, from: number, to: number): string | null {
  const doc = view.state.doc.sliceString(0);
  const insertion = buildMarkdownBlockInsertion(doc, from, to, markdown);
  if (!insertion) return null;

  view.dispatch({
    changes: { from: insertion.from, to: insertion.to, insert: insertion.text },
    selection: { anchor: insertion.from + insertion.cursorOffset },
    scrollIntoView: true,
  });
  view.focus();
  return view.state.doc.sliceString(0);
}

export function buildImageReferenceDocumentInsertion(
  doc: string,
  from: number,
  to: number,
  references: string[],
): MarkdownDocumentInsertion | null {
  const insertion = buildImageReferenceBlockInsertion(doc, from, to, references);
  return insertion ? applyBlockInsertion(doc, insertion) : null;
}

export function buildMarkdownTextDocumentInsertion(
  doc: string,
  from: number,
  to: number,
  markdown: string,
): MarkdownDocumentInsertion | null {
  const insertion = buildMarkdownBlockInsertion(doc, from, to, markdown);
  return insertion ? applyBlockInsertion(doc, insertion) : null;
}

function buildImageReferenceBlockInsertion(doc: string, from: number, to: number, references: string[]): MarkdownBlockInsertion | null {
  const block = references
    .map((reference) => reference.trim())
    .filter(Boolean)
    .join("\n\n");
  if (!block) return null;

  const normalized = normalizeSurroundingNewlines(doc, from, to);
  const before = doc.slice(0, normalized.from);
  const prefix = before.trim().length === 0 ? "" : "\n\n";
  const suffix = "\n\n";
  const text = `${prefix}${block}${suffix}`;

  return {
    from: normalized.from,
    to: normalized.to,
    text,
    cursorOffset: text.length,
  };
}

function buildMarkdownBlockInsertion(doc: string, from: number, to: number, markdown: string): MarkdownBlockInsertion | null {
  const block = markdown.trim();
  if (!block) return null;

  const before = doc.slice(0, from);
  const after = doc.slice(to);
  const prefix = buildLeadingBlockSeparator(before);
  const suffix = buildTrailingBlockSeparator(after);
  const text = `${prefix}${block}${suffix}`;

  return {
    from,
    to,
    text,
    cursorOffset: text.length,
  };
}

function applyBlockInsertion(doc: string, insertion: MarkdownBlockInsertion): MarkdownDocumentInsertion {
  return {
    body: `${doc.slice(0, insertion.from)}${insertion.text}${doc.slice(insertion.to)}`,
    cursor: insertion.from + insertion.cursorOffset,
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

function normalizeSurroundingNewlines(doc: string, from: number, to: number) {
  let normalizedFrom = from;
  let normalizedTo = to;
  while (normalizedFrom > 0 && doc[normalizedFrom - 1] === "\n") normalizedFrom -= 1;
  while (normalizedTo < doc.length && doc[normalizedTo] === "\n") normalizedTo += 1;
  return { from: normalizedFrom, to: normalizedTo };
}
