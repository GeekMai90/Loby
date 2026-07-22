/**
 * [INPUT]: 依赖 lucide-react、AI 助手模块、shared 公共契约
 * [OUTPUT]: 对外提供 AssistantMessageContextPreview
 * [POS]: AI 助手 feature 的界面组合单元，连接 AI 助手状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { FileText, TextSelect } from "lucide-react";
import {
  getChatContextContentModeDescription,
  getChatContextContentModeLabel,
  getChatContextDisplayDescription,
  getChatContextDisplayLabel,
} from "@/features/assistant/model/assistantContext";
import type { ChatContextPreview } from "@/shared/types";

export function AssistantMessageContextPreview({ contexts }: { contexts: ChatContextPreview[] }) {
  return (
    <div className="mb-2 flex w-fit max-w-[min(360px,calc(100%-56px))] min-w-0 flex-wrap justify-end gap-1.5 overflow-hidden">
      {contexts.map((context) => {
        const ContextIcon = context.type === "selection" ? TextSelect : FileText;
        const contentModeLabel = getChatContextContentModeLabel(context);
        const displayLabel = getChatContextDisplayLabel(context);
        const displayDescription = getChatContextDisplayDescription(context);
        return (
          <div
            key={context.id}
            className="inline-flex min-h-7.5 max-w-full min-w-0 items-center gap-1.5 overflow-hidden rounded-lg border border-foreground/10 bg-secondary/85 px-2.5 text-muted-foreground shadow-[0_1px_2px_rgb(0_0_0_/_3%)] [&_svg]:shrink-0"
            title={displayDescription}
            aria-label={displayDescription}
          >
            <ContextIcon size={12} />
            <span className="block max-w-[min(300px,calc(100vw-180px))] min-w-0 truncate text-xs font-semibold">{displayLabel}</span>
            <small
              className="shrink-0 text-[11px] font-semibold text-muted-foreground/70"
              title={getChatContextContentModeDescription(context)}
            >
              {contentModeLabel}
            </small>
          </div>
        );
      })}
    </div>
  );
}
