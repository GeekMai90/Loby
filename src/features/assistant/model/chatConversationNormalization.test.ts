import { describe, expect, it } from "vitest";
import { normalizeLoadedConversations } from "@/features/assistant/model/chatConversationNormalization";
import { LEGACY_WELCOME_MESSAGE } from "@/features/assistant/model/conversations";
import type { ChatConversation } from "@/shared/types";

describe("chatConversationNormalization", () => {
  it("recovers persisted applying actions as retryable failures", () => {
    const normalized = normalizeLoadedConversations([
      conversation({
        actions: [
          {
            id: "action-1",
            type: "insertText",
            status: "applying",
            title: "插入文本",
            summary: "插入一段文字",
            payload: { text: "正文" },
            createdAt: "2026-07-09T10:00:00+08:00",
            result: "不应保留",
            effect: { type: "sheetVersionRestore", sheetId: "sheet-1", sheetTitle: "草稿", versionId: "v1" },
          },
        ],
      }),
    ]);

    expect(normalized[0].messages[0].actions?.[0]).toMatchObject({
      id: "action-1",
      status: "failed",
      error: "上次执行时落笔已关闭或刷新，动作没有确认完成。请检查文稿或文件后重试。",
      result: undefined,
      effect: undefined,
    });
  });

  it("keeps actionable and completed statuses unchanged while removing legacy welcome messages", () => {
    const normalized = normalizeLoadedConversations([
      {
        ...conversation({
          actions: [
            {
              id: "action-2",
              type: "saveExport",
              status: "failed",
              title: "保存导出",
              summary: "保存文件",
              payload: { filename: "draft.md" },
              createdAt: "2026-07-09T10:00:00+08:00",
              error: "磁盘不可写",
            },
          ],
        }),
        messages: [
          { id: "old-welcome", role: "assistant", content: LEGACY_WELCOME_MESSAGE },
          ...conversation({
            actions: [
              {
                id: "action-2",
                type: "saveExport",
                status: "failed",
                title: "保存导出",
                summary: "保存文件",
                payload: { filename: "draft.md" },
                createdAt: "2026-07-09T10:00:00+08:00",
                error: "磁盘不可写",
              },
            ],
          }).messages,
        ],
      },
    ]);

    expect(normalized[0].messages).toHaveLength(1);
    expect(normalized[0].messages[0].actions?.[0]).toMatchObject({
      status: "failed",
      error: "磁盘不可写",
    });
  });

  it("keeps applied action results for audit history", () => {
    const normalized = normalizeLoadedConversations([
      conversation({
        actions: [
          {
            id: "action-3",
            type: "insertText",
            status: "applied",
            title: "插入文本",
            summary: "插入一段文字",
            payload: { text: "正文" },
            createdAt: "2026-07-09T10:00:00+08:00",
            result: "已向「草稿」插入 AI 文本，并自动保存插入前版本。",
            effect: { type: "sheetVersionRestore", sheetId: "sheet-1", sheetTitle: "草稿", versionId: "v1" },
          },
        ],
      }),
    ]);

    expect(normalized[0].messages[0].actions?.[0]).toMatchObject({
      status: "applied",
      result: "已向「草稿」插入 AI 文本，并自动保存插入前版本。",
      effect: { type: "sheetVersionRestore", sheetId: "sheet-1", sheetTitle: "草稿", versionId: "v1" },
    });
  });

  it("drops current and legacy transient attachments from loaded conversation data", () => {
    const source = conversation({ actions: undefined });
    source.messages[0].attachments = [
      {
        id: "/tmp/loby/image.png",
        name: "image.png",
        path: "/tmp/loby/image.png",
        mimeType: "image/png",
        sizeBytes: 128,
        kind: "image",
      },
    ];
    (source.messages[0] as (typeof source.messages)[0] & { images?: unknown[] }).images = [{ path: "/tmp/loby/legacy.png" }];

    const normalized = normalizeLoadedConversations([source])[0].messages[0];
    expect(normalized.attachments).toBeUndefined();
    expect("images" in normalized).toBe(false);
  });
});

function conversation(message: Pick<ChatConversation["messages"][number], "actions">): ChatConversation {
  return {
    id: "chat-1",
    title: "测试对话",
    createdAt: "2026-07-09T10:00:00+08:00",
    updatedAt: "2026-07-09T10:00:00+08:00",
    messages: [
      {
        id: "assistant-1",
        role: "assistant",
        content: "动作建议",
        actions: message.actions,
      },
    ],
  };
}
