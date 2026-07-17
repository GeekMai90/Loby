import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import type { AiImageAttachment, ChatMessage } from "../types";
import { isImageFile } from "./imageAssets";

export const MAX_ASSISTANT_IMAGE_ATTACHMENTS = 8;
export const MAX_ASSISTANT_IMAGE_BYTES = 20 * 1024 * 1024;
export const ASSISTANT_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

const SUPPORTED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const SUPPORTED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif"]);

export function getAssistantImageFilesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return [];
  const itemFiles = Array.from(data.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file && isImageFile(file)));
  return itemFiles.length > 0 ? itemFiles : getAssistantImageFilesFromDataTransfer(data);
}

export function getAssistantImageFilesFromDataTransfer(data: DataTransfer | null): File[] {
  if (!data) return [];
  return Array.from(data.files).filter(isImageFile);
}

export function isSupportedAssistantImageFile(file: File): boolean {
  if (!isImageFile(file)) return false;
  if (SUPPORTED_MIME_TYPES.has(file.type.toLowerCase())) return true;
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  return Boolean(extension && SUPPORTED_EXTENSIONS.has(extension));
}

export function validateAssistantImageFile(file: File): string | null {
  if (!isSupportedAssistantImageFile(file)) return `${file.name || "这张图片"} 不是支持的 PNG、JPEG、WebP 或 GIF。`;
  if (file.size === 0) return `${file.name || "这张图片"} 内容为空。`;
  if (file.size > MAX_ASSISTANT_IMAGE_BYTES) return `${file.name || "这张图片"} 超过了 20 MB。`;
  return null;
}

export async function saveAssistantImageAttachment(file: File): Promise<AiImageAttachment> {
  const validationError = validateAssistantImageFile(file);
  if (validationError) throw new Error(validationError);
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  return invoke<AiImageAttachment>("save_ai_image_attachment", {
    filename: file.name || `clipboard-${Date.now()}.png`,
    mimeType: file.type,
    bytes,
  });
}

export async function removeAssistantImageAttachment(path: string): Promise<void> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
  await invoke("remove_ai_image_attachment", { path });
}

export function assistantImagePreviewSource(attachment: AiImageAttachment): string {
  if (attachment.previewUrl) return attachment.previewUrl;
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window ? convertFileSrc(attachment.path) : attachment.path;
}

export function collectAssistantImagePaths(messages: ChatMessage[], currentImages: AiImageAttachment[], includeHistory: boolean): string[] {
  const images = includeHistory ? [...messages.flatMap((message) => message.images ?? []), ...currentImages] : currentImages;
  return Array.from(new Set(images.map((image) => image.path))).slice(-MAX_ASSISTANT_IMAGE_ATTACHMENTS);
}

export function formatAssistantMessageForContext(message: Pick<ChatMessage, "role" | "content" | "images">): string {
  const imageNames = message.images?.map((image) => image.name).filter(Boolean) ?? [];
  const attachmentNote = imageNames.length > 0 ? ` [图片附件：${imageNames.join("、")}]` : "";
  return `${message.role}: ${message.content}${attachmentNote}`;
}
