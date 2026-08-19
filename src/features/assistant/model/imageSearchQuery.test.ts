/**
 * [INPUT]: 依赖 imageSearchQuery 的关键词清理规则
 * [OUTPUT]: 验证默认英文搜索词的前缀、JSON、代码围栏、英文词数与非法输出边界
 * [POS]: assistant model 的纯函数回归测试，不触发 AI 网络请求
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import { IMAGE_SEARCH_QUERY_MAX_CHARACTERS, normalizeImageSearchQuery } from "@/features/assistant/model/imageSearchQuery";

describe("normalizeImageSearchQuery", () => {
  it("removes prefixes, fences, quotes and trailing punctuation", () => {
    expect(normalizeImageSearchQuery('```text\n搜索词："quiet mountain lake"。\n```')).toBe("quiet mountain lake");
  });

  it("accepts a JSON query response", () => {
    expect(normalizeImageSearchQuery('{"query":"Reflective Forest Path"}')).toBe("reflective forest path");
  });

  it("finds a prefixed query after an explanatory line", () => {
    expect(normalizeImageSearchQuery("I considered the article mood.\nSearch query: solitary mountain path")).toBe(
      "solitary mountain path",
    );
  });

  it("normalizes comma-separated visual terms", () => {
    expect(normalizeImageSearchQuery("calm lake, reflection")).toBe("calm lake reflection");
  });

  it("rejects Chinese, explanations, single words and excessive word counts", () => {
    expect(normalizeImageSearchQuery("安静的湖面倒影")).toBe("");
    expect(normalizeImageSearchQuery("This is a useful cover image search query")).toBe("");
    expect(normalizeImageSearchQuery("reflection")).toBe("");
    expect(normalizeImageSearchQuery("one two three four five six")).toBe("");
  });

  it("rejects candidates beyond the search input boundary", () => {
    expect(normalizeImageSearchQuery(`quiet ${"a".repeat(IMAGE_SEARCH_QUERY_MAX_CHARACTERS)}`)).toBe("");
  });
});
