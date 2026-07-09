import type { SheetVersion, WritingSheet } from "../types";
import { formatSnapshotTime } from "./formatters";
import { countWords } from "./text";

export function createSheetVersionSnapshot(sheet: WritingSheet, source: SheetVersion["source"], reason: string): SheetVersion {
  const now = new Date();
  const sourceLabel = source === "ai" ? "AI 修改前" : source === "restore" ? "恢复前" : source === "auto" ? "自动" : "";
  return {
    id: `version-${now.getTime()}-${Math.random().toString(36).slice(2)}`,
    title: [sheet.title, sourceLabel, formatSnapshotTime(now.toISOString())].filter(Boolean).join(" · "),
    body: sheet.body,
    createdAt: now.toISOString(),
    wordCount: countWords(sheet.body),
    source,
    reason,
  };
}
