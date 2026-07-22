/**
 * [INPUT]: 依赖 unified、remark-gfm、remark-parse、shared 公共契约
 * [OUTPUT]: 对外提供 formatMarkdownDocument
 * [POS]: 编辑器 feature 的领域模型边界，集中 编辑器 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import type { MarkdownFormattingSettings } from "@/shared/types";

interface MarkdownPosition {
  start: { offset?: number };
  end: { offset?: number };
}

interface MarkdownNode {
  type: string;
  position?: MarkdownPosition;
  children?: MarkdownNode[];
}

interface TextRange {
  start: number;
  end: number;
}

interface MarkdownParts {
  frontmatter: string;
  separator: string;
  body: string;
}

const PROTECTED_MARKDOWN_NODE_TYPES = new Set(["code", "inlineCode", "html", "definition", "linkReference", "imageReference"]);
const HAN = "\\p{Script=Han}";
const PUNCTUATION_MAP: Record<string, string> = {
  ",": "，",
  ";": "；",
  ":": "：",
  "?": "？",
  "!": "！",
};

export function formatMarkdownDocument(source: string, settings: MarkdownFormattingSettings): string {
  if (!Object.values(settings).some(Boolean)) return source;
  const normalizeOuterWhitespace = settings.cleanupWhitespace || settings.normalizeBlockSpacing;
  const normalizedSource = normalizeOuterWhitespace ? source.replace(/\r\n?/g, "\n") : source;
  const { frontmatter, separator, body: sourceBody } = splitFrontmatter(normalizedSource);
  let body = sourceBody;

  if (settings.cleanupWhitespace) body = cleanupWhitespace(body);
  if (settings.normalizeMarkdownMarkers) body = normalizeMarkdownMarkers(body);
  if (settings.spaceCjkAndLatin) body = addCjkLatinSpacing(body);
  if (settings.fullWidthPunctuation) body = convertChinesePunctuation(body);
  if (settings.normalizeBlockSpacing) body = normalizeBlockSpacing(body);

  if (!normalizeOuterWhitespace) return `${frontmatter}${separator}${body}`;

  body = body.replace(/^\n+|\n+$/g, "");
  if (!frontmatter && !body) return "";
  if (!frontmatter) return `${body}\n`;
  return body ? `${frontmatter}\n\n${body}\n` : `${frontmatter}\n`;
}

function parseMarkdown(markdown: string): MarkdownNode {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown) as MarkdownNode;
}

function splitFrontmatter(source: string): MarkdownParts {
  const lines = source.split("\n");
  const opening = lines[0]?.replace(/^\uFEFF/, "").trim();
  if (opening !== "---" && opening !== "+++") return { frontmatter: "", separator: "", body: source };
  const validClosings = opening === "---" ? new Set(["---", "..."]) : new Set(["+++"]);
  const closingIndex = lines.findIndex((line, index) => index > 0 && validClosings.has(line.trim()));
  if (closingIndex < 0) return { frontmatter: "", separator: "", body: source };
  const frontmatterEnd = lines.slice(0, closingIndex + 1).reduce((length, line) => length + line.length, closingIndex);
  const remainder = source.slice(frontmatterEnd);
  const separator = remainder.match(/^\n*/)?.[0] ?? "";
  return {
    frontmatter: source.slice(0, frontmatterEnd),
    separator,
    body: remainder.slice(separator.length),
  };
}

function cleanupWhitespace(markdown: string): string {
  const ranges = collectProtectedRanges(markdown);
  const lines = markdown.split("\n");
  let lineStart = 0;
  const cleaned = lines.map((line, lineIndex) => {
    const currentLineStart = lineStart;
    lineStart += line.length + 1;
    const protectedMask = createLineProtectionMask(line, currentLineStart, ranges);
    const leadingLength = line.match(/^[ \t]*/)?.[0].length ?? 0;
    let result = line.slice(0, leadingLength);
    let index = leadingLength;
    while (index < line.length) {
      if (protectedMask[index]) {
        result += line[index];
        index += 1;
        continue;
      }
      if (line[index] === " " || line[index] === "\t") {
        let end = index + 1;
        while (end < line.length && !protectedMask[end] && (line[end] === " " || line[end] === "\t")) end += 1;
        if (end < line.length) result += " ";
        index = end;
        continue;
      }
      result += line[index];
      index += 1;
    }
    const originalTrailing = line.match(/[ \t]+$/)?.[0] ?? "";
    const trailingStart = line.length - originalTrailing.length;
    const trailingWhitespaceProtected = originalTrailing.length > 0 && protectedMask[trailingStart];
    const continuesParagraph = Boolean(lines[lineIndex + 1]?.trim());
    if (!trailingWhitespaceProtected && originalTrailing.length >= 2 && continuesParagraph && result && !result.endsWith("  ")) {
      result = `${result.replace(/[ \t]+$/, "")}  `;
    }
    return result;
  });
  return cleaned.join("\n");
}

