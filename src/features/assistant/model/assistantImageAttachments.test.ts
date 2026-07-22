import { describe, expect, it } from "vitest";
import {
  collectAssistantImagePaths,
  formatAssistantMessageForContext,
  getAssistantImageFilesFromClipboard,
  validateAssistantImageFile,
} from "@/features/assistant/model/assistantImageAttachments";
import type { AiImageAttachment, ChatMessage } from "@/shared/types";

describe("assistant image attachments", () => {
  it("extracts a pasted image file instead of clipboard path text", () => {
    const image = file("clipboard.png", "image/png", 128);
    const clipboard = {
      items: [
        { kind: "string", type: "text/plain", getAsFile: () => null },
        { kind: "file", type: "image/png", getAsFile: () => image },
      ],
      files: [],
    } as unknown as DataTransfer;

    expect(getAssistantImageFilesFromClipboard(clipboard)).toEqual([image]);
  });

  it("intercepts unsupported image clipboard files so their local path is not pasted as text", () => {
    const image = file("photo.heic", "image/heic", 128);
    const clipboard = {
      items: [{ kind: "file", type: "image/heic", getAsFile: () => image }],
      files: [image],
    } as unknown as DataTransfer;

    expect(getAssistantImageFilesFromClipboard(clipboard)).toEqual([image]);
    expect(validateAssistantImageFile(image)).toContain("不是支持的");
  });

  it("rejects unsupported or oversized files before invoking Tauri", () => {
    expect(validateAssistantImageFile(file("photo.heic", "image/heic", 128))).toContain("不是支持的");
    expect(validateAssistantImageFile(file("huge.png", "image/png", 20 * 1024 * 1024 + 1))).toContain("超过了 20 MB");
    expect(validateAssistantImageFile(file("ok.png", "image/png", 128))).toBeNull();
  });

  it("keeps current images when rebuilding a new model thread and annotates text context", () => {
    const history = Array.from({ length: 8 }, (_, index) => attachment(`history-${index}.png`));
    const current = attachment("current.png");
    const messages: ChatMessage[] = [{ id: "1", role: "user", content: "参考这些", images: history }];

    const paths = collectAssistantImagePaths(messages, [current], true);
    expect(paths).toHaveLength(8);
    expect(paths.at(-1)).toBe(current.path);
    expect(formatAssistantMessageForContext(messages[0])).toContain("图片附件：history-0.png");
  });
});

function file(name: string, type: string, size: number): File {
  return { name, type, size } as File;
}

function attachment(name: string): AiImageAttachment {
  return {
    id: `/tmp/loby/${name}`,
    name,
    path: `/tmp/loby/${name}`,
    mimeType: "image/png",
    sizeBytes: 128,
  };
}
