/**
 * [INPUT]: 依赖 WritingSheet/WritingProject 与由 app 注入的摘要生成器
 * [OUTPUT]: 对外提供单篇与项目级发布前摘要补全，不改变已有摘要
 * [POS]: publishing model 的发布前元信息预检边界，统一服务微信公众号、博客、文档站与墨问发布控制器
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { DocumentSummaryGenerator, WritingProject, WritingSheet } from "@/shared/types";

export async function ensureDocumentSummary(sheet: WritingSheet, generateSummary?: DocumentSummaryGenerator): Promise<WritingSheet> {
  if (sheet.description.trim() || !generateSummary) return sheet;
  const description = (await generateSummary(sheet)).trim();
  if (!description) throw new Error("AI 未生成有效摘要，请重试。");
  return { ...sheet, description };
}

export async function ensureProjectDocumentSummaries(
  project: WritingProject,
  generateSummary: DocumentSummaryGenerator | undefined,
  shouldEnsure: (sheet: WritingSheet) => boolean,
): Promise<WritingProject> {
  if (!generateSummary) return project;

  let changed = false;
  const sheets = [] as WritingSheet[];
  for (const sheet of project.sheets) {
    if (!shouldEnsure(sheet)) {
      sheets.push(sheet);
      continue;
    }
    const nextSheet = await ensureDocumentSummary(sheet, generateSummary);
    changed ||= nextSheet !== sheet;
    sheets.push(nextSheet);
  }

  return changed ? { ...project, sheets } : project;
}
