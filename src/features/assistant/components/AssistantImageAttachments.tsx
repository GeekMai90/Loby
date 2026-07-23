/**
 * [INPUT]: 依赖通用附件呈现组件与 shared 图片附件契约
 * [OUTPUT]: 对外提供 AssistantImageAttachments
 * [POS]: 微信主题助手的 image-only 兼容适配层
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { AssistantAttachments } from "@/features/assistant/components/AssistantAttachments";
import type { AiImageAttachment } from "@/shared/types";

export function AssistantImageAttachments({
  attachments,
  onRemove,
  size = "composer",
}: {
  attachments: AiImageAttachment[];
  onRemove?: (id: string) => void;
  size?: "composer" | "message";
}) {
  return <AssistantAttachments attachments={attachments} onRemove={onRemove} size={size} />;
}
