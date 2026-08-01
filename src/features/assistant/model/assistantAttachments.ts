/**
 * [INPUT]: 依赖 Tauri API、shared 公共契约、写作库模块
 * [OUTPUT]: 对外提供通用附件约束、文件与长文本剪贴板提取、Markdown 临时附件转换、校验、受管持久化、预览和上下文格式化
 * [POS]: AI 助手 feature 的附件领域边界，把图片与文档统一为单一模型，并在 IPC 边界区分 composer 临时文件与历史稳定文件
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import type { AiAttachment, ChatMessage } from "@/shared/types";
import { isImageFile } from "@/features/library/model/imageAssets";

export const MAX_ASSISTANT_ATTACHMENTS = 8;
export const MAX_ASSISTANT_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const ASSISTANT_LONG_PASTE_CHARACTER_THRESHOLD = 2_000;
export const ASSISTANT_LONG_PASTE_LINE_THRESHOLD = 40;
export const ASSISTANT_PASTED_TEXT_FILENAME = "粘贴内容.md";
const ASSISTANT_PASTED_TEXT_FILENAME_PATTERN = /^粘贴内容(?:-[0-9a-f]{8})?\.md$/i;
export const ASSISTANT_ATTACHMENT_ACCEPT = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  ".pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc",
  ".docx",
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
].join(",");

const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const SUPPORTED_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const SUPPORTED_DOCUMENT_EXTENSIONS = new Set(["pdf", "doc", "docx", "txt", "md", "markdown", "csv", "json"]);

export function getAssistantFilesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return [];
  const itemFiles = Array.from(data.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
  return itemFiles.length > 0 ? itemFiles : getAssistantFilesFromDataTransfer(data);
}

export function getAssistantFilesFromDataTransfer(data: DataTransfer | null): File[] {
  if (!data) return [];
  return Array.from(data.files);
}

export function getAssistantTextFromClipboard(data: DataTransfer | null): string {
  if (!data) return "";
  return data.getData("text/plain") || data.getData("text/markdown");
}

export function shouldMountAssistantPastedText(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  return (
    normalized.length >= ASSISTANT_LONG_PASTE_CHARACTER_THRESHOLD || normalized.split(/\r?\n/).length >= ASSISTANT_LONG_PASTE_LINE_THRESHOLD
  );
}

export function createAssistantPastedTextFile(text: string): File {
  return new File([text], ASSISTANT_PASTED_TEXT_FILENAME, { type: "text/markdown" });
}

export function isAssistantPastedTextAttachment(attachment: Pick<AiAttachment, "name" | "mimeType">): boolean {
  return attachment.mimeType === "text/markdown" && ASSISTANT_PASTED_TEXT_FILENAME_PATTERN.test(attachment.name);
}

export function isSupportedAssistantAttachmentFile(file: File): boolean {
  const extension = attachmentExtension(file.name);
  if (isImageFile(file)) {
    return SUPPORTED_IMAGE_MIME_TYPES.has(file.type.toLowerCase()) || SUPPORTED_IMAGE_EXTENSIONS.has(extension);
  }
  return SUPPORTED_DOCUMENT_EXTENSIONS.has(extension);
}

export function validateAssistantAttachmentFile(file: File): string | null {
  if (!isSupportedAssistantAttachmentFile(file)) {
    return `${file.name || "这个附件"} 不是支持的图片、PDF、Word、TXT、Markdown、CSV 或 JSON。`;
  }
  if (file.size === 0) return `${file.name || "这个附件"} 内容为空。`;
  if (file.size > MAX_ASSISTANT_ATTACHMENT_BYTES) return `${file.name || "这个附件"} 超过了 20 MB。`;
  return null;
}

export async function saveAssistantAttachment(file: File): Promise<AiAttachment> {
  const validationError = validateAssistantAttachmentFile(file);
  if (validationError) throw new Error(validationError);
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  return invoke<AiAttachment>("save_ai_attachment", {
    filename: file.name || `attachment-${Date.now()}`,
    mimeType: file.type,
    bytes,
  });
}

export async function persistAssistantAttachments(libraryPath: string, attachments: AiAttachment[]): Promise<AiAttachment[]> {
  if (attachments.length === 0 || typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return attachments;
  return invoke<AiAttachment[]>("persist_ai_attachments", { path: libraryPath, attachments });
}

export async function removeAssistantAttachment(path: string): Promise<void> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
  await invoke("remove_ai_attachment", { path });
}

export function assistantAttachmentPreviewSource(attachment: AiAttachment): string {
  if (attachment.previewUrl) return attachment.previewUrl;
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window ? convertFileSrc(attachment.path) : attachment.path;
}

export function collectAssistantAttachmentPaths(
  messages: ChatMessage[],
  currentAttachments: AiAttachment[],
  includeHistory: boolean,
): string[] {
  const attachments = includeHistory
    ? [...messages.flatMap((message) => message.attachments ?? []), ...currentAttachments]
    : currentAttachments;
  return Array.from(new Set(attachments.map((attachment) => attachment.path))).slice(-MAX_ASSISTANT_ATTACHMENTS);
}

export function formatAssistantMessageForContext(message: Pick<ChatMessage, "role" | "content" | "attachments">): string {
  const attachmentNames = message.attachments?.map((attachment) => attachment.name).filter(Boolean) ?? [];
  const attachmentNote = attachmentNames.length > 0 ? ` [附件：${attachmentNames.join("、")}]` : "";
  return `${message.role}: ${message.content}${attachmentNote}`;
}

function attachmentExtension(filename: string): string {
  return filename.split(".").at(-1)?.toLowerCase() ?? "";
}
