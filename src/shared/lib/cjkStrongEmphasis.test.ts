/**
 * [INPUT]: 依赖 Vitest 与共享中文粗体规范化规则
 * [OUTPUT]: 验证跨段、同一行多粗体、未闭合标记、Unicode 空白、转义与保护区的非串联配对
 * [POS]: shared/lib 的 Markdown delimiter 边界回归，防止编辑器与公众号再次分叉
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import { normalizeCjkStrongEmphasis } from "@/shared/lib/cjkStrongEmphasis";

describe("normalizeCjkStrongEmphasis", () => {
  it.each([
    ["preceding paragraph", "前一段。**第一段。**\n\n后文：** 第二段。** 后面", "前一段。**第一段。**\n\n后文：**第二段。** 后面"],
    ["two spans on one line", "**第一。**，然后：**第二。**后面", "**第一。**，然后：**第二。** 后面"],
    ["unclosed earlier marker", "未闭合 **前文，然后：**第二。**后面", "未闭合 **前文，然后：**第二。** 后面"],
    ["line-leading malformed marker", "** 重点。 **后面", "**重点。** 后面"],
    ["unicode marker spacing", "前文：**　重点。　**后面", "前文：**重点。** 后面"],
  ])("normalizes %s without joining unrelated delimiters", (_label, source, expected) => {
    expect(normalizeCjkStrongEmphasis(source)).toBe(expected);
    expect(normalizeCjkStrongEmphasis(expected)).toBe(expected);
  });

  it("keeps escaped and protected delimiters literal", () => {
    const source = "\\** 转义。**后面 `** 代码。**后面`";
    const codeStart = source.indexOf("`");

    expect(normalizeCjkStrongEmphasis(source, { protectedRanges: [{ start: codeStart, end: source.length }] })).toBe(source);
  });

  it("does not reinterpret spaced numeric operators as strong emphasis", () => {
    expect(normalizeCjkStrongEmphasis("2 ** 3 ** 4")).toBe("2 ** 3 ** 4");
  });

  it("supports a non-visible renderer boundary marker", () => {
    expect(normalizeCjkStrongEmphasis("**重点。**后面", { boundarySuffix: " <boundary>" })).toBe("**重点。** <boundary>后面");
  });

  it("is idempotent across delimiter, spacing, punctuation, and surrounding-context combinations", () => {
    const prefixes = ["", "前文：", "**前一处。**，然后：", "未闭合 **前文，然后："];
    const openingSpaces = ["", " ", "\u00a0", "\u3000", "\u200b"];
    const closingSpaces = ["", " ", "\u3000"];
    const contents = ["重点", "重点。", "“重点。”"];
    const suffixes = ["", "后面", "，后面", " 后面"];

    for (const prefix of prefixes) {
      for (const openingSpace of openingSpaces) {
        for (const closingSpace of closingSpaces) {
          for (const content of contents) {
            for (const suffix of suffixes) {
              const source = `${prefix}**${openingSpace}${content}${closingSpace}**${suffix}`;
              const once = normalizeCjkStrongEmphasis(source);
              expect(normalizeCjkStrongEmphasis(once), source).toBe(once);
              expect(once.match(/\*\*/g)?.length ?? 0, source).toBe(source.match(/\*\*/g)?.length ?? 0);
              expect(once.match(/\n/g)?.length ?? 0, source).toBe(source.match(/\n/g)?.length ?? 0);
            }
          }
        }
      }
    }
  });
});
