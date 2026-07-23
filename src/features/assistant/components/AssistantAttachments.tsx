/**
 * [INPUT]: 依赖 lucide-react、shadcn/ui 基础控件、通用附件预览模型与 shared 附件契约
 * [OUTPUT]: 对外提供 AssistantAttachments
 * [POS]: AI 助手 feature 的附件呈现组件，图片使用缩略图，文档使用紧凑文件卡片并共享移除行为
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { assistantAttachmentPreviewSource } from "@/features/assistant/model/assistantAttachments";
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
          <div
            key={attachment.id}
            className="group/attachment flex h-9 min-w-0 max-w-full items-center gap-2 rounded-lg border border-border bg-card/70 px-2"
            title={`${attachment.name} · ${formatAttachmentSize(attachment.sizeBytes)}`}
          >
            <FileText className="shrink-0 text-muted-foreground" size={15} />
            <span className="max-w-44 min-w-0 truncate text-caption text-foreground">{attachment.name}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{formatAttachmentSize(attachment.sizeBytes)}</span>
            <AttachmentRemoveButton attachment={attachment} onRemove={onRemove} inline />
          </div>
        ),
      )}
    </div>
  );
}

function AttachmentRemoveButton({
  attachment,
  onRemove,
  inline = false,
}: {
  attachment: AiAttachment;
  onRemove?: (id: string) => void;
  inline?: boolean;
}) {
  if (!onRemove) return null;
  return (
    <Button
      type="button"
      variant={inline ? "ghost" : "secondary"}
      size="icon-xs"
      className={
        inline
          ? "-mr-1 size-5 shrink-0 rounded-full"
          : "absolute top-1 right-1 size-5 rounded-full bg-background/88 opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover/attachment:opacity-100 focus-visible:opacity-100"
      }
      onClick={() => onRemove(attachment.id)}
      title={`移除 ${attachment.name}`}
    >
      <X />
    </Button>
  );
}

function formatAttachmentSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(sizeBytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
