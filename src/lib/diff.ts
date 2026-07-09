import type { DiffLine } from "../types";

export function buildLineDiff(source: string, result: string): DiffLine[] {
  const sourceLines = source.split("\n");
  const resultLines = result.split("\n");
  const table = Array.from({ length: sourceLines.length + 1 }, () => Array(resultLines.length + 1).fill(0));

  for (let i = sourceLines.length - 1; i >= 0; i -= 1) {
    for (let j = resultLines.length - 1; j >= 0; j -= 1) {
      table[i][j] = sourceLines[i] === resultLines[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;

  while (i < sourceLines.length && j < resultLines.length) {
    if (sourceLines[i] === resultLines[j]) {
      lines.push({ id: `${lines.length}-same`, kind: "same", text: sourceLines[i] });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      lines.push({ id: `${lines.length}-removed`, kind: "removed", text: sourceLines[i] });
      i += 1;
    } else {
      lines.push({ id: `${lines.length}-added`, kind: "added", text: resultLines[j] });
      j += 1;
    }
  }

  while (i < sourceLines.length) {
    lines.push({ id: `${lines.length}-removed`, kind: "removed", text: sourceLines[i] });
    i += 1;
  }

  while (j < resultLines.length) {
    lines.push({ id: `${lines.length}-added`, kind: "added", text: resultLines[j] });
    j += 1;
  }

  return lines;
}
