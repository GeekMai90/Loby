/**
 * [INPUT]: 依赖 shared 公共契约
 * [OUTPUT]: 对外提供保护性快照、手动保存基线/变更判定/版本生成、历史版本恢复能力
 * [POS]: 写作库 feature 的历史版本领域边界，集中版本标题、正文或排版变化判定、去重基线、数量上限与恢复规则
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { SheetVersion, WritingSheet } from "@/shared/types";
import { formatSnapshotTime } from "@/shared/lib/formatters";
import { extractFirstHeadingTitle } from "@/shared/lib/markdownTitle";
import { countWords } from "@/shared/lib/text";

export const MANUAL_SAVE_VERSION_REASON = "手动保存";

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

export function resolveManualSaveBaseline(sheet: WritingSheet): string {
  return (
    sheet.versions?.find((version) => version.source === "manual" && version.reason === MANUAL_SAVE_VERSION_REASON)?.body ?? sheet.body
  );
}

export function manualSaveNeedsVersion(baselineBody: string, currentBody: string, savedBody: string): boolean {
  return currentBody !== baselineBody || savedBody !== currentBody;
}

export function createManualSaveVersion(sheet: WritingSheet, body: string, updatedAt: string): WritingSheet {
  const savedSheet: WritingSheet = {
    ...sheet,
    title: extractFirstHeadingTitle(body) || sheet.title,
    body,
    updatedAt,
  };
  return {
    ...savedSheet,
    versions: [createSheetVersionSnapshot(savedSheet, "manual", MANUAL_SAVE_VERSION_REASON), ...(sheet.versions ?? [])].slice(0, 20),
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
