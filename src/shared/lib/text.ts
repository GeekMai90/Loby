/**
 * [INPUT]: 依赖 shared/types 的 WritingProject、WritingSheet 与纯文本输入
 * [OUTPUT]: 对外提供 countWords、projectWordCount、sheetProgress、sheetStats、slugifyTitle
 * [POS]: shared 层的跨功能文本统计边界，字数使用单遍匹配且不依赖 app 与具体 feature
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { WritingProject, WritingSheet } from "@/shared/types";

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

function isAsciiAlphanumeric(code: number): boolean {
  return (code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a);
}

export function projectWordCount(project: WritingProject): number {
  return project.sheets.reduce((sum, sheet) => sum + countWords(sheet.body), 0);
}

export function sheetProgress(sheet: WritingSheet): number {
  if (sheet.targetWords <= 0) return 0;
  return Math.min(100, Math.round((countWords(sheet.body) / sheet.targetWords) * 100));
}

export function sheetStats(sheet: WritingSheet): {
  characters: number;
  paragraphs: number;
  headings: number;
  readingMinutes: number;
} {
  const body = sheet.body;
  const words = countWords(body);
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
