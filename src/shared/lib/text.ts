/**
 * [INPUT]: 依赖 shared/types 的 WritingProject、WritingSheet 与纯文本输入
 * [OUTPUT]: 对外提供 countWords、按 WritingSheet 引用复用的 sheetWordCount、项目/文稿进度、阅读统计与 slugifyTitle
 * [POS]: shared 层的跨功能文本统计边界；原始字符串保持单遍扫描，同一不可变文稿 revision 的多消费方共享一次字数物化
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { WritingProject, WritingSheet } from "@/shared/types";

const sheetWordCountCache = new WeakMap<WritingSheet, number>();

export function countWords(text: string): number {
  let count = 0;
  let index = 0;

  while (index < text.length) {
    const code = text.charCodeAt(index);
    if (code >= 0x4e00 && code <= 0x9fff) {
      count += 1;
      index += 1;
      continue;
    }
    if (!isAsciiAlphanumeric(code)) {
      index += 1;
      continue;
    }

    count += 1;
    index += 1;
    while (index < text.length) {
      const current = text.charCodeAt(index);
      if (isAsciiAlphanumeric(current)) {
        index += 1;
        continue;
      }
      const next = index + 1 < text.length ? text.charCodeAt(index + 1) : -1;
      if ((current === 0x2d || current === 0x27) && isAsciiAlphanumeric(next)) {
        index += 2;
        continue;
      }
      break;
    }
  }

  return count;
}

export function sheetWordCount(sheet: WritingSheet): number {
  const cached = sheetWordCountCache.get(sheet);
  if (cached !== undefined) return cached;
  const value = countWords(sheet.body);
  sheetWordCountCache.set(sheet, value);
  return value;
}

function isAsciiAlphanumeric(code: number): boolean {
  return (code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a);
}

export function projectWordCount(project: WritingProject): number {
  return project.sheets.reduce((sum, sheet) => sum + sheetWordCount(sheet), 0);
}

export function sheetProgress(sheet: WritingSheet): number {
  if (sheet.targetWords <= 0) return 0;
  return Math.min(100, Math.round((sheetWordCount(sheet) / sheet.targetWords) * 100));
}

export function sheetStats(sheet: WritingSheet): {
  characters: number;
  paragraphs: number;
  headings: number;
  readingMinutes: number;
} {
  const body = sheet.body;
  const words = sheetWordCount(sheet);
  const characters = body.replace(/\s/g, "").length;
  const paragraphs = body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean).length;
  const headings = body.split("\n").filter((line) => /^#{1,4}\s+/.test(line)).length;
  return {
    characters,
    paragraphs,
    headings,
    readingMinutes: Math.max(1, Math.ceil(words / 500)),
  };
}

export function slugifyTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
