/**
 * [INPUT]: 依赖 shared 公共契约、写作库模块、编辑器模块
 * [OUTPUT]: 对外提供 buildLobyWritingStructureContext
 * [POS]: AI 助手 feature 的领域模型边界，集中 AI 助手 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { WritingProject, WritingSheet } from "@/shared/types";
import { getSheetsInGroup, getVisibleProjectGroups } from "@/features/library/model/projectModel";
import { countWords, projectProgress, projectWordCount } from "@/shared/lib/text";
import { formatDocumentPropertiesForContext } from "@/features/editor/model/documentProperties";

const DEFAULT_MAX_SHEETS = 18;
const SUMMARY_LIMIT = 80;

export function buildLobyWritingStructureContext(
  project: WritingProject,
  currentSheet: WritingSheet,
  options: { maxSheets?: number } = {},
): string {
  const maxSheets = Math.max(1, options.maxSheets ?? DEFAULT_MAX_SHEETS);
  const totalWords = projectWordCount(project);
  const progress = projectProgress(project);
  const currentWords = countWords(currentSheet.body);
  const currentGroup = getVisibleProjectGroups(project).find((group) => group.id === currentSheet.groupId);
  const sections = buildSheetStructureLines(project, currentSheet, maxSheets);

  return [
    "### 当前写作结构",
    `项目进度：${totalWords}${project.targetWords > 0 ? ` / ${project.targetWords}` : ""} 字${project.targetWords > 0 ? `（${progress}%）` : ""}`,
    [
      `当前文稿：${currentSheet.title}`,
      `字数：${currentWords}${currentSheet.targetWords > 0 ? ` / ${currentSheet.targetWords}` : ""}`,
      `分组：${currentGroup?.title ?? "未分组"}`,
    ].join("；"),
    `当前文稿属性：${formatDocumentPropertiesForContext(project, currentSheet).join("；") || "未填写"}`,
    `当前文稿摘要：${trimSummary(currentSheet.summary) || "未填写"}`,
    "",
    "项目分组与文稿：",
    sections.length > 0 ? sections.join("\n") : "- 暂无文稿",
    "",
    "结构使用规则：",
    "- 回答、改写或插入内容时，优先尊重当前文稿在项目结构中的位置。",
    "- 新建文稿时，除非用户另有要求，优先放入当前项目并沿用当前写作语境。",
    "- 如果任务只影响当前文稿，不要假设需要修改其他文稿。",
  ].join("\n");
}

function buildSheetStructureLines(project: WritingProject, currentSheet: WritingSheet, maxSheets: number): string[] {
  const groups = getVisibleProjectGroups(project);
  const currentGroupIds = new Set(groups.map((group) => group.id));
  const ungroupedSheets = project.sheets.filter((sheet) => !sheet.groupId || !currentGroupIds.has(sheet.groupId));
  const lines: string[] = [];
  let remaining = maxSheets;

  for (const group of groups) {
    const sheets = getSheetsInGroup(project, group.id);
    if (sheets.length === 0) continue;
    const groupWords = sheets.reduce((total, sheet) => total + countWords(sheet.body), 0);
    lines.push(`- ${group.title}（${sheets.length} 篇 / ${groupWords} 字）`);
    for (const sheet of sheets.slice(0, remaining)) {
      lines.push(formatSheetLine(sheet, sheet.id === currentSheet.id));
    }
    remaining -= Math.min(remaining, sheets.length);
    if (remaining <= 0) break;
  }

  if (remaining > 0 && ungroupedSheets.length > 0) {
    const groupWords = ungroupedSheets.reduce((total, sheet) => total + countWords(sheet.body), 0);
    lines.push(`- 未分组（${ungroupedSheets.length} 篇 / ${groupWords} 字）`);
    for (const sheet of ungroupedSheets.slice(0, remaining)) {
      lines.push(formatSheetLine(sheet, sheet.id === currentSheet.id));
    }
  }

  const omitted = project.sheets.length - countIncludedSheetLines(lines);
  if (omitted > 0) lines.push(`- 另有 ${omitted} 篇未列出`);
  return lines;
}

function formatSheetLine(sheet: WritingSheet, isCurrent: boolean): string {
  const words = countWords(sheet.body);
  const summary = trimSummary(sheet.summary);
  return `  - ${isCurrent ? "★ " : ""}${sheet.title} · ${words}${sheet.targetWords > 0 ? `/${sheet.targetWords}` : ""} 字${summary ? ` · ${summary}` : ""}`;
}

function trimSummary(summary: string): string {
  const compact = summary.replace(/\s+/g, " ").trim();
  if (compact.length <= SUMMARY_LIMIT) return compact;
  return `${compact.slice(0, SUMMARY_LIMIT)}...`;
}

function countIncludedSheetLines(lines: string[]): number {
  return lines.filter((line) => line.startsWith("  - ")).length;
}
