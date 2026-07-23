import { describe, expect, it } from "vitest";
import {
  collectAssistantAttachmentPaths,
  formatAssistantMessageForContext,
  getAssistantFilesFromClipboard,
  getAssistantFilesFromDataTransfer,
  validateAssistantAttachmentFile,
} from "@/features/assistant/model/assistantAttachments";
import type { AiAttachment, ChatMessage } from "@/shared/types";

describe("assistant attachments", () => {
  it("extracts pasted files instead of clipboard path text", () => {
    const image = file("clipboard.png", "image/png", 128);
    const document = file("draft.pdf", "application/pdf", 256);
    const clipboard = {
      items: [
        { kind: "string", type: "text/plain", getAsFile: () => null },
        { kind: "file", type: "image/png", getAsFile: () => image },
        { kind: "file", type: "application/pdf", getAsFile: () => document },
      ],
      files: [],
    } as unknown as DataTransfer;

    expect(getAssistantFilesFromClipboard(clipboard)).toEqual([image, document]);
  });

  it("reads PDF and DOCX files from drag and drop", () => {
    const pdf = file("brief.pdf", "application/pdf", 128);
    const docx = file("brief.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 128);
    const transfer = {
      files: [pdf, docx],
    } as unknown as DataTransfer;

    expect(getAssistantFilesFromDataTransfer(transfer)).toEqual([pdf, docx]);
    expect(validateAssistantAttachmentFile(pdf)).toBeNull();
    expect(validateAssistantAttachmentFile(docx)).toBeNull();
  });

  it("rejects unsupported or oversized files before invoking Tauri", () => {
    expect(validateAssistantAttachmentFile(file("archive.zip", "application/zip", 128))).toContain("不是支持的");
    expect(validateAssistantAttachmentFile(file("huge.pdf", "application/pdf", 20 * 1024 * 1024 + 1))).toContain("超过了 20 MB");
    expect(validateAssistantAttachmentFile(file("ok.png", "image/png", 128))).toBeNull();
  });

  it("keeps current attachments when rebuilding a new model thread and annotates text context", () => {
    const history = Array.from({ length: 7 }, (_, index) => attachment(`history-${index}.png`, "image"));
    const current = attachment("current.pdf", "document");
    const messages: ChatMessage[] = [{ id: "1", role: "user", content: "参考这些", attachments: history }];

    const paths = collectAssistantAttachmentPaths(messages, [current], true);
    expect(paths).toHaveLength(8);
    expect(paths.at(-1)).toBe(current.path);
    expect(formatAssistantMessageForContext(messages[0])).toContain("附件：history-0.png");
    expect(formatAssistantMessageForContext({ role: "user", content: "", attachments: [current] })).toContain("current.pdf");
  });
});

function file(name: string, type: string, size: number): File {
  return { name, type, size } as File;
}

function attachment(name: string, kind: AiAttachment["kind"]): AiAttachment {
  return {
    id: `/tmp/loby/${name}`,
    name,
    path: `/tmp/loby/${name}`,
    mimeType: kind === "image" ? "image/png" : "application/pdf",
    sizeBytes: 128,
    kind,
  };
}
