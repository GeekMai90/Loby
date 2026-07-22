/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供 SheetHeading、getSheetHeadings
 * [POS]: 编辑器 feature 的领域模型边界，集中 编辑器 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export interface SheetHeading {
  id: string;
  level: number;
  text: string;
  line: number;
}

export function getSheetHeadings(markdownSource: string): SheetHeading[] {
  return markdownSource
    .split("\n")
    .map((line, index) => {
      const match = /^(#{1,4})\s+(.+?)\s*$/.exec(line);
      if (!match) return null;
      return {
        id: `${index + 1}-${match[2]}`,
        level: match[1].length,
        text: match[2].replace(/\s+#+$/, "").trim(),
        line: index + 1,
      };
    })
    .filter((heading): heading is SheetHeading => heading !== null);
}
