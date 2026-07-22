/**
 * [INPUT]: 依赖 lucide-react、shadcn/ui 基础控件、AI 助手模块、shared 公共契约
 * [OUTPUT]: 对外提供 AssistantImageAttachments
 * [POS]: AI 助手 feature 的界面组合单元，连接 AI 助手状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { assistantImagePreviewSource } from "@/features/assistant/model/assistantImageAttachments";
import type { AiImageAttachment } from "@/shared/types";

interface AssistantImageAttachmentsProps {
  attachments: AiImageAttachment[];
  onRemove?: (id: string) => void;
  size?: "composer" | "message";
}

export function AssistantImageAttachments({ attachments, onRemove, size = "composer" }: AssistantImageAttachmentsProps) {
  if (attachments.length === 0) return null;
  const imageSize = size === "message" ? "size-24" : "size-16";

  return (
    <div className="flex max-w-full flex-wrap gap-1.5" aria-label="图片附件">
      {attachments.map((attachment) => (
        <figure
          key={attachment.id}
          className={`group/image relative overflow-hidden rounded-xl border border-border bg-muted ${imageSize}`}
          title={attachment.name}
        >
          <img src={assistantImagePreviewSource(attachment)} alt={attachment.name} className="size-full object-cover" />
          {onRemove && (
            <Button
              type="button"
              variant="secondary"
              size="icon-xs"
              className="absolute top-1 right-1 size-5 rounded-full bg-background/88 opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover/image:opacity-100 focus-visible:opacity-100"
              onClick={() => onRemove(attachment.id)}
              title={`移除 ${attachment.name}`}
            >
              <X />
            </Button>
          )}
        </figure>
      ))}
    </div>
  );
}
