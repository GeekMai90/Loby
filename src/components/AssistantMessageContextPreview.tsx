import clsx from "clsx";
import { FileText, TextSelect } from "lucide-react";
import {
  getChatContextContentModeDescription,
  getChatContextContentModeLabel,
  getChatContextDisplayDescription,
  getChatContextDisplayLabel,
} from "../lib/assistantContext";
import type { ChatContextPreview } from "../types";

export function AssistantMessageContextPreview({ contexts }: { contexts: ChatContextPreview[] }) {
  return (
    <div className="assistant-message-contexts">
      {contexts.map((context) => {
        const ContextIcon = context.type === "selection" ? TextSelect : FileText;
        const contentModeLabel = getChatContextContentModeLabel(context);
        const displayLabel = getChatContextDisplayLabel(context);
        const displayDescription = getChatContextDisplayDescription(context);
        return (
          <div
            key={context.id}
            className={clsx("assistant-message-context", context.type)}
            title={displayDescription}
            aria-label={displayDescription}
          >
            <ContextIcon size={12} />
            <span>{displayLabel}</span>
            <small title={getChatContextContentModeDescription(context)}>{contentModeLabel}</small>
          </div>
        );
      })}
    </div>
  );
}
