import { describe, expect, it } from "vitest";
import { normalizeLoadedConversations } from "@/features/assistant/model/chatConversationNormalization";
import { LEGACY_WELCOME_MESSAGE } from "@/features/assistant/model/conversations";
import type { AgentRunActivity, ChatConversation, ChatMessage } from "@/shared/types";

describe("chatConversationNormalization", () => {
  it("keeps a valid conversation-local model selection and drops malformed legacy values", () => {
    const valid = {
      ...conversation({ actions: undefined }),
      agentSelection: { provider: "deepseek-api" as const, model: "deepseek-reasoner", reasoningEffort: "high" },
    };
    const invalid = {
      ...conversation({ actions: undefined }),
      id: "chat-invalid",
      agentSelection: { provider: "unknown", model: "", reasoningEffort: 1 },
    };

    const normalized = normalizeLoadedConversations([valid, invalid] as ChatConversation[]);

    expect(normalized[0].agentSelection).toEqual({
      provider: "deepseek-api",
      model: "deepseek-reasoner",
      reasoningEffort: "high",
    });
    expect(normalized[1].agentSelection).toBeUndefined();
  });

  it("normalizes persisted AI title metadata without inventing a message identity", () => {
    const valid = { ...conversation({ actions: undefined }), titleSource: "ai" as const, titleGeneratedForMessageId: "assistant-1" };
    const invalid = { ...conversation({ actions: undefined }), id: "chat-invalid-title", titleGeneratedForMessageId: 42 as never };

    const normalized = normalizeLoadedConversations([valid, invalid] as ChatConversation[]);

    expect(normalized[0].titleSource).toBe("ai");
    expect(normalized[0].titleGeneratedForMessageId).toBe("assistant-1");
    expect(normalized[1].titleGeneratedForMessageId).toBeUndefined();
  });

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

  it("keeps managed attachments while dropping transient and legacy attachment records", () => {
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
      {
        id: "/Users/example/Library/.loby/ai/attachments/hash/reference.pdf",
        name: "reference.pdf",
        path: "/Users/example/Library/.loby/ai/attachments/hash/reference.pdf",
        mimeType: "application/pdf",
        sizeBytes: 256,
        kind: "document",
      },
    ];
    (source.messages[0] as (typeof source.messages)[0] & { images?: unknown[] }).images = [{ path: "/tmp/loby/legacy.png" }];

    const normalized = normalizeLoadedConversations([source])[0].messages[0];
    expect(normalized.attachments).toEqual([
      expect.objectContaining({ name: "reference.pdf", path: expect.stringContaining("/.loby/ai/attachments/") }),
    ]);
    expect("images" in normalized).toBe(false);
  });

  it("recovers a persisted running agent snapshot as an interrupted terminal run", () => {
    const source = conversation({ actions: undefined });
    source.messages[0].run = {
      schemaVersion: 2,
      status: "running",
      phase: "executingTool",
      activeActivityId: "image",
      activities: [
        {
          id: "image",
          kind: "imageGeneration",
          state: "running",
          visibility: "milestone",
          rawType: "agent/activity/imageGeneration",
          title: "生成图片",
          status: "in_progress",
          command: "",
          output: "",
          text: "",
          exitCode: null,
        },
      ],
      usage: null,
    };

    expect(normalizeLoadedConversations([source])[0].messages[0].run).toMatchObject({
      status: "error",
      phase: "failed",
      activeActivityId: undefined,
      error: "上次运行在应用关闭或刷新时中断。",
      activities: [{ id: "image", state: "failed", status: "failed" }],
    });
  });

  it("restores a generated image source across the later insertion turn", () => {
    const artifactPath = "/Users/example/Library/Caches/Loby/generated-images/loby-generated-123.png";
    const source: ChatConversation = {
      ...conversation({ actions: undefined }),
      messages: [
        assistantMessage("generated", { run: completedRun([imageActivity(artifactPath)]) }),
        { id: "user-insert", role: "user", content: "插入" },
        assistantMessage("proposal", {
          actions: [
            {
              id: "insert-image",
              type: "insertImage",
              status: "proposed",
              title: "确认插入",
              summary: "插入刚刚生成的图片",
              payload: { path: "../assets/images/loby-generated-123.png", alt: "正文配图" },
              createdAt: "2026-07-27T13:26:57.000Z",
            },
          ],
          run: completedRun([]),
        }),
      ],
    };

    const normalized = normalizeLoadedConversations([source]);
    expect(normalized[0].messages[2].actions?.[0].sourceArtifactPath).toBe(artifactPath);
  });
});

function assistantMessage(id: string, overrides: Partial<ChatMessage>): ChatMessage {
  return { id, role: "assistant", content: "", ...overrides };
}

function completedRun(activities: AgentRunActivity[]): NonNullable<ChatMessage["run"]> {
  return { schemaVersion: 2, status: "completed", phase: "completed", activities, usage: null };
}

function imageActivity(artifactPath: string): AgentRunActivity {
  return {
    id: "generated-image",
    kind: "imageGeneration",
    state: "completed",
    visibility: "milestone",
    rawType: "agent/activity/imageGeneration",
    title: "完成 generate_image",
    status: "completed",
    command: "",
    output: "",
    text: "",
    exitCode: 0,
    artifactPath,
  };
}

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
