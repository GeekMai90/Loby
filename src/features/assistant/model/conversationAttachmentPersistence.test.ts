// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 Vitest、浏览器 localStorage 与写作库会话持久化适配器
 * [OUTPUT]: 验证受管附件会持久化但 blob 预览不会写盘，并守住未发送空白对话过滤
 * [POS]: AI 助手会话存储边界的浏览器回归测试，确保附件跨重启可复用且瞬态预览不污染历史
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import { loadBrowserConversations, saveConversations } from "@/features/library/model/persistence";
import type { ChatConversation } from "@/shared/types";

describe("managed assistant attachment persistence", () => {
  it("writes managed attachment metadata without transient blob previews", async () => {
    const libraryPath = "browser://temporary-attachment-test";
    const conversations: ChatConversation[] = [
      {
        id: "chat-1",
        title: "附件测试",
        createdAt: "2026-07-17T00:00:00Z",
        updatedAt: "2026-07-17T00:00:00Z",
        messages: [
          {
            id: "user-1",
            role: "user",
            content: "看看这张图",
            attachments: [
              {
                id: "/Users/example/Library/.loby/ai/attachments/hash/image.png",
                name: "image.png",
                path: "/Users/example/Library/.loby/ai/attachments/hash/image.png",
                mimeType: "image/png",
                sizeBytes: 128,
                kind: "image",
                previewUrl: "blob:loby-preview",
              },
            ],
          },
        ],
      },
    ];

    await saveConversations(conversations, libraryPath);
    const saved = loadBrowserConversations([], libraryPath);

    expect(saved[0].messages[0].attachments?.[0]).toMatchObject({ name: "image.png", kind: "image" });
    expect(saved[0].messages[0].attachments?.[0].previewUrl).toBeUndefined();
    expect(JSON.stringify(saved)).toContain("/.loby/ai/attachments/hash/image.png");
    localStorage.clear();
  });

  it("keeps an attachment-only message and its durable document reference", async () => {
    const libraryPath = "browser://temporary-attachment-only-test";
    const conversations: ChatConversation[] = [
      {
        id: "chat-1",
        title: "附件测试",
        createdAt: "2026-07-17T00:00:00Z",
        updatedAt: "2026-07-17T00:00:00Z",
        messages: [
          {
            id: "user-1",
            role: "user",
            content: "",
            attachments: [
              {
                id: "/Users/example/Library/.loby/ai/attachments/hash/draft.pdf",
                name: "draft.pdf",
                path: "/Users/example/Library/.loby/ai/attachments/hash/draft.pdf",
                mimeType: "application/pdf",
                sizeBytes: 128,
                kind: "document",
              },
            ],
          },
        ],
      },
    ];

    await saveConversations(conversations, libraryPath);
    const saved = loadBrowserConversations([], libraryPath);

    expect(saved[0].messages[0]).toMatchObject({ content: "" });
    expect(saved[0].messages[0].attachments?.[0]).toMatchObject({ name: "draft.pdf", kind: "document" });
    localStorage.clear();
  });

  it("does not persist an empty conversation before the user sends a message", async () => {
    const libraryPath = "browser://lazy-conversation-test";
    const conversations: ChatConversation[] = [
      {
        id: "chat-empty",
        title: "新对话",
        createdAt: "2026-07-25T00:00:00Z",
        updatedAt: "2026-07-25T00:00:00Z",
        messages: [],
      },
      {
        id: "chat-used",
        title: "已有对话",
        createdAt: "2026-07-24T00:00:00Z",
        updatedAt: "2026-07-24T00:10:00Z",
        messages: [{ id: "user-1", role: "user", content: "已有内容" }],
      },
    ];

    await saveConversations(conversations, libraryPath);

    expect(loadBrowserConversations([], libraryPath).map((conversation) => conversation.id)).toEqual(["chat-used"]);
    localStorage.clear();
  });
});
