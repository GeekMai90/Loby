export type AiInsertionTarget = "cursor" | "selection" | "end" | "anchor";

const INSERTION_TARGETS: AiInsertionTarget[] = ["cursor", "selection", "end", "anchor"];

export interface EditorInsertionRange {
  from: number;
  to: number;
  head?: number;
}

export type EditorInsertionRangeResult = { ok: true; range: EditorInsertionRange } | { ok: false; message: string };

export interface AiInsertionAnchor {
  type?: unknown;
  index?: unknown;
  position?: unknown;
  text?: unknown;
  heading?: unknown;
  level?: unknown;
}

export interface MarkdownParagraphBlock {
  from: number;
  to: number;
  text: string;
  indexFromStart: number;
  indexFromEnd: number;
}

export function normalizeAiInsertionTarget(value: unknown): AiInsertionTarget {
  if (typeof value !== "string") return "cursor";
  const target = value.trim();
  return INSERTION_TARGETS.includes(target as AiInsertionTarget) ? (target as AiInsertionTarget) : "cursor";
}

export function resolveEditorInsertionRange(
  target: AiInsertionTarget,
  documentText: string,
  selection: EditorInsertionRange,
  anchor?: unknown,
): EditorInsertionRangeResult {
  if (target === "end") return { ok: true, range: { from: documentText.length, to: documentText.length } };
  if (target === "anchor") return resolveAnchorInsertionRange(documentText, anchor);
  if (target === "cursor") {
    const cursor = typeof selection.head === "number" ? selection.head : selection.to;
    return { ok: true, range: { from: cursor, to: cursor } };
  }
  if (target === "selection" && selection.from === selection.to) {
    return { ok: false, message: "这个 AI 动作要求替换当前选区，请先选中文本后再执行。" };
  }
  return { ok: true, range: selection };
}

export function resolveFallbackInsertionRange(
  target: AiInsertionTarget,
  documentText: string,
  anchor?: unknown,
): EditorInsertionRangeResult {
  if (target === "selection") {
    return { ok: false, message: "这个 AI 动作要求替换当前选区，但当前编辑器没有可用选区。" };
  }
  if (target === "anchor") return resolveAnchorInsertionRange(documentText, anchor);
  if (target === "end") return { ok: true, range: { from: documentText.length, to: documentText.length } };
  return { ok: true, range: { from: documentText.length, to: documentText.length } };
}

export function validateFallbackInsertionTarget(target: AiInsertionTarget): EditorInsertionRangeResult {
  return resolveFallbackInsertionRange(target, "");
}

function resolveAnchorInsertionRange(documentText: string, anchor?: unknown): EditorInsertionRangeResult {
  if (!anchor || typeof anchor !== "object") {
    return { ok: false, message: "这个 AI 动作要求锚点定位，但缺少 anchor 描述。" };
  }

  const payload = anchor as AiInsertionAnchor;
  const type = stringValue(payload.type);
  const position = normalizeAnchorPosition(payload.position);
  if (type === "paragraphFromEnd" || type === "paragraphFromStart") {
    const index = positiveInteger(payload.index);
    if (!index) return { ok: false, message: "段落锚点需要提供大于 0 的 index。" };
    const block = resolveParagraphBlock(documentText, type, index, payload.text);
    if (!block) return { ok: false, message: `无法找到${type === "paragraphFromEnd" ? "倒数" : "第"} ${index} 段。` };
    const point = position === "before" ? block.from : block.to;
    return { ok: true, range: { from: point, to: point } };
  }

  if (type === "afterHeading" || type === "beforeHeading") {
    const heading = stringValue(payload.heading) || stringValue(payload.text);
    if (!heading) return { ok: false, message: "标题锚点需要提供 heading。" };
    const point = resolveHeadingPoint(documentText, heading, type === "beforeHeading" ? "before" : "after", payload.level);
    if (point === null) return { ok: false, message: `无法找到标题「${heading}」。` };
    return { ok: true, range: { from: point, to: point } };
  }

  if (type === "afterText" || type === "beforeText") {
    const text = stringValue(payload.text);
    if (!text) return { ok: false, message: "文本锚点需要提供 text。" };
    const index = documentText.indexOf(text);
    if (index === -1) return { ok: false, message: "无法在当前文稿中找到指定锚点文本。" };
    const point = type === "beforeText" ? index : index + text.length;
    return { ok: true, range: { from: point, to: point } };
  }

  return {
    ok: false,
    message: "anchor.type 只支持 paragraphFromEnd、paragraphFromStart、afterHeading、beforeHeading、afterText 或 beforeText。",
  };
}

