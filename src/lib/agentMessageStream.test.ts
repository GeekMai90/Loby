import { describe, expect, it } from "vitest";
import { appendAgentMessageDelta } from "./agentMessageStream";

describe("appendAgentMessageDelta", () => {
  it("concatenates deltas from the same agent message without changing its text", () => {
    const first = appendAgentMessageDelta({ content: "", itemId: "" }, "第一", "message-1");
    const second = appendAgentMessageDelta(first, "段", "message-1");

    expect(second).toEqual({ content: "第一段", itemId: "message-1" });
  });

  it("adds a paragraph boundary when Codex starts a new agent message in the same turn", () => {
    const first = appendAgentMessageDelta({ content: "第一段回复。", itemId: "message-1" }, "第二段回复。", "message-2");

    expect(first).toEqual({ content: "第一段回复。\n\n第二段回复。", itemId: "message-2" });
  });

  it("does not add a third newline when the model already emitted a paragraph boundary", () => {
    const next = appendAgentMessageDelta({ content: "第一段回复。\n", itemId: "message-1" }, "\n第二段回复。", "message-2");

    expect(next.content).toBe("第一段回复。\n\n第二段回复。");
  });
});
