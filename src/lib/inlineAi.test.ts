import { describe, expect, it } from "vitest";
import { buildInlineAiHandoffMessages, buildInlineAiPrompt, inferInlineAiResultType, parseInlineAiResult } from "./inlineAi";

describe("inline AI protocol", () => {
  it("treats translation as an answer unless replacement is explicit", () => {
    expect(inferInlineAiResultType("翻译成英文")).toBe("answer");
    expect(inferInlineAiResultType("把这段翻译成英文")).toBe("answer");
    expect(inferInlineAiResultType("翻译成英文并替换正文")).toBe("edit");
  });

  it("treats rewriting instructions as edits", () => {
    expect(inferInlineAiResultType("润色一下")).toBe("edit");
    expect(inferInlineAiResultType("改得更口语一些")).toBe("edit");
  });

  it("parses answer and edit protocol blocks", () => {
    expect(parseInlineAiResult('```nibva-inline-ai\n{"resultType":"answer","content":"Hello"}\n```', "翻译成英文")).toEqual({
      resultType: "answer",
      content: "Hello",
    });
    expect(
      parseInlineAiResult('```nibva-inline-ai\n{"resultType":"edit","replacement":"更自然的表达","summary":"调整措辞"}\n```', "润色一下"),
    ).toEqual({ resultType: "edit", replacement: "更自然的表达", summary: "调整措辞" });
  });

  it("keeps the classification rules in the generated prompt", () => {
    const prompt = buildInlineAiPrompt("翻译成英文");
    expect(prompt).toContain('"resultType":"answer"');
    expect(prompt).toContain("用户指令：翻译成英文");
  });

  it("builds two messages that can be appended to the current conversation", () => {
    const messages = buildInlineAiHandoffMessages(
      {
        prompt: "翻译成英文",
        selection: {
          sheetId: "sheet-1",
          sheetTitle: "测试文稿",
          baseBody: "你好，世界",
          from: 0,
          to: 5,
          text: "你好，世界",
        },
        result: { resultType: "answer", content: "Hello, world" },
      },
      "project-1",
      100,
    );

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: "user", content: "翻译成英文" });
    expect(messages[0].contexts?.[0]).toMatchObject({
      type: "selection",
      contentMode: "snapshot",
      sheetId: "sheet-1",
      projectId: "project-1",
      content: "你好，世界",
    });
    expect(messages[1]).toMatchObject({ role: "assistant", content: "Hello, world" });
    expect(messages[1].changeSets).toBeUndefined();
  });
});
