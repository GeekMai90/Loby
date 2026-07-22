/**
 * [INPUT]: 依赖 shared 公共契约
 * [OUTPUT]: 对外提供 countWords、projectWordCount、sheetProgress、projectProgress、sheetStats、slugifyTitle
 * [POS]: shared 层的跨功能纯工具或平台适配，不依赖 app 与具体 feature
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { WritingProject, WritingSheet } from "@/shared/types";

export function countWords(text: string): number {
  const chineseChars = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const latinWords = text.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)?.length ?? 0;
  return chineseChars + latinWords;
}

export function projectWordCount(project: WritingProject): number {
  return project.sheets.reduce((sum, sheet) => sum + countWords(sheet.body), 0);
}

export function sheetProgress(sheet: WritingSheet): number {
  if (sheet.targetWords <= 0) return 0;
  return Math.min(100, Math.round((countWords(sheet.body) / sheet.targetWords) * 100));
}

export function projectProgress(project: WritingProject): number {
  if (project.targetWords <= 0) return 0;
  return Math.min(100, Math.round((projectWordCount(project) / project.targetWords) * 100));
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