function resolveParagraphBlock(documentText: string, type: "paragraphFromEnd" | "paragraphFromStart", index: number, textValue?: unknown) {
  const blocks = collectMarkdownParagraphBlocks(documentText);
  const targetIndex = type === "paragraphFromEnd" ? blocks.length - index : index - 1;
  const indexedBlock = blocks[targetIndex] ?? null;
  const text = normalizeComparableText(stringValue(textValue));
  if (!text) return indexedBlock;
  if (indexedBlock && normalizeComparableText(indexedBlock.text).includes(text)) return indexedBlock;

  const textMatches = blocks.filter((block) => normalizeComparableText(block.text).includes(text));
  return textMatches.length === 1 ? textMatches[0] : indexedBlock;
}

export function collectMarkdownParagraphBlocks(documentText: string): MarkdownParagraphBlock[] {
  const blocks: Array<{ from: number; to: number; text: string }> = [];
  const pattern = /\S(?:[\s\S]*?)(?=\n{2,}|\s*$)/g;
  for (const match of documentText.matchAll(pattern)) {
    const raw = match[0] ?? "";
    const from = match.index ?? 0;
    const to = from + raw.length;
    const text = raw.trim();
    if (isMarkdownParagraph(text)) blocks.push({ from, to, text });
  }
  return blocks.map((block, index) => ({
    ...block,
    indexFromStart: index + 1,
    indexFromEnd: blocks.length - index,
  }));
}

function isMarkdownParagraph(block: string): boolean {
  const firstLine =
    block
      .split("\n")
      .find((line) => line.trim())
      ?.trim() ?? "";
  if (!firstLine) return false;
  if (firstLine === "---" || firstLine === "+++") return false;
  if (/^#{1,6}\s+/.test(firstLine)) return false;
  if (/^!\[/.test(firstLine) || /^!\[\[/.test(firstLine)) return false;
  if (/^```|^~~~/.test(firstLine)) return false;
  if (/^[-*+]\s+/.test(firstLine) || /^\d+\.\s+/.test(firstLine)) return false;
  if (/^>/.test(firstLine)) return false;
  if (/^\|.*\|$/.test(firstLine)) return false;
  return true;
}

function resolveHeadingPoint(documentText: string, heading: string, position: "before" | "after", levelValue: unknown): number | null {
  const expected = normalizeComparableText(heading);
  const requestedLevel = positiveInteger(levelValue);
  const pattern = /^(#{1,6})\s+(.+)$/gm;
  for (const match of documentText.matchAll(pattern)) {
    const level = match[1]?.length ?? 0;
    if (requestedLevel && level !== requestedLevel) continue;
    const title = normalizeComparableText(match[2] ?? "");
    if (title !== expected) continue;
    const from = match.index ?? 0;
    const to = from + (match[0]?.length ?? 0);
    return position === "before" ? from : to;
  }
  return null;
}

function normalizeAnchorPosition(value: unknown): "before" | "after" {
  return stringValue(value) === "before" ? "before" : "after";
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function positiveInteger(value: unknown): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : 0;
  return Number.isInteger(number) && number > 0 ? number : 0;
}

function normalizeComparableText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
