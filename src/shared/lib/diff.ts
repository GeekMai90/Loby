/**
 * [INPUT]: 依赖 diff 的 Myers 字符差异算法与 shared 公共契约
 * [OUTPUT]: 对外提供 buildLineDiff、buildTextDiffParts、TextDiffPart
 * [POS]: shared 层的跨功能纯工具或平台适配，不依赖 app 与具体 feature
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { diffChars } from "diff";
import type { DiffLine } from "@/shared/types";

export type TextDiffPart = { kind: "same" | "added" | "removed"; text: string };

const MAX_TEXT_DIFF_EDIT_LENGTH = 4096;

export function buildTextDiffParts(source: string, result: string): TextDiffPart[] {
  if (!source && !result) return [];
  if (!source) return [{ kind: "added", text: result }];
  if (!result) return [{ kind: "removed", text: source }];

  const changes = diffChars(source, result, { maxEditLength: MAX_TEXT_DIFF_EDIT_LENGTH });
  if (!changes) {
    return [
      { kind: "removed", text: source },
      { kind: "added", text: result },
    ];
  }

  return changes.map((change) => ({
    kind: change.added ? "added" : change.removed ? "removed" : "same",
    text: change.value,
  }));
}

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
