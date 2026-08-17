/**
 * [INPUT]: 依赖 Markdown 源文本、受保护源码区间与调用方指定的中文粗体关闭边界占位
 * [OUTPUT]: 对外提供 normalizeCjkStrongEmphasis；按行识别独立 `**` delimiter，以左右侧边界和非交叉配对修复内侧空白及中文标点关闭边界
 * [POS]: shared/lib 的 Markdown 行内兼容规则，被编辑器格式化与两条公众号渲染路径共同消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export interface MarkdownSourceRange {
  start: number;
  end: number;
}

interface StrongDelimiter {
  start: number;
  contentStart: number;
  contentEnd: number;
  canOpen: boolean;
  canClose: boolean;
  needsPortableBoundary: boolean;
}

interface StrongPair {
  opening: StrongDelimiter;
  closing: StrongDelimiter;
}

interface PairSelection {
  pairs: StrongPair[];
  spanLength: number;
}

interface SourceEdit {
  start: number;
  end: number;
  replacement: string;
}

interface NormalizeCjkStrongEmphasisOptions {
  protectedRanges?: readonly MarkdownSourceRange[];
  boundarySuffix?: string;
}

const INLINE_MARKER_SPACING_PATTERN = /[\t \u00a0\u1680\u2000-\u200b\u202f\u205f\u3000\ufeff]/u;
const MARKDOWN_WHITESPACE_PATTERN = /\s/u;
const PUNCTUATION_OR_SYMBOL_PATTERN = /[\p{P}\p{S}]/u;
const CJK_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

export function normalizeCjkStrongEmphasis(
  source: string,
  { protectedRanges = [], boundarySuffix = " " }: NormalizeCjkStrongEmphasisOptions = {},
): string {
  const edits: SourceEdit[] = [];
  let lineStart = 0;

  for (const line of source.split("\n")) {
    const lineEnd = lineStart + line.length;
    const delimiters = collectStrongDelimiters(source, lineStart, lineEnd, protectedRanges);
    for (const { opening, closing } of selectStrongPairs(delimiters)) {
      const hasInnerSpacing = opening.contentStart > opening.start + 2 || closing.contentEnd < closing.start;
      const containsWrittenLanguage = /\p{L}/u.test(source.slice(opening.contentStart, closing.contentEnd));
      if (hasInnerSpacing && !containsWrittenLanguage) continue;
      if (opening.contentStart > opening.start + 2) {
        edits.push({ start: opening.start + 2, end: opening.contentStart, replacement: "" });
      }
      if (closing.contentEnd < closing.start) {
        edits.push({ start: closing.contentEnd, end: closing.start, replacement: "" });
      }
      if (closing.needsPortableBoundary && boundarySuffix) {
        edits.push({ start: closing.start + 2, end: closing.start + 2, replacement: boundarySuffix });
      }
    }
    lineStart = lineEnd + 1;
  }

  return applySourceEdits(source, edits);
}

function collectStrongDelimiters(
  source: string,
  lineStart: number,
  lineEnd: number,
  protectedRanges: readonly MarkdownSourceRange[],
): StrongDelimiter[] {
  const delimiters: StrongDelimiter[] = [];
  for (let start = lineStart; start + 1 < lineEnd; start += 1) {
    if (source[start] !== "*" || source[start + 1] !== "*") continue;
    if (source[start - 1] === "*" || source[start + 2] === "*") continue;
    if (isEscapedAsterisk(source, start) || isProtectedOffset(start, protectedRanges) || isProtectedOffset(start + 1, protectedRanges)) {
      start += 1;
      continue;
    }

    const contentStart = skipInlineMarkerSpacingForward(source, start + 2, lineEnd);
    const contentEnd = skipInlineMarkerSpacingBackward(source, start, lineStart);
    const beforeOpening = source[start - 1] ?? "";
    const afterOpening = source[contentStart] ?? "";
    const beforeClosing = source[contentEnd - 1] ?? "";
    const afterClosing = source[start + 2] ?? "";
    const nextVisible = source[skipInlineMarkerSpacingForward(source, start + 2, lineEnd)] ?? "";
    const needsPortableBoundary =
      isStrongBoundaryPunctuation(beforeClosing) && CJK_PATTERN.test(nextVisible) && !MARKDOWN_WHITESPACE_PATTERN.test(afterClosing);

    delimiters.push({
      start,
      contentStart,
      contentEnd,
      canOpen: isLeftFlanking(beforeOpening, afterOpening),
      canClose: isRightFlanking(beforeClosing, afterClosing) || needsPortableBoundary,
      needsPortableBoundary,
    });
    start += 1;
  }
  return delimiters;
}

function selectStrongPairs(delimiters: StrongDelimiter[]): StrongPair[] {
  const selections: PairSelection[] = Array.from({ length: delimiters.length + 1 }, () => ({ pairs: [], spanLength: 0 }));
  for (let index = delimiters.length - 1; index >= 0; index -= 1) {
    const skipped = selections[index + 1];
    const opening = delimiters[index];
    const closing = delimiters[index + 1];
    if (!opening.canOpen || !closing?.canClose || closing.contentEnd <= opening.contentStart) {
      selections[index] = skipped;
      continue;
    }

    const tail = selections[index + 2];
    const paired: PairSelection = {
      pairs: [{ opening, closing }, ...tail.pairs],
      spanLength: closing.start - opening.start + tail.spanLength,
    };
    selections[index] = preferPairSelection(paired, skipped);
  }
  return selections[0]?.pairs ?? [];
}

function preferPairSelection(left: PairSelection, right: PairSelection): PairSelection {
  if (left.pairs.length !== right.pairs.length) return left.pairs.length > right.pairs.length ? left : right;
  return left.spanLength <= right.spanLength ? left : right;
}

function isLeftFlanking(before: string, after: string): boolean {
  const spaceBefore = !before || MARKDOWN_WHITESPACE_PATTERN.test(before);
  const spaceAfter = !after || MARKDOWN_WHITESPACE_PATTERN.test(after);
  const punctuationBefore = PUNCTUATION_OR_SYMBOL_PATTERN.test(before);
  const punctuationAfter = PUNCTUATION_OR_SYMBOL_PATTERN.test(after);
  return !spaceAfter && (!punctuationAfter || spaceBefore || punctuationBefore);
}

function isRightFlanking(before: string, after: string): boolean {
  const spaceBefore = !before || MARKDOWN_WHITESPACE_PATTERN.test(before);
  const spaceAfter = !after || MARKDOWN_WHITESPACE_PATTERN.test(after);
  const punctuationBefore = PUNCTUATION_OR_SYMBOL_PATTERN.test(before);
  const punctuationAfter = PUNCTUATION_OR_SYMBOL_PATTERN.test(after);
  return !spaceBefore && (!punctuationBefore || spaceAfter || punctuationAfter);
}

function isStrongBoundaryPunctuation(value: string): boolean {
  return value !== "~" && PUNCTUATION_OR_SYMBOL_PATTERN.test(value);
}

function skipInlineMarkerSpacingForward(source: string, start: number, end: number): number {
  let cursor = start;
  while (cursor < end && INLINE_MARKER_SPACING_PATTERN.test(source[cursor])) cursor += 1;
  return cursor;
}

function skipInlineMarkerSpacingBackward(source: string, start: number, boundary: number): number {
  let cursor = start;
  while (cursor > boundary && INLINE_MARKER_SPACING_PATTERN.test(source[cursor - 1])) cursor -= 1;
  return cursor;
}

function isEscapedAsterisk(source: string, offset: number): boolean {
  let backslashes = 0;
  for (let index = offset - 1; index >= 0 && source[index] === "\\"; index -= 1) backslashes += 1;
  return backslashes % 2 === 1;
}

function isProtectedOffset(offset: number, ranges: readonly MarkdownSourceRange[]): boolean {
  return ranges.some((range) => offset >= range.start && offset < range.end);
}

function applySourceEdits(source: string, edits: SourceEdit[]): string {
  const sorted = [...edits].sort((left, right) => right.start - left.start || right.end - left.end);
  let result = source;
  for (const edit of sorted) result = `${result.slice(0, edit.start)}${edit.replacement}${result.slice(edit.end)}`;
  return result;
}
