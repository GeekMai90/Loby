import clsx from "clsx";
import type { ReactNode } from "react";
import { assistantMessageRootClassName, type AssistantMessageSurfaceRole } from "../lib/assistantMessageStyles";
import type { AgentRunInfo, AiImageAttachment } from "../types";
import { AssistantImageAttachments } from "./AssistantImageAttachments";
import { AssistantRunPanel } from "./AssistantRunPanel";
import { AssistantGridLoader } from "./AssistantGridLoader";

interface AssistantMessageBodyProps {
  role: AssistantMessageSurfaceRole;
  hasContent: boolean;
  images?: AiImageAttachment[];
  error?: boolean;
  children: ReactNode;
}

export function AssistantMessageBody({ role, hasContent, images = [], error = false, children }: AssistantMessageBodyProps) {
  return (
    <>
      {role === "user" && images.length > 0 ? <AssistantImageAttachments attachments={images} size="message" /> : null}
      {hasContent ? (
        <div
          className={clsx(
            "text-sm",
            error ? "text-destructive" : "text-foreground",
            role === "user" &&
              "w-fit max-w-[calc(100%-28px)] rounded-lg bg-[var(--assistant-user-message-bg)] px-3 py-2.5 shadow-[0_1px_2px_rgb(0_0_0_/_3%)]",
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
  images?: AiImageAttachment[];
  run?: AgentRunInfo;
  error?: boolean;
  pending?: boolean;
}

export function AssistantStaticMessage({ role, content, images, run, error = false, pending = false }: AssistantStaticMessageProps) {
  const surfaceRole: AssistantMessageSurfaceRole = error ? "system" : role;
  return (
    <div data-slot="assistant-message" className={assistantMessageRootClassName(surfaceRole, error)}>
      {run ? <AssistantRunPanel run={run} /> : null}
      <AssistantMessageBody role={surfaceRole} hasContent={pending || Boolean(content)} images={images} error={error}>
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
