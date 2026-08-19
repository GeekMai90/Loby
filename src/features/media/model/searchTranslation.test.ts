/**
 * [INPUT]: 依赖中文搜索词检测、AI/百度翻译回调与 Unsplash 搜索词归一化
 * [OUTPUT]: 验证翻译关闭、指定提供商、自动兜底和原词回退的搜索词解析
 * [POS]: media model 的纯规则回归测试，不触发真实翻译或 Unsplash 网络请求
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it, vi } from "vitest";
import { containsChinese, resolveUnsplashSearchQuery } from "@/features/media/model/searchTranslation";

describe("resolveUnsplashSearchQuery", () => {
  it("does not translate an English query or a disabled translation setting", async () => {
    const translate = vi.fn(async () => "quiet lake reflection");
    await expect(
      resolveUnsplashSearchQuery({
        query: "quiet mountain lake",
        enabled: true,
        provider: "ai",
        translateWithAi: translate,
      }),
    ).resolves.toMatchObject({ effectiveQuery: "quiet mountain lake", translatedQuery: "", usedFallback: false });
    await expect(
      resolveUnsplashSearchQuery({
        query: "宁静的湖面",
        enabled: false,
        provider: "ai",
        translateWithAi: translate,
      }),
    ).resolves.toMatchObject({ effectiveQuery: "宁静的湖面", translatedQuery: "", usedFallback: false });
    expect(translate).not.toHaveBeenCalled();
  });

  it("uses the selected AI provider and exposes the effective English query", async () => {
    const result = await resolveUnsplashSearchQuery({
      query: "宁静的湖面",
      enabled: true,
      provider: "ai",
      translateWithAi: async () => "quiet lake reflection",
    });
    expect(result).toEqual({
      originalQuery: "宁静的湖面",
      effectiveQuery: "quiet lake reflection",
      translatedQuery: "quiet lake reflection",
      usedFallback: false,
      notice: "",
    });
  });

  it("silently falls back from the selected AI service to Baidu", async () => {
    const result = await resolveUnsplashSearchQuery({
      query: "安静的山谷",
      enabled: true,
      provider: "ai",
      translateWithAi: async () => {
        throw new Error("AI 翻译暂时不可用");
      },
      translateWithBaidu: async () => "quiet mountain valley",
    });
    expect(result.effectiveQuery).toBe("quiet mountain valley");
    expect(result.usedFallback).toBe(false);
    expect(result.notice).toBe("");
  });

  it("silently falls back from the selected Baidu service to AI", async () => {
    const result = await resolveUnsplashSearchQuery({
      query: "安静的山谷",
      enabled: true,
      provider: "baidu",
      translateWithBaidu: async () => {
        throw new Error("百度翻译暂时不可用");
      },
      translateWithAi: async () => "quiet mountain valley",
    });
    expect(result.effectiveQuery).toBe("quiet mountain valley");
    expect(result.usedFallback).toBe(false);
    expect(result.notice).toBe("");
  });

  it("uses the original query when providers fail or return invalid output", async () => {
    const result = await resolveUnsplashSearchQuery({
      query: "文章主题",
      enabled: true,
      provider: "baidu",
      translateWithBaidu: async () => "中文结果",
    });
    expect(result).toMatchObject({ effectiveQuery: "文章主题", translatedQuery: "", usedFallback: true });
    expect(result.notice).toContain("原词搜索");
  });

  it("detects Chinese and Japanese/Korean characters", () => {
    expect(containsChinese("宁静的湖面")).toBe(true);
    expect(containsChinese("quiet lake")).toBe(false);
    expect(containsChinese("静かな湖")).toBe(true);
  });
});
