import { buildAiActionPreview } from "../lib/aiActionPreview";
import type { InsertImageActionPreview } from "../lib/assistantActionImagePreview";
import type { AiAction } from "../types";
import { AssistantActionImagePreview } from "./AssistantActionImagePreview";

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
