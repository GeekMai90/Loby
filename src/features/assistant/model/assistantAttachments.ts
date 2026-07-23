/**
 * [INPUT]: 依赖 Tauri API、shared 公共契约、写作库模块
 * [OUTPUT]: 对外提供通用附件数量/大小/类型约束、剪贴板与拖放提取、校验、临时保存、预览和上下文格式化能力
 * [POS]: AI 助手 feature 的附件领域边界，把图片与文档统一为单一前端模型并保持 Codex 输入路径受控
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import type { AiAttachment, ChatMessage } from "@/shared/types";
import { isImageFile } from "@/features/library/model/imageAssets";

export const MAX_ASSISTANT_ATTACHMENTS = 8;
export const MAX_ASSISTANT_ATTACHMENT_BYTES = 20 * 1024 * 1024;
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
