import { RangeSetBuilder, type Extension } from "@codemirror/state";
import { Decoration, ViewPlugin, WidgetType, type DecorationSet, type EditorView, type ViewUpdate } from "@codemirror/view";
import type { AiChangeBlock } from "../types";

export function aiReviewDecorations(changes: AiChangeBlock[]): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildAiReviewDecorations(view.state.doc.toString(), changes);
      }

      update(update: ViewUpdate) {
        if (update.docChanged) {
          this.decorations = buildAiReviewDecorations(update.state.doc.toString(), changes);
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
    },
  );
}

function buildAiReviewDecorations(body: string, changes: AiChangeBlock[]): DecorationSet {
  const decorations = changes
    .flatMap((change) => buildInlineDiffDecorations(body, change))
    .sort((a, b) => a.from - b.from || a.to - b.to || a.order - b.order);
  const builder = new RangeSetBuilder<Decoration>();
  for (const item of decorations) {
    builder.add(item.from, item.to, item.decoration);
  }
  return builder.finish();
}

function buildInlineDiffDecorations(
  body: string,
  change: AiChangeBlock,
): Array<{ from: number; to: number; order: number; decoration: Decoration }> {
  const items: Array<{ from: number; to: number; order: number; decoration: Decoration }> = [];
  const insertedText = change.toText || "";
  const insertedRange = findInsertedRange(body, change);
  if (!insertedRange) return items;

  const diffParts = buildTextDiffParts(change.fromText || "", insertedText);
  let cursor = insertedRange.from;

  for (const part of diffParts) {
    if (part.kind === "same") {
      cursor += part.text.length;
      continue;
    }

    if (part.kind === "added") {
      const from = cursor;
      const to = cursor + part.text.length;
      if (from < to) {
        items.push({
          from,
          to,
          order: 1,
          decoration: Decoration.mark({ class: "cm-ai-inserted" }),
        });
      }
      cursor = to;
      continue;
    }

    items.push({
      from: cursor,
      to: cursor,
      order: 0,
      decoration: Decoration.widget({
        widget: new DeletedTextWidget(part.text),
        side: -1,
      }),
    });
  }

  if (diffParts.length === 0 && insertedRange.from < insertedRange.to) {
    items.push({ ...insertedRange, order: 1, decoration: Decoration.mark({ class: "cm-ai-inserted" }) });
  }

  return items;
}

function findInsertedRange(body: string, change: AiChangeBlock): { from: number; to: number } | null {
  if (!change.toText) return null;
  if (typeof change.anchor.from === "number" && typeof change.anchor.to === "number") {
    const from = Math.max(0, Math.min(change.anchor.from, body.length));
    const to = Math.max(from, Math.min(change.anchor.to, body.length));
    if (body.slice(from, to) === change.toText) return { from, to };
  }
  const index = body.indexOf(change.toText);
  if (index === -1) return null;
  return { from: index, to: index + change.toText.length };
}

class DeletedTextWidget extends WidgetType {
  constructor(private readonly text: string) {
    super();
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-ai-deleted";
    span.textContent = this.text;
    return span;
  }

  eq(other: DeletedTextWidget) {
    return other.text === this.text;
  }
}

type TextDiffPart = { kind: "same" | "added" | "removed"; text: string };

function buildTextDiffParts(source: string, result: string): TextDiffPart[] {
  if (!source && !result) return [];
  if (!source) return [{ kind: "added", text: result }];
  if (!result) return [{ kind: "removed", text: source }];

  const sourceTokens = splitDiffTokens(source);
  const resultTokens = splitDiffTokens(result);
  const table = Array.from({ length: sourceTokens.length + 1 }, () => Array(resultTokens.length + 1).fill(0));

  for (let i = sourceTokens.length - 1; i >= 0; i -= 1) {
    for (let j = resultTokens.length - 1; j >= 0; j -= 1) {
      table[i][j] = sourceTokens[i] === resultTokens[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const parts: TextDiffPart[] = [];
  let i = 0;
  let j = 0;

  function push(kind: TextDiffPart["kind"], text: string) {
    if (!text) return;
    const previous = parts[parts.length - 1];
    if (previous?.kind === kind) {
      previous.text += text;
    } else {
      parts.push({ kind, text });
    }
  }

  while (i < sourceTokens.length && j < resultTokens.length) {
    if (sourceTokens[i] === resultTokens[j]) {
      push("same", sourceTokens[i]);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      push("removed", sourceTokens[i]);
      i += 1;
    } else {
      push("added", resultTokens[j]);
      j += 1;
    }
  }

  while (i < sourceTokens.length) {
    push("removed", sourceTokens[i]);
    i += 1;
  }

  while (j < resultTokens.length) {
    push("added", resultTokens[j]);
    j += 1;
  }

  return parts;
}

function splitDiffTokens(text: string): string[] {
  if (!text) return [];
  return Array.from(text);
}
