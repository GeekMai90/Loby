import { describe, expect, it } from "vitest";
import { createWechatThemeConversation } from "./wechatThemeStore";
import { createWechatThemeMessageId, withWechatThemeConversationMessages } from "./wechatThemeConversation";

describe("WeChat theme conversation helpers", () => {
  it("creates deterministic message IDs from injected entropy", () => {
    expect(createWechatThemeMessageId(1234, 0.5)).toBe("theme-message-1234-i");
  });

  it("updates only the target conversation and preserves an existing thread when no replacement is supplied", () => {
    const first = { ...createWechatThemeConversation(), id: "first", agentThreadId: "thread-first" };
    const second = { ...createWechatThemeConversation(), id: "second", agentThreadId: "thread-second" };
    const messages = [{ id: "message", role: "assistant" as const, content: "完成" }];

    const result = withWechatThemeConversationMessages([first, second], "second", messages, "", "2026-07-17T00:00:00.000Z");

    expect(result[0]).toBe(first);
    expect(result[1]).toMatchObject({
      id: "second",
      messages,
      agentThreadId: "thread-second",
      updatedAt: "2026-07-17T00:00:00.000Z",
    });
  });

  it("records a replacement agent thread on the target conversation", () => {
    const conversation = { ...createWechatThemeConversation(), id: "target", agentThreadId: "old-thread" };
    const result = withWechatThemeConversationMessages([conversation], "target", [], "new-thread", "2026-07-17T00:00:00.000Z");

    expect(result[0]?.agentThreadId).toBe("new-thread");
  });
});
