/**
 * [INPUT]: 依赖通用附件 hook 与 image-only 兼容校验
 * [OUTPUT]: 对外提供 useAssistantImageAttachments
 * [POS]: 微信主题助手的图片限定适配层，主 AI 助手使用通用附件 hook
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useAssistantAttachments } from "@/features/assistant/hooks/useAssistantAttachments";
import { isImageFile } from "@/features/library/model/imageAssets";
import type { AiImageAttachment } from "@/shared/types";

export function useAssistantImageAttachments() {
  const state = useAssistantAttachments();
  return {
    ...state,
    attachments: state.attachments.filter((attachment): attachment is AiImageAttachment => attachment.kind === "image"),
    addFiles: (files: File[]) => state.addFiles(files.filter(isImageFile)),
  };
}
