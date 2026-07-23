/**
 * [INPUT]: 依赖通用附件模型、shared 公共契约与写作库图片识别能力
 * [OUTPUT]: 对外提供微信主题助手仍需的 image-only 兼容契约
 * [POS]: AI 助手 feature 的图片兼容边界，不承担主助手通用附件入口
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AiImageAttachment } from "@/shared/types";
import { isImageFile } from "@/features/library/model/imageAssets";
import {
  MAX_ASSISTANT_ATTACHMENTS,
  MAX_ASSISTANT_ATTACHMENT_BYTES,
  assistantAttachmentPreviewSource,
  removeAssistantAttachment,
  saveAssistantAttachment,
} from "@/features/assistant/model/assistantAttachments";

export const MAX_ASSISTANT_IMAGE_ATTACHMENTS = MAX_ASSISTANT_ATTACHMENTS;
export const MAX_ASSISTANT_IMAGE_BYTES = MAX_ASSISTANT_ATTACHMENT_BYTES;
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
  const attachment = await saveAssistantAttachment(file);
  if (attachment.kind !== "image") throw new Error("图片附件类型识别失败。");
  return attachment as AiImageAttachment;
}

export const removeAssistantImageAttachment = removeAssistantAttachment;
export const assistantImagePreviewSource = assistantAttachmentPreviewSource;

export function collectAssistantImagePaths(
  messages: Array<{ images?: AiImageAttachment[] }>,
  currentImages: AiImageAttachment[],
  includeHistory: boolean,
): string[] {
  const images = includeHistory ? [...messages.flatMap((message) => message.images ?? []), ...currentImages] : currentImages;
  return Array.from(new Set(images.map((image) => image.path))).slice(-MAX_ASSISTANT_IMAGE_ATTACHMENTS);
}

export function formatAssistantMessageForContext(message: {
  role: "user" | "assistant" | "system";
  content: string;
  images?: AiImageAttachment[];
}): string {
  const imageNames = message.images?.map((image) => image.name).filter(Boolean) ?? [];
  const attachmentNote = imageNames.length > 0 ? ` [图片附件：${imageNames.join("、")}]` : "";
  return `${message.role}: ${message.content}${attachmentNote}`;
}