function normalizeMarkdownMarkers(markdown: string): string {
  const ranges = collectProtectedRanges(markdown);
  let lineStart = 0;
  return markdown
    .split("\n")
    .map((line) => {
      const firstContentIndex = line.search(/\S/);
      const absoluteContentIndex = firstContentIndex < 0 ? -1 : lineStart + firstContentIndex;
      lineStart += line.length + 1;
      if (firstContentIndex < 0 || isProtectedOffset(absoluteContentIndex, ranges)) return line;

      const indent = line.slice(0, firstContentIndex);
      const content = line.slice(firstContentIndex);
      const heading = content.match(/^(#{1,6})(?!#)[ \t]*(.*)$/);
      if (heading) return `${indent}${heading[1]}${heading[2] ? ` ${heading[2]}` : ""}`;

      const quote = content.match(/^(>(?:[ \t]*>)*)(?:[ \t]*)(.*)$/);
      if (quote) {
        const level = (quote[1].match(/>/g) ?? []).length;
        return `${indent}${"> ".repeat(level)}${quote[2]}`.trimEnd();
      }

      const listItem = content.match(/^([*+-]|\d+[.)])[ \t]*(.*)$/);
      if (!listItem || isThematicBreak(content)) return line;
      const marker = /^[*+-]$/.test(listItem[1]) ? "-" : listItem[1];
      const task = listItem[2].match(/^\[([ xX])\][ \t]*(.*)$/);
      if (task) return `${indent}${marker} [${task[1].toLowerCase()}]${task[2] ? ` ${task[2]}` : ""}`;
      return `${indent}${marker}${listItem[2] ? ` ${listItem[2]}` : ""}`;
    })
    .join("\n");
}

function isThematicBreak(content: string): boolean {
  return /^(?:\*[ \t]*){3,}$/.test(content) || /^(?:-[ \t]*){3,}$/.test(content) || /^(?:_[ \t]*){3,}$/.test(content);
}

function addCjkLatinSpacing(markdown: string): string {
  return transformUnprotected(markdown, (text) =>
    text
      .replace(new RegExp(`(${HAN})[ \\t]*([A-Za-z0-9])`, "gu"), "$1 $2")
      .replace(new RegExp(`([A-Za-z0-9])[ \\t]*(${HAN})`, "gu"), "$1 $2"),
  );
}

function convertChinesePunctuation(markdown: string): string {
  return transformUnprotected(markdown, (text) => {
    let result = text.replace(new RegExp(`(${HAN})([,;:?!])|([,;:?!])(${HAN})`, "gu"), (match, leftHan, afterHan, beforeHan, rightHan) => {
      const punctuation = afterHan || beforeHan;
      return leftHan ? `${leftHan}${PUNCTUATION_MAP[punctuation]}` : `${PUNCTUATION_MAP[punctuation]}${rightHan}`;
    });
    result = result.replace(new RegExp(`(${HAN})\\.(?=$|[ \\t\\n]|${HAN})`, "gu"), "$1。");
    result = result.replace(new RegExp(`\\.(${HAN})`, "gu"), "。$1");
    result = result.replace(new RegExp(`\\(([^()\\n]*${HAN}[^()\\n]*)\\)`, "gu"), "（$1）");
    return result
      .replace(/[ \t]+([，。！？；：）】》」』])/g, "$1")
      .replace(/([（【《「『])[ \t]+/g, "$1")
      .replace(new RegExp(`([，。！？；：])[ \\t]+(?=${HAN})`, "gu"), "$1");
  });
}

function normalizeBlockSpacing(markdown: string): string {
  const root = parseMarkdown(markdown);
  const children = root.children ?? [];
  if (children.length === 0) return markdown.trim();
  const blocks: string[] = [];
  for (const child of children) {
    const start = child.position?.start.offset;
    const end = child.position?.end.offset;
    if (typeof start !== "number" || typeof end !== "number") return markdown.trim();
    blocks.push(markdown.slice(start, end).replace(/^\n+|\n+$/g, ""));
  }
  return blocks.filter(Boolean).join("\n\n");
}

function transformUnprotected(markdown: string, transform: (text: string) => string): string {
  const ranges = collectProtectedRanges(markdown);
  if (ranges.length === 0) return transform(markdown);
  const chunks: string[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) chunks.push(transform(markdown.slice(cursor, range.start)));
    chunks.push(markdown.slice(range.start, range.end));
    cursor = range.end;
  }
  if (cursor < markdown.length) chunks.push(transform(markdown.slice(cursor)));
  return chunks.join("");
}

