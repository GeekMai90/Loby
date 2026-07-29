/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供带源码位置的 SheetHeading、单遍扫描 getSheetHeadings
 * [POS]: 编辑器大纲的线性解析边界，在一次正文遍历中同时生成标题、行号与跳转位置
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export interface SheetHeading {
  id: string;
  level: number;
  text: string;
  line: number;
  position: number;
}

export function getSheetHeadings(markdownSource: string): SheetHeading[] {
  const headings: SheetHeading[] = [];
  let lineNumber = 1;
  let lineStart = 0;

  while (lineStart <= markdownSource.length) {
    const newline = markdownSource.indexOf("\n", lineStart);
    const lineEnd = newline === -1 ? markdownSource.length : newline;
    const line = markdownSource.slice(lineStart, lineEnd);
    const match = /^(#{1,4})\s+(.+?)\s*$/.exec(line);
    if (match) {
      headings.push({
        id: `${lineNumber}-${match[2]}`,
        level: match[1].length,
        text: match[2].replace(/\s+#+$/, "").trim(),
        line: lineNumber,
        position: lineStart,
      });
    }
    if (newline === -1) break;
    lineStart = newline + 1;
    lineNumber += 1;
  }

  return headings;
}
