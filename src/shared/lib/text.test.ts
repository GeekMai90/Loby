/**
 * [INPUT]: 依赖 Vitest 与 shared 文本统计工具
 * [OUTPUT]: 验证中英文混排、数字、连字符与撇号的单遍字数语义
 * [POS]: shared 文本统计的回归边界，防止无分配扫描偏离既有计数契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import { countWords } from "@/shared/lib/text";

describe("countWords", () => {
  it("counts each Chinese character and each Latin or numeric token", () => {
    expect(countWords("中文 mixed English 123")).toBe(5);
  });

  it("keeps valid hyphenated and apostrophe words as one token", () => {
    expect(countWords("local-first don't 123-abc")).toBe(3);
    expect(countWords("a--b a-'b")).toBe(4);
  });

  it("ignores punctuation and whitespace", () => {
    expect(countWords("……，。  \n\t—")).toBe(0);
  });
});
