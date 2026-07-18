import { describe, expect, it } from "vitest";
import { extractAiActionsFromMessage } from "./aiActions";
import { extractAiChangeSetFromMessage } from "./aiChangeSets";

describe("AI protocol fixtures", () => {
  it("parses a Codex-style reply with a reviewable edit and a follow-up Loby action", () => {
    const baseBody = "# 草稿\n\n原段落";
    const reply = [
      "我会先保留原意，把表达压得更紧一点；同时建议把案例另存成素材卡。",
      "```loby-change",
      JSON.stringify({
        summary: "润色开头段落",
        proposedBody: "# 草稿\n\n新段落",
        changes: [{ fromText: "原段落", toText: "新段落", reason: "减少重复。" }],
      }),
      "```",
      "```loby-action",
      JSON.stringify({
        action: "insertText",
        title: "插入文本：过渡句",
        summary: "在当前光标处补一段承上启下的过渡句。",
        payload: {
          title: "过渡句",
          text: "这也解释了为什么这个问题不能只靠灵感解决，而要交给一个稳定的写作系统。",
          target: "cursor",
        },
      }),
      "```",
    ].join("\n");

    const parsedChange = extractAiChangeSetFromMessage(reply, "sheet-1", baseBody);
    const parsedActions = extractAiActionsFromMessage(parsedChange.content);

    expect(parsedActions.content).toBe("我会先保留原意，把表达压得更紧一点；同时建议把案例另存成素材卡。");
    expect(parsedChange.changeSet).toMatchObject({
      summary: "润色开头段落",
      proposedBody: "# 草稿\n\n新段落",
    });
    expect(parsedActions.actions).toHaveLength(1);
    expect(parsedActions.actions[0]).toMatchObject({
      type: "insertText",
      title: "插入文本：过渡句",
      payload: {
        title: "过渡句",
        target: "cursor",
      },
    });
  });
});
