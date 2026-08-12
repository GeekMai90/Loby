/**
 * [INPUT]: 依赖 Vitest、发布前摘要预检与 shared WritingSheet/WritingProject 契约
 * [OUTPUT]: 验证已有摘要跳过 AI、缺失摘要补全与项目级发布范围过滤
 * [POS]: publishing model 的发布前摘要回归测试，保护各渠道共用的空值触发规则
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it, vi } from "vitest";
import { ensureDocumentSummary, ensureProjectDocumentSummaries } from "@/features/publishing/model/summaryPreflight";
import type { WritingProject, WritingSheet } from "@/shared/types";

describe("summaryPreflight", () => {
  it("skips generation and keeps an empty summary when no generator is available", async () => {
    const missing = sheet("missing", "");

    await expect(ensureDocumentSummary(missing)).resolves.toBe(missing);
  });

  it("keeps an existing summary and only generates a missing one", async () => {
    const generateSummary = vi.fn().mockResolvedValue("AI 生成摘要");
    const existing = sheet("existing", "已有摘要");
    const missing = sheet("missing", "");

    await expect(ensureDocumentSummary(existing, generateSummary)).resolves.toBe(existing);
    await expect(ensureDocumentSummary(missing, generateSummary)).resolves.toMatchObject({ description: "AI 生成摘要" });
    expect(generateSummary).toHaveBeenCalledOnce();
  });

  it("generates summaries only for the selected publishable project sheets", async () => {
    const generateSummary = vi.fn(async (current: WritingSheet) => `${current.id} 摘要`);
    const project: WritingProject = {
      id: "project-1",
      title: "测试项目",
      status: "待发布",
      groups: [{ id: "published", title: "发布" }],
      sheets: [sheet("published-sheet", ""), { ...sheet("archived-sheet", ""), archivedAt: "2026-08-01" }],
      updatedAt: "2026-08-01",
    };

    const result = await ensureProjectDocumentSummaries(project, generateSummary, (current) => current.id === "published-sheet");

    expect(result.sheets[0]?.description).toBe("published-sheet 摘要");
    expect(result.sheets[1]?.description).toBe("");
    expect(generateSummary).toHaveBeenCalledOnce();
  });
});

function sheet(id: string, description: string): WritingSheet {
  return {
    id,
    title: id,
    tags: [],
    targetWords: 0,
    description,
    body: "正文",
    createdAt: "2026-08-01",
    updatedAt: "2026-08-01",
    properties: {},
  };
}
