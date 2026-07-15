import { describe, expect, it } from "vitest";
import { buildMowenDocument } from "./mowenPayload";

describe("buildMowenDocument", () => {
  it("converts headings, marks, quotes, and list rows into NoteAtom blocks", () => {
    const result = buildMowenDocument("文章标题", "# 文章标题\n\n正文有 **重点** 和 ==高亮==。\n\n## 小节\n\n> 引用\n\n- 条目");
    expect(result.type).toBe("doc");
    expect(result.content[0]).toMatchObject({ type: "paragraph", content: [{ text: "文章标题", marks: [{ type: "bold" }] }] });
    expect(JSON.stringify(result)).toContain('"type":"highlight"');
    expect(result.content.some((block) => block.type === "quote")).toBe(true);
    expect(JSON.stringify(result)).toContain("- 条目");
  });

  it("downgrades fenced code to code-marked paragraphs", () => {
    const result = buildMowenDocument("代码", "```ts\nconst answer = 42;\n```");
    expect(JSON.stringify(result)).toContain('"type":"code"');
    expect(JSON.stringify(result)).toContain("const answer = 42;");
  });

  it("preserves uploaded image positions as attachment markers", () => {
    const result = buildMowenDocument("配图文章", "开头。\n\n@@MOWEN_ATTACHMENT:0@@\n\n结尾。");
    expect(result.content).toContainEqual({ type: "mowen_attachment", attrs: { index: 0 } });
  });

  it("preserves an image at the end of the document", () => {
    const result = buildMowenDocument("配图文章", "开头。\n\n@@MOWEN_ATTACHMENT:0@@\n\n结尾。\n\n@@MOWEN_ATTACHMENT:1@@");
    expect(result.content.filter((block) => block.type === "mowen_attachment")).toEqual([
      { type: "mowen_attachment", attrs: { index: 0 } },
      { type: "mowen_attachment", attrs: { index: 1 } },
    ]);
    expect(result.content.at(-1)).toEqual({ type: "mowen_attachment", attrs: { index: 1 } });
  });

  it("preserves a document containing only an image", () => {
    const result = buildMowenDocument("", "@@MOWEN_ATTACHMENT:0@@");
    expect(result.content).toEqual([{ type: "mowen_attachment", attrs: { index: 0 } }]);
  });
});
