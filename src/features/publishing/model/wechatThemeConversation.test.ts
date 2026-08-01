import { describe, expect, it } from "vitest";
import { createWechatThemeConversation } from "@/features/publishing/model/wechatThemeStore";
import {
  createWechatThemeMessageId,
  toWechatThemeChatMessages,
  withWechatThemeConversationMessages,
} from "@/features/publishing/model/wechatThemeConversation";

describe("WeChat theme conversation helpers", () => {
  it("creates deterministic message IDs from injected entropy", () => {
    expect(createWechatThemeMessageId(1234, 0.5)).toBe("theme-message-1234-i");
  });

  it("updates only the target conversation", () => {
    const first = { ...createWechatThemeConversation(), id: "first" };
    const second = { ...createWechatThemeConversation(), id: "second" };
    const messages = [{ id: "message", role: "assistant" as const, content: "完成" }];

    const result = withWechatThemeConversationMessages([first, second], "second", messages, "2026-07-17T00:00:00.000Z");

    expect(result[0]).toBe(first);
    expect(result[1]).toMatchObject({ id: "second", messages, updatedAt: "2026-07-17T00:00:00.000Z" });
  });

  it("records which theme revision is already present in the local context", () => {
    const conversation = { ...createWechatThemeConversation(), id: "target" };
    const result = withWechatThemeConversationMessages(
      [conversation],
      "target",
      [],
      "2026-07-21T18:00:00.000Z",
      "2026-07-21T17:59:00.000Z",
      2,
    );

    expect(result[0]?.themeContextUpdatedAt).toBe("2026-07-21T17:59:00.000Z");
    expect(result[0]?.themeContextVersion).toBe(2);
  });

  it("adapts theme messages to the shared conversation planner without dropping attachment metadata", () => {
    const result = toWechatThemeChatMessages([
      {
        id: "user-1",
        role: "user",
        content: "参考这张图",
        attachments: [
          {
            id: "image-1",
            name: "reference.png",
            path: "/tmp/reference.png",
            mimeType: "image/png",
            sizeBytes: 12,
            kind: "image",
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        id: "user-1",
        role: "user",
        content: "参考这张图",
        attachments: [
          {
            id: "image-1",
            name: "reference.png",
            path: "/tmp/reference.png",
            mimeType: "image/png",
            sizeBytes: 12,
            kind: "image",
          },
        ],
      },
    ]);
  });
});
