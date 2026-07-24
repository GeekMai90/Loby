import { describe, expect, it } from "vitest";
import { appendAgentMessageDelta, completeAgentMessage } from "@/features/assistant/model/agentMessageStream";

describe("appendAgentMessageDelta", () => {
  it("concatenates deltas from the same agent message without changing its text", () => {
    const first = appendAgentMessageDelta({ content: "", itemId: "" }, "第一", "message-1");
    const second = appendAgentMessageDelta(first, "段", "message-1");

    expect(second).toMatchObject({ content: "第一段", itemId: "message-1" });
  });

  it("adds a paragraph boundary when Codex starts a new agent message in the same turn", () => {
    const first = appendAgentMessageDelta({ content: "第一段回复。", itemId: "message-1" }, "第二段回复。", "message-2");

    expect(first).toMatchObject({ content: "第一段回复。\n\n第二段回复。", itemId: "message-2" });
  });

  it("does not add a third newline when the model already emitted a paragraph boundary", () => {
    const next = appendAgentMessageDelta({ content: "第一段回复。\n", itemId: "message-1" }, "\n第二段回复。", "message-2");

    expect(next.content).toBe("第一段回复。\n\n第二段回复。");
  });

  it("restores completed commentary once even when recovery repeats earlier message items", () => {
    const first = completeAgentMessage({ content: "", itemId: "" }, "第一段说明。", "message-1");
    const second = completeAgentMessage(first, "第二段说明。", "message-2");
    const recoveredFirst = completeAgentMessage(second, "第一段说明。", "message-1");

    expect(recoveredFirst.content).toBe("第一段说明。\n\n第二段说明。");
  });

  it("replaces a partially streamed item with its completed text", () => {
    const streamed = appendAgentMessageDelta({ content: "", itemId: "" }, "正在生", "message-1");
    const completed = completeAgentMessage(streamed, "正在生成图片。", "message-1");

    expect(completed.content).toBe("正在生成图片。");
  });

  it("deduplicates a completed message when recovery assigns a different item id", () => {
    const streamed = appendAgentMessageDelta({ content: "", itemId: "" }, "最终回复。", "live-message-id");
    const recovered = completeAgentMessage(streamed, "最终回复。", "thread-read-item-id");

    expect(recovered.content).toBe("最终回复。");
    expect(recovered.segments).toHaveLength(1);
  });

  it("deduplicates a recovered final already appended after commentary in one live segment", () => {
    const live = appendAgentMessageDelta({ content: "", itemId: "" }, "正在处理。\n\n最终回复。", "live-message-id");
    const recovered = completeAgentMessage(live, "最终回复。", "thread-read-item-id");

    expect(recovered.content).toBe("正在处理。\n\n最终回复。");
    expect(recovered.segments).toHaveLength(1);
  });
});
