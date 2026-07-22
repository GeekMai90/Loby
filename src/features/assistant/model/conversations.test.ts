import { describe, expect, it } from "vitest";
import { createWelcomeConversation, hasConversationMessages } from "@/features/assistant/model/conversations";

describe("conversation creation guard", () => {
  it("keeps a fresh empty conversation instead of creating another one", () => {
    expect(hasConversationMessages(createWelcomeConversation())).toBe(false);
  });

  it("allows a new conversation after the current one has messages", () => {
    const conversation = createWelcomeConversation();
    conversation.messages.push({ id: "user-1", role: "user", content: "开始讨论" });

    expect(hasConversationMessages(conversation)).toBe(true);
  });
});
