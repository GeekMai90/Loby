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
      const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
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
