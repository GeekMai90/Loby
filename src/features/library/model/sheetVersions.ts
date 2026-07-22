/**
 * [INPUT]: 依赖 shared 公共契约
 * [OUTPUT]: 对外提供 createSheetVersionSnapshot、restoreSheetVersion
 * [POS]: 写作库 feature 的领域模型边界，集中 写作库 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { SheetVersion, WritingSheet } from "@/shared/types";
import { formatSnapshotTime } from "@/shared/lib/formatters";
import { extractFirstHeadingTitle } from "@/shared/lib/markdownTitle";
import { countWords } from "@/shared/lib/text";

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

export function restoreSheetVersion(sheet: WritingSheet, version: SheetVersion): WritingSheet {
  const currentVersionBackup = createSheetVersionSnapshot(sheet, "restore", "恢复前自动备份当前版本");

  return {
    ...sheet,
    versions: [currentVersionBackup, ...(sheet.versions ?? [])].slice(0, 20),
    body: version.body,
    title: extractFirstHeadingTitle(version.body) || sheet.title,
  };
}
