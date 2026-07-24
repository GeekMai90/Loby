/**
 * [INPUT]: 依赖 CodeMirror 6、shared 的 Myers 文本差异与公共契约
 * [OUTPUT]: 对外提供 aiReviewDecorations
 * [POS]: 编辑器 feature 的领域模型边界，集中 编辑器 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { StateField, type Extension } from "@codemirror/state";
import { Decoration, WidgetType, type DecorationSet, EditorView } from "@codemirror/view";
import { buildTextDiffParts } from "@/shared/lib/diff";
import type { AiChangeBlock } from "@/shared/types";

export function aiReviewDecorations(changes: AiChangeBlock[]): Extension {
  return StateField.define<DecorationSet>({
    create(state) {
      return buildAiReviewDecorations(state.doc.toString(), changes);
    },
    update(decorations, transaction) {
      return transaction.docChanged ? buildAiReviewDecorations(transaction.newDoc.toString(), changes) : decorations;
    },
    provide: (field) => EditorView.decorations.from(field),
  });
}

function buildAiReviewDecorations(body: string, changes: AiChangeBlock[]): DecorationSet {
  const decorations = changes
    .flatMap((change) => buildInlineDiffDecorations(body, change))
    .map((item) => item.decoration.range(item.from, item.to));
  return Decoration.set(decorations, true);
}

function buildInlineDiffDecorations(body: string, change: AiChangeBlock): Array<{ from: number; to: number; decoration: Decoration }> {
  const items: Array<{ from: number; to: number; decoration: Decoration }> = [];
  const insertedText = change.toText || "";
  const insertedRange = findInsertedRange(body, change);
  if (!insertedRange) return items;

  const diffParts = buildTextDiffParts(change.fromText || "", insertedText);
  const changedParts = diffParts.filter((part) => part.kind !== "same");
  const structuralOnly = changedParts.length > 0 && changedParts.every((part) => part.text.replace(/[\s*_=~`]/g, "").length === 0);
  if (structuralOnly && insertedRange.from < insertedRange.to) {
    return [
      {
        ...insertedRange,
        decoration: Decoration.mark({ class: "cm-ai-inserted cm-ai-structural-change" }),
      },
    ];
  }

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
          decoration: Decoration.mark({ class: "cm-ai-inserted" }),
        });
      }
      cursor = to;
      continue;
    }

    const block = isWholeLineDeletion(change, part.text);
    items.push({
      from: cursor,
      to: cursor,
      decoration: Decoration.widget({
        widget: new DeletedTextWidget(part.text, block),
        side: -1,
        block,
      }),
    });
  }

  if (diffParts.length === 0 && insertedRange.from < insertedRange.to) {
    items.push({ ...insertedRange, decoration: Decoration.mark({ class: "cm-ai-inserted" }) });
  }

  return items;
}

function findInsertedRange(body: string, change: AiChangeBlock): { from: number; to: number } | null {
  if (typeof change.anchor.from === "number" && typeof change.anchor.to === "number") {
    const from = Math.max(0, Math.min(change.anchor.from, body.length));
    const to = Math.max(from, Math.min(change.anchor.to, body.length));
    if (!change.toText && from === to) return { from, to };
    if (body.slice(from, to) === change.toText) return { from, to };
  }
  const contextRange = findContextRange(body, change);
  if (contextRange) return contextRange;
  if (!change.toText) return null;
  const index = findClosestOccurrence(body, change.toText, change.anchor.from ?? 0);
  if (index === -1) return null;
  return { from: index, to: index + change.toText.length };
}

function findContextRange(body: string, change: AiChangeBlock): { from: number; to: number } | null {
  const before = change.anchor.before || "";
  const after = change.anchor.after || "";
  const expectedFrom = change.anchor.from ?? 0;
  const expectedTo = change.anchor.to ?? expectedFrom;
  const beforeStart = before ? findClosestOccurrence(body, before, Math.max(0, expectedFrom - before.length)) : -1;
  const beforeEnd = beforeStart >= 0 ? beforeStart + before.length : -1;
  const afterStart = after ? findClosestOccurrence(body, after, expectedTo) : -1;

  if (!change.toText) {
    if (beforeEnd >= 0 && afterStart >= beforeEnd) return { from: beforeEnd, to: beforeEnd };
    if (beforeEnd >= 0) return { from: beforeEnd, to: beforeEnd };
    if (afterStart >= 0) return { from: afterStart, to: afterStart };
    return null;
  }

  if (beforeEnd >= 0 && body.slice(beforeEnd, beforeEnd + change.toText.length) === change.toText) {
    return { from: beforeEnd, to: beforeEnd + change.toText.length };
  }
  if (afterStart >= change.toText.length && body.slice(afterStart - change.toText.length, afterStart) === change.toText) {
    return { from: afterStart - change.toText.length, to: afterStart };
  }
  if (beforeEnd >= 0 && afterStart >= beforeEnd && body.slice(beforeEnd, afterStart) === change.toText) {
    return { from: beforeEnd, to: afterStart };
  }
  return null;
}

function findClosestOccurrence(body: string, text: string, expectedFrom: number) {
  let closest = -1;
  let closestDistance = Number.POSITIVE_INFINITY;
  let index = body.indexOf(text);
  while (index >= 0) {
    const distance = Math.abs(index - expectedFrom);
    if (distance < closestDistance) {
      closest = index;
      closestDistance = distance;
    }
    index = body.indexOf(text, index + 1);
  }
  return closest;
}

class DeletedTextWidget extends WidgetType {
  constructor(
    private readonly text: string,
    private readonly block: boolean,
  ) {
    super();
  }

  toDOM() {
    const element = document.createElement(this.block ? "div" : "span");
    element.className = this.block ? "cm-ai-deleted cm-ai-deleted-block" : "cm-ai-deleted";
    element.textContent = this.text;
    return element;
  }

  eq(other: DeletedTextWidget) {
    return other.text === this.text && other.block === this.block;
  }
}

function isWholeLineDeletion(change: AiChangeBlock, removedText: string) {
  if (typeof change.anchor.wholeLine === "boolean") {
    return change.anchor.wholeLine && !change.toText && removedText === change.fromText;
  }
  return (
    !change.toText &&
    removedText === change.fromText &&
    typeof change.anchor.startLine === "number" &&
    typeof change.anchor.endLine === "number"
  );
}
