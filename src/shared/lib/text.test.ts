/**
 * [INPUT]: 依赖 Vitest 与 shared 文本统计工具
 * [OUTPUT]: 验证中英文混排、数字、连字符、撇号与同一文稿 revision 的字数复用语义
 * [POS]: shared 文本统计的回归边界，防止无分配扫描偏离既有计数契约或高频消费方重复读取正文
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import type { WritingSheet } from "@/shared/types";
import { countWords, sheetWordCount } from "@/shared/lib/text";

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

  it("materializes the word count once for the same immutable sheet revision", () => {
    let bodyReads = 0;
    const currentSheet = sheet("");
    Object.defineProperty(currentSheet, "body", {
      get() {
        bodyReads += 1;
        return "中文 mixed";
      },
    });

    expect(sheetWordCount(currentSheet)).toBe(3);
    expect(sheetWordCount(currentSheet)).toBe(3);
    expect(bodyReads).toBe(1);
    expect(sheetWordCount({ ...sheet("中文 mixed"), body: "中文 mixed 新" })).toBe(4);
  });
});

function sheet(body: string): WritingSheet {
  return {
    id: "sheet-1",
    title: "文稿",
    tags: [],
    targetWords: 0,
    description: "",
    body,
    createdAt: "2026-08-01 20:00:00",
    updatedAt: "2026-08-01 20:00:00",
    properties: {},
  };
}
