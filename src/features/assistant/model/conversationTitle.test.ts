/**
 * [INPUT]: 依赖会话标题策略、Agent runtime IPC mock 与 shared ChatMessage
 * [OUTPUT]: 验证标题历史压缩、6 到 8 字清洗、低预算请求和 Provider 不可用回退
 * [POS]: AI 助手标题 model 的纯单元回归测试，不访问真实 Provider 或写作库
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/shared/types";
import { generateConversationTitle } from "@/features/assistant/model/agentRuntime";
import {
  buildConversationTitleMessages,
  buildConversationTitlePrompt,
  normalizeConversationTitle,
  requestConversationTitle,
} from "@/features/assistant/model/conversationTitle";

vi.mock("@/features/assistant/model/agentRuntime", () => ({
  generateConversationTitle: vi.fn(),
}));

describe("conversationTitle", () => {
  it("keeps only a small first-and-latest conversation projection", () => {
    const messages = Array.from({ length: 9 }, (_, index): ChatMessage => ({
      id: `message-${index}`,
      role: index % 2 === 0 ? "user" : "assistant",
      content: `${index}`.repeat(300),
    }));

    const projected = buildConversationTitleMessages(messages);

    expect(projected.map((message) => message.id)).toEqual(["message-0", "message-4", "message-5", "message-6", "message-7", "message-8"]);
    expect(Array.from(projected[0]!.content).length).toBeLessThanOrEqual(220);
  });

  it("requires a clean six-to-eight-character title", () => {
    expect(normalizeConversationTitle("「写作助手标题」")).toBe("写作助手标题");
    expect(normalizeConversationTitle("标题：AI 助手对话标题")).toBe("AI助手对话标题");
    expect(normalizeConversationTitle("太短")).toBeNull();
    expect(normalizeConversationTitle("这个标题超过八个字了")).toBeNull();
    expect(normalizeConversationTitle("标题：写作助手标题\n这里是解释")).toBeNull();
  });

  it("uses a dedicated no-reasoning, capped title request", async () => {
    vi.mocked(generateConversationTitle).mockResolvedValueOnce("写作助手标题");

    await expect(
      requestConversationTitle({
        provider: "openai-api",
        model: "gpt-5.6-terra",
        providerBaseUrl: "",
        messages: [
          { id: "user-1", role: "user", content: "我想优化一篇文章的结构" },
          { id: "assistant-1", role: "assistant", content: "可以从主线和段落层级入手。" },
        ],
      }),
    ).resolves.toBe("写作助手标题");

    expect(generateConversationTitle).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai-api",
        prompt: buildConversationTitlePrompt(),
        runtime: expect.objectContaining({ reasoningEffort: "", maxOutputTokens: 32, quickMode: false }),
      }),
    );
  });

  it("quietly skips title generation without a user message or with an invalid result", async () => {
    await expect(
      requestConversationTitle({
        provider: "openai-api",
        model: "auto",
        providerBaseUrl: "",
        messages: [{ id: "assistant-1", role: "assistant", content: "只有助手消息" }],
      }),
    ).resolves.toBeNull();

    vi.mocked(generateConversationTitle).mockResolvedValueOnce("不合规");
    await expect(
      requestConversationTitle({
        provider: "openai-api",
        model: "auto",
        providerBaseUrl: "",
        messages: [{ id: "user-1", role: "user", content: "请帮我整理这篇文章" }],
      }),
    ).resolves.toBeNull();
  });
});
