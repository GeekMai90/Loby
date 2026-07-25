/**
 * [INPUT]: 依赖 Vitest、conversationOpening 策略与 shared 会话契约
 * [OUTPUT]: 验证换文稿、两小时静默期、空白会话和未完成工作对应的重新打开决策
 * [POS]: AI 助手任务会话边界的纯模型回归测试，避免面板生命周期误切正在进行的工作
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import {
  CONVERSATION_INACTIVITY_LIMIT_MS,
  hasUnresolvedConversationWork,
  shouldStartNewConversationOnOpen,
} from "@/features/assistant/model/conversationOpening";
import type { ChatConversation } from "@/shared/types";

const now = Date.parse("2026-07-25T12:00:00.000Z");

describe("conversation opening policy", () => {
  it("starts a new conversation when reopening on another sheet", () => {
    expect(decide(conversation({ lastContextSheetId: "sheet-old" }), "sheet-new")).toBe(true);
  });

  it("continues the same sheet at two hours and starts after two hours", () => {
    expect(decide(conversation({ lastUserMessageAt: new Date(now - CONVERSATION_INACTIVITY_LIMIT_MS).toISOString() }))).toBe(false);
    expect(decide(conversation({ lastUserMessageAt: new Date(now - CONVERSATION_INACTIVITY_LIMIT_MS - 1).toISOString() }))).toBe(true);
  });

  it("keeps an empty draft and any conversation with unresolved work", () => {
    expect(decide(conversation({ messages: [] }), "sheet-new")).toBe(false);

    const running = conversation();
    running.messages.push({
      id: "assistant-running",
      role: "assistant",
      content: "",
      run: { status: "running", activities: [], usage: null },
    });
    expect(hasUnresolvedConversationWork(running)).toBe(true);
    expect(decide(running, "sheet-new")).toBe(false);

    const awaitingConfirmation = conversation();
    awaitingConfirmation.messages.push({
      id: "assistant-action",
      role: "assistant",
      content: "准备插入内容",
      actions: [
        {
          id: "action-1",
          type: "insertText",
          status: "proposed",
          title: "插入内容",
          summary: "等待确认",
          payload: { text: "内容" },
          createdAt: "2026-07-25T11:30:00.000Z",
        },
      ],
    });
    expect(decide(awaitingConfirmation, "sheet-new")).toBe(false);
  });

  it("recovers the last sheet and time from legacy message data", () => {
    const legacy = conversation({
      lastContextSheetId: undefined,
      lastUserMessageAt: undefined,
      updatedAt: "2026-07-25T11:59:00.000Z",
      messages: [
        {
          id: `user-${now - CONVERSATION_INACTIVITY_LIMIT_MS - 1}`,
          role: "user",
          content: "继续",
          contexts: [
            {
              id: "document:sheet-current",
              type: "document",
              sheetId: "sheet-current",
              title: "当前文稿",
              subtitle: "当前文稿",
              excerpt: "当前文稿",
            },
          ],
        },
      ],
    });

    expect(decide(legacy)).toBe(true);
  });

  it("honors an external busy or approval guard", () => {
    expect(decide(conversation(), "sheet-new", true)).toBe(false);
  });
});

function decide(source: ChatConversation, activeSheetId = "sheet-current", blocked = false) {
  return shouldStartNewConversationOnOpen({ conversation: source, activeSheetId, blocked, now });
}

function conversation(overrides: Partial<ChatConversation> = {}): ChatConversation {
  return {
    id: "chat-1",
    title: "现有对话",
    createdAt: "2026-07-25T09:00:00.000Z",
    updatedAt: "2026-07-25T10:00:00.000Z",
    lastUserMessageAt: "2026-07-25T11:00:00.000Z",
    lastContextSheetId: "sheet-current",
    messages: [{ id: "user-1", role: "user", content: "继续处理" }],
    ...overrides,
  };
}
