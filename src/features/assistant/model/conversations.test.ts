import { describe, expect, it } from "vitest";
import { createConversationBranch, createWelcomeConversation, hasConversationMessages } from "@/features/assistant/model/conversations";

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

describe("conversation branching", () => {
  it("forks an edited user message without truncating the source conversation", () => {
    const source = createWelcomeConversation("chat-source", "原对话");
    source.messages = [
      { id: "user-1", role: "user", content: "第一问" },
      { id: "assistant-1", role: "assistant", content: "第一答" },
      { id: "user-2", role: "user", content: "第二问" },
      { id: "assistant-2", role: "assistant", content: "第二答" },
    ];
    source.agentSelection = { provider: "chatgpt-subscription", model: "gpt-5.6-sol", reasoningEffort: "high" };
    const branch = createConversationBranch(
      source,
      "user-2",
      { id: "user-2", role: "user", content: "修改后的第二问" },
      "sheet-1",
      "chat-branch",
      "2026-07-27T10:00:00.000Z",
    );

    expect(source.messages.map((message) => message.content)).toEqual(["第一问", "第一答", "第二问", "第二答"]);
    expect(branch.messages.map((message) => message.content)).toEqual(["第一问", "第一答", "修改后的第二问"]);
    expect(branch.parentConversationId).toBe("chat-source");
    expect(branch.forkedFromMessageId).toBe("user-2");
    expect(branch.agentSelection).toEqual(source.agentSelection);
  });
});
