/**
 * [INPUT]: 依赖 lucide-react、AssistantComposerMountedItem、附件领域的预览与粘贴识别 helper、shared 附件契约
 * [OUTPUT]: 对外提供 AssistantAttachments
 * [POS]: AI 助手 feature 的附件呈现组件，图片使用缩略图，文档使用紧凑文件卡片并共享移除行为
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { ClipboardList, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssistantComposerMountedItem } from "@/features/assistant/components/AssistantComposerMountedItems";
import { assistantAttachmentPreviewSource, isAssistantPastedTextAttachment } from "@/features/assistant/model/assistantAttachments";
import type { AiAttachment } from "@/shared/types";

interface AssistantAttachmentsProps {
  attachments: AiAttachment[];
  onRemove?: (id: string) => void;
  size?: "composer" | "message";
}

export function AssistantAttachments({ attachments, onRemove, size = "composer" }: AssistantAttachmentsProps) {
  if (attachments.length === 0) return null;
  const imageSize = size === "message" ? "size-24" : "size-16";

  return (
    <div className="flex max-w-full flex-wrap gap-1.5" aria-label="附件">
      {attachments.map((attachment) =>
        attachment.kind === "image" ? (
          <figure
            key={attachment.id}
            className={`group/attachment relative overflow-hidden rounded-xl border border-border bg-muted ${imageSize}`}
            title={attachment.name}
          >
            <img src={assistantAttachmentPreviewSource(attachment)} alt={attachment.name} className="size-full object-cover" />
            <AttachmentRemoveButton attachment={attachment} onRemove={onRemove} />
          </figure>
        ) : (
          <AssistantComposerMountedItem
            key={attachment.id}
            icon={isAssistantPastedTextAttachment(attachment) ? ClipboardList : FileText}
            label={attachment.name}
            title={attachment.name}
            onRemove={onRemove ? () => onRemove(attachment.id) : undefined}
            removeTitle="移除附件"
          />
        ),
      )}
    </div>
  );
}

function AttachmentRemoveButton({ attachment, onRemove }: { attachment: AiAttachment; onRemove?: (id: string) => void }) {
  if (!onRemove) return null;
  return (
    <Button
      type="button"
      variant="secondary"
      size="icon-xs"
      className="absolute top-1 right-1 size-5 rounded-full bg-background/88 opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover/attachment:opacity-100 focus-visible:opacity-100"
      onClick={() => onRemove(attachment.id)}
      title={`移除 ${attachment.name}`}
    >
      <X />
    </Button>
  );
}
