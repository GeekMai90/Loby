/**
 * [INPUT]: 依赖 Vitest、摘要生成器与 Agent runtime mock
 * [OUTPUT]: 验证摘要提示词、Provider 运行配置、前缀清理与 30 个汉字/60 个字符边界
 * [POS]: assistant model 的摘要生成回归测试，保护属性面板与发布前预检共享的文本边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { canGenerateDocumentSummary, generateDocumentSummary, normalizeDocumentSummary } from "@/features/assistant/model/documentSummary";

const { requestDocumentSummaryMock } = vi.hoisted(() => ({ requestDocumentSummaryMock: vi.fn() }));

vi.mock("@/features/assistant/model/agentRuntime", () => ({ generateDocumentSummary: requestDocumentSummaryMock }));

describe("documentSummary", () => {
  beforeEach(() => {
    requestDocumentSummaryMock.mockReset();
  });

  it("only enables generation for a configured default Provider", () => {
    expect(canGenerateDocumentSummary("qwen-api", { provider: "qwen-api", configured: true })).toBe(true);
    expect(canGenerateDocumentSummary("qwen-api", { provider: "qwen-api", configured: false })).toBe(false);
    expect(canGenerateDocumentSummary("qwen-api", { provider: "openai-api", configured: true })).toBe(false);
    expect(canGenerateDocumentSummary("qwen-api", undefined)).toBe(false);
  });

  it("reuses the active runtime configuration and returns a normalized summary", async () => {
    requestDocumentSummaryMock.mockResolvedValue({ output: "摘要：用 AI 缩短发布元信息", error: "", command: "deepseek-api" });

    const summary = await generateDocumentSummary({
      libraryPath: "/tmp/loby",
      provider: "deepseek-api",
      runtime: { model: "auto", reasoningEffort: "high", quickMode: true },
      sheet: { title: "测试文章", body: "正文内容" },
    });

    expect(summary).toBe("用 AI 缩短发布元信息");
    expect(requestDocumentSummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "deepseek-api",
        prompt: expect.stringContaining("不超过 30 个汉字"),
        context: expect.stringContaining("测试文章"),
        runtime: { model: "auto", reasoningEffort: "high", quickMode: true },
      }),
    );
    expect(requestDocumentSummaryMock.mock.calls[0]?.[0].prompt).toContain("愿意点开并继续阅读");
    expect(requestDocumentSummaryMock.mock.calls[0]?.[0].prompt).toContain("不得故意隐瞒关键事实");
  });

  it("rejects an empty article before calling the provider", async () => {
    await expect(
      generateDocumentSummary({
        libraryPath: "/tmp/loby",
        provider: "openai-api",
        runtime: { model: "auto", reasoningEffort: "", quickMode: false },
        sheet: { title: "空文章", body: "  " },
      }),
    ).rejects.toThrow("正文为空");
    expect(requestDocumentSummaryMock).not.toHaveBeenCalled();
  });

  it("caps unexpected provider output at 30 Han characters", () => {
    const summary = normalizeDocumentSummary("汉".repeat(35));

    expect(Array.from(summary)).toHaveLength(30);
  });

  it("caps mixed provider output at 60 total characters", () => {
    const summary = normalizeDocumentSummary("a".repeat(70));

    expect(Array.from(summary)).toHaveLength(60);
  });
});
