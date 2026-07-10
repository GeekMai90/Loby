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
        <dl className="assistant-action-payload">
          {preview.fields.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {preview.excerpt && <div className="assistant-action-excerpt">{preview.excerpt}</div>}
    </>
  );
}
