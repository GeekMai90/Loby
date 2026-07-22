/**
 * [INPUT]: 依赖 Tauri API、shared 公共契约、写作库模块
 * [OUTPUT]: 对外提供 SearchResultItem、buildDocumentImageItems、buildSearchResults、positionFromLine
 * [POS]: 编辑器 feature 的领域模型边界，集中 编辑器 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { convertFileSrc } from "@tauri-apps/api/core";
import type { WritingProject, WritingSheet } from "@/shared/types";
import { getBasename, parseImageReferences, resolveSheetImageSourcePath, stripExtension } from "@/features/library/model/imageAssets";

export interface SearchResultItem {
  id: string;
  index: number;
  line: number;
  before: string;
  match: string;
  after: string;
}

export function buildDocumentImageItems(libraryPath: string, project: WritingProject, sheet: WritingSheet) {
  return parseImageReferences(sheet.body).map((reference) => {
    const sourcePath = libraryPath.startsWith("/") ? resolveSheetImageSourcePath(libraryPath, project, sheet, reference.path) : "";
    return {
      ...reference,
      label: reference.alt || stripExtension(getBasename(reference.path)) || "图片",
      src: sourcePath ? convertFileSrc(sourcePath) : externalImageUrl(reference.path),
    };
  });
}

export function buildSearchResults(body: string, query: string): SearchResultItem[] {
  if (!query) return [];
  const results: SearchResultItem[] = [];
  const lines = body.split("\n");
  let offset = 0;

  lines.forEach((line, lineIndex) => {
    let searchFrom = 0;
    while (searchFrom <= line.length) {
      const matchIndex = line.indexOf(query, searchFrom);
      if (matchIndex === -1) break;
      const absoluteIndex = offset + matchIndex;
      const beforeStart = Math.max(0, matchIndex - 18);
      const afterEnd = Math.min(line.length, matchIndex + query.length + 32);
      results.push({
        id: `${absoluteIndex}-${lineIndex}`,
        index: absoluteIndex,
        line: lineIndex + 1,
        before: `${beforeStart > 0 ? "..." : ""}${line.slice(beforeStart, matchIndex)}`,
        match: line.slice(matchIndex, matchIndex + query.length),
        after: `${line.slice(matchIndex + query.length, afterEnd)}${afterEnd < line.length ? "..." : ""}`,
      });
      searchFrom = matchIndex + Math.max(query.length, 1);
    }
    offset += line.length + 1;
  });

  return results;
}

export function positionFromLine(body: string, lineNumber: number) {
  if (lineNumber <= 1) return 0;
  const lines = body.split("\n");
  let position = 0;
  for (let index = 0; index < Math.min(lineNumber - 1, lines.length); index += 1) {
    position += lines[index].length + 1;
  }
  return Math.min(position, body.length);
}

function externalImageUrl(path: string) {
  return /^https?:\/\//i.test(path) ? path : "";
}