function collectProtectedRanges(markdown: string): TextRange[] {
  const ranges: TextRange[] = [];
  const root = parseMarkdown(markdown);
  walkMarkdown(root, (node) => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (typeof start !== "number" || typeof end !== "number") return;
    if (node.type === "link" || node.type === "image") {
      ranges.push(resolveInlineLinkDestinationRange(markdown, start, end) ?? { start, end });
      return;
    }
    if (PROTECTED_MARKDOWN_NODE_TYPES.has(node.type)) ranges.push({ start, end });
  });
  addPatternRanges(markdown, ranges, /(?:https?:\/\/|www\.)[^\s<>"']+/gi);
  addPatternRanges(markdown, ranges, /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g);
  addPatternRanges(markdown, ranges, /(?:^|(?<=\s))(?:\/[^\s]+|[A-Za-z]:\\[^\s]+)/gm, true);
  addPatternRanges(markdown, ranges, /[\p{L}\p{N}_-]+\.[A-Za-z0-9]{1,8}\b/gu);
  addPatternRanges(markdown, ranges, /\bv?\d+(?:\.\d+){1,}\b/gi);
  addPatternRanges(markdown, ranges, /\b\d{4}-\d{1,2}-\d{1,2}\b/g);
  return mergeRanges(ranges);
}

function resolveInlineLinkDestinationRange(markdown: string, start: number, end: number): TextRange | null {
  const source = markdown.slice(start, end);
  const destinationStart = source.lastIndexOf("](");
  if (destinationStart < 0 || !source.endsWith(")")) return null;
  return { start: start + destinationStart + 1, end };
}

function walkMarkdown(node: MarkdownNode, visit: (node: MarkdownNode) => void) {
  visit(node);
  node.children?.forEach((child) => walkMarkdown(child, visit));
}

function addPatternRanges(markdown: string, ranges: TextRange[], pattern: RegExp, trimLeadingWhitespace = false) {
  for (const match of markdown.matchAll(pattern)) {
    if (typeof match.index !== "number") continue;
    const leadingWhitespace = trimLeadingWhitespace ? (match[0].match(/^\s*/)?.[0].length ?? 0) : 0;
    ranges.push({ start: match.index + leadingWhitespace, end: match.index + match[0].length });
  }
}

function mergeRanges(ranges: TextRange[]): TextRange[] {
  const sorted = ranges.filter((range) => range.end > range.start).sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: TextRange[] = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (!previous || range.start > previous.end) merged.push({ ...range });
    else previous.end = Math.max(previous.end, range.end);
  }
  return merged;
}

function isProtectedOffset(offset: number, ranges: TextRange[]): boolean {
  return ranges.some((range) => offset >= range.start && offset < range.end);
}

function createLineProtectionMask(line: string, lineStart: number, ranges: TextRange[]): boolean[] {
  const mask = Array.from({ length: line.length }, () => false);
  const lineEnd = lineStart + line.length;
  for (const range of ranges) {
    if (range.end <= lineStart || range.start >= lineEnd) continue;
    const start = Math.max(0, range.start - lineStart);
    const end = Math.min(line.length, range.end - lineStart);
    for (let index = start; index < end; index += 1) mask[index] = true;
  }
  return mask;
}
