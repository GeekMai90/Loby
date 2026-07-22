// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { loadBrowserConversations, saveConversations } from "@/features/library/model/persistence";
import type { ChatConversation } from "@/shared/types";

describe("temporary assistant image persistence", () => {
  it("never writes image metadata or temporary paths into conversation storage", async () => {
    const libraryPath = "browser://temporary-image-test";
    const conversations: ChatConversation[] = [
      {
        id: "chat-1",
        title: "图片测试",
        createdAt: "2026-07-17T00:00:00Z",
        updatedAt: "2026-07-17T00:00:00Z",
        messages: [
          {
            id: "user-1",
            role: "user",
            content: "看看这张图",
            images: [
              {
                id: "/tmp/loby/image.png",
                name: "image.png",
                path: "/tmp/loby/image.png",
                mimeType: "image/png",
                sizeBytes: 128,
                previewUrl: "blob:loby-preview",
              },
            ],
          },
        ],
      },
    ];

    await saveConversations(conversations, libraryPath);
    const saved = loadBrowserConversations([], libraryPath);

    expect(saved[0].messages[0].images).toBeUndefined();
    expect(JSON.stringify(saved)).not.toContain("/tmp/loby/image.png");
    localStorage.clear();
  });

  it("keeps an anonymous text marker for an image-only message", async () => {
    const libraryPath = "browser://temporary-image-only-test";
    const conversations: ChatConversation[] = [
      {
        id: "chat-1",
        title: "图片测试",
        createdAt: "2026-07-17T00:00:00Z",
        updatedAt: "2026-07-17T00:00:00Z",
        messages: [
          {
            id: "user-1",
            role: "user",
            content: "",
            images: [
              {
                id: "/tmp/loby/image.png",
                name: "image.png",
                path: "/tmp/loby/image.png",
                mimeType: "image/png",
                sizeBytes: 128,
              },
            ],
          },
        ],
      },
    ];

    await saveConversations(conversations, libraryPath);
    const saved = loadBrowserConversations([], libraryPath);

    expect(saved[0].messages[0]).toMatchObject({ content: "[图片附件]" });
    expect(saved[0].messages[0].images).toBeUndefined();
    expect(JSON.stringify(saved)).not.toContain("image.png");
    localStorage.clear();
  });
});
