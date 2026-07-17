import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { assistantImagePreviewSource } from "../lib/assistantImageAttachments";
import type { AiImageAttachment } from "../types";

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
