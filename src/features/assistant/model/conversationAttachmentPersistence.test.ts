// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 Vitest、浏览器 localStorage 与写作库会话持久化适配器
 * [OUTPUT]: 验证临时附件和未发送的空白对话不会进入持久化会话文件
 * [POS]: AI 助手会话存储边界的浏览器回归测试，确保临时输入与惰性新对话不污染历史
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import { loadBrowserConversations, saveConversations } from "@/features/library/model/persistence";
import type { ChatConversation } from "@/shared/types";

describe("temporary assistant attachment persistence", () => {
  it("never writes attachment metadata or temporary paths into conversation storage", async () => {
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
                id: "/tmp/loby/image.png",
                name: "image.png",
                path: "/tmp/loby/image.png",
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

    expect(saved[0].messages[0].attachments).toBeUndefined();
    expect(JSON.stringify(saved)).not.toContain("/tmp/loby/image.png");
    localStorage.clear();
  });

  it("keeps an anonymous text marker for an attachment-only message", async () => {
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
                id: "/tmp/loby/draft.pdf",
                name: "draft.pdf",
                path: "/tmp/loby/draft.pdf",
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

    expect(saved[0].messages[0]).toMatchObject({ content: "[附件]" });
    expect(saved[0].messages[0].attachments).toBeUndefined();
    expect(JSON.stringify(saved)).not.toContain("draft.pdf");
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
