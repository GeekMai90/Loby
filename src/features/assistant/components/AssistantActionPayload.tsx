/**
 * [INPUT]: 依赖 AI 助手模块、shared 公共契约
 * [OUTPUT]: 对外提供 AssistantActionPayload
 * [POS]: AI 助手 feature 的界面组合单元，连接 AI 助手状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { buildAiActionPreview } from "@/features/assistant/model/aiActionPreview";
import type { InsertImageActionPreview } from "@/features/assistant/model/assistantActionImagePreview";
import type { AiAction } from "@/shared/types";
import { AssistantActionImagePreview } from "@/features/assistant/components/AssistantActionImagePreview";

interface AssistantActionPayloadProps {
  action: AiAction;
  imagePreview: InsertImageActionPreview | null;
}

export function AssistantActionPayload({ action, imagePreview }: AssistantActionPayloadProps) {
  const preview = buildAiActionPreview(action);
  if (preview.fields.length === 0 && !preview.excerpt) return null;
  return (
    <>
      {imagePreview && <AssistantActionImagePreview preview={imagePreview} />}
      {preview.fields.length > 0 && (
        <dl className="mt-1.75 grid max-w-full min-w-0 gap-0.75">
          {preview.fields.map(([label, value]) => (
            <div key={label} className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)] gap-1.5 text-[11px] text-muted-foreground">
              <dt className="text-muted-foreground/70">{label}</dt>
              <dd className="m-0 min-w-0 truncate">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {preview.excerpt && (
        <div className="mt-1.75 line-clamp-2 max-h-14 w-full max-w-full min-w-0 overflow-hidden rounded-lg border border-foreground/10 bg-muted/40 px-1.75 py-1.5 text-[11px] leading-[1.45] text-muted-foreground">
          {preview.excerpt}
        </div>
      )}
    </>
  );
}
