import type { WritingSheet } from "../types";
import { collectMarkdownParagraphBlocks } from "./aiInsertionTarget";
import { getSheetHeadings } from "./markdownOutline";
import { countWords, sheetStats } from "./text";

const DEFAULT_MAX_HEADINGS = 16;
const DEFAULT_MAX_PARAGRAPH_ANCHORS = 12;

export function buildLobyDocumentOutlineContext(
  sheet: WritingSheet,
  selectedText: string,
  options: { maxHeadings?: number; maxParagraphAnchors?: number; includeParagraphAnchors?: boolean } = {},
): string {
  const stats = sheetStats(sheet);
  const headings = getSheetHeadings(sheet.body);
  const maxHeadings = Math.max(1, options.maxHeadings ?? DEFAULT_MAX_HEADINGS);
  const visibleHeadings = headings.slice(0, maxHeadings);
  const omittedHeadings = Math.max(0, headings.length - visibleHeadings.length);
  const includeParagraphAnchors = options.includeParagraphAnchors ?? true;
  const paragraphAnchors = includeParagraphAnchors ? collectMarkdownParagraphBlocks(sheet.body) : [];
  const maxParagraphAnchors = Math.max(1, options.maxParagraphAnchors ?? DEFAULT_MAX_PARAGRAPH_ANCHORS);
  const visibleParagraphAnchors = paragraphAnchors.slice(0, maxParagraphAnchors);
  const omittedParagraphAnchors = Math.max(0, paragraphAnchors.length - visibleParagraphAnchors.length);
  const selectedWords = countWords(selectedText);

  return [
    "### 当前文稿轮廓",
    `统计：${countWords(sheet.body)} 字，${stats.characters} 字符，${stats.paragraphs} 段，${stats.headings} 个标题，预计阅读 ${stats.readingMinutes} 分钟`,
    selectedText.trim() ? `当前选区：${selectedWords} 字` : "当前选区：无",
    "Markdown 标题：",
    visibleHeadings.length > 0 ? visibleHeadings.map(formatHeading).join("\n") : "- 当前文稿还没有 Markdown 标题。",
    omittedHeadings > 0 ? `- 另有 ${omittedHeadings} 个标题未列出` : "",
    includeParagraphAnchors
      ? [
          "",
          "正文段落锚点（只统计正文段落，不含标题、图片、列表、引用、表格、代码块）：",
          visibleParagraphAnchors.length > 0
            ? visibleParagraphAnchors.map(formatParagraphAnchor).join("\n")
            : "- 当前文稿还没有可定位的正文段落。",
          omittedParagraphAnchors > 0 ? `- 另有 ${omittedParagraphAnchors} 个正文段落未列出` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "",
    "",
    "轮廓使用规则：",
    "- 结构诊断、标题建议和发布检查可以先参考这个轮廓；需要逐段精修时，应要求挂载当前文稿或使用当前选区。",
    '- 用户说“第 N 段之后/之前”时，必须使用 `anchor: { "type": "paragraphFromStart", "index": N, "position": "after/before", "text": "该段摘录" }`。',
    "- 用户说“倒数第 N 段之后/之前”时，必须使用 `paragraphFromEnd`，同样带上 `text` 摘录用于校验。",
    "- 不要根据轮廓臆造正文细节；没有全文时，只能做结构级判断。",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatHeading(heading: ReturnType<typeof getSheetHeadings>[number]): string {
  const indent = "  ".repeat(Math.max(0, heading.level - 1));
  return `${indent}- H${heading.level} L${heading.line}: ${heading.text}`;
}

function formatParagraphAnchor(paragraph: ReturnType<typeof collectMarkdownParagraphBlocks>[number]): string {
  return `- 第 ${paragraph.indexFromStart} 段 / 倒数第 ${paragraph.indexFromEnd} 段：${previewParagraph(paragraph.text)}`;
}

function previewParagraph(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 56 ? `${compact.slice(0, 55)}...` : compact;
}
