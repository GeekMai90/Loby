/**
 * [INPUT]: 依赖 clsx/React、assistant message/run/attachment 契约与 user message 表面 Token
 * [OUTPUT]: 对外提供 AssistantMessageBody、AssistantStaticMessage、AssistantPendingIndicator
 * [POS]: AI 助手 feature 的界面组合单元，连接 AI 助手状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import clsx from "clsx";
import type { ReactNode } from "react";
import { assistantMessageRootClassName, type AssistantMessageSurfaceRole } from "@/features/assistant/model/assistantMessageStyles";
import type { AgentRunInfo, AiAttachment } from "@/shared/types";
import { AssistantAttachments } from "@/features/assistant/components/AssistantAttachments";
import { AssistantRunPanel } from "@/features/assistant/components/AssistantRunPanel";
import { AssistantGridLoader } from "@/features/assistant/components/AssistantGridLoader";

interface AssistantMessageBodyProps {
  role: AssistantMessageSurfaceRole;
  hasContent: boolean;
  attachments?: AiAttachment[];
  error?: boolean;
  children: ReactNode;
}

export function AssistantMessageBody({ role, hasContent, attachments = [], error = false, children }: AssistantMessageBodyProps) {
  return (
    <>
      {role === "user" && attachments.length > 0 ? <AssistantAttachments attachments={attachments} size="message" /> : null}
      {hasContent ? (
        <div
          className={clsx(
            "text-app-base",
            error ? "text-destructive" : "text-foreground",
            role === "user" &&
              "w-fit max-w-[calc(100%-28px)] rounded-md bg-[var(--assistant-user-message-bg)] px-3 py-2 shadow-[var(--assistant-user-message-shadow)]",
          )}
        >
          {children}
        </div>
      ) : null}
    </>
  );
}

interface AssistantStaticMessageProps {
  role: "user" | "assistant";
  content: string;
  attachments?: AiAttachment[];
  run?: AgentRunInfo;
  error?: boolean;
  pending?: boolean;
}

export function AssistantStaticMessage({ role, content, attachments, run, error = false, pending = false }: AssistantStaticMessageProps) {
  const surfaceRole: AssistantMessageSurfaceRole = error ? "system" : role;
  return (
    <div data-slot="assistant-message" className={assistantMessageRootClassName(surfaceRole, error)}>
      {run ? <AssistantRunPanel run={run} /> : null}
      <AssistantMessageBody role={surfaceRole} hasContent={pending || Boolean(content)} attachments={attachments} error={error}>
        {pending ? <AssistantPendingIndicator label="正在处理" /> : content}
      </AssistantMessageBody>
    </div>
  );
}

export function AssistantPendingIndicator({ label }: { label?: string }) {
  return (
    <span className="assistant-thinking" aria-label={label}>
      <AssistantGridLoader />
    </span>
  );
}
