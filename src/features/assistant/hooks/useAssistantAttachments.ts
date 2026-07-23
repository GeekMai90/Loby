/**
 * [INPUT]: 依赖 React 运行时、AI 助手模块、shared 公共契约
 * [OUTPUT]: 对外提供 useAssistantAttachments
 * [POS]: AI 助手 feature 的附件协调边界，串行保存图片/文档并管理临时预览与移除动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useRef, useState } from "react";
import {
  MAX_ASSISTANT_ATTACHMENTS,
  removeAssistantAttachment,
  saveAssistantAttachment,
  validateAssistantAttachmentFile,
} from "@/features/assistant/model/assistantAttachments";
import type { AiAttachment } from "@/shared/types";

export function useAssistantAttachments() {
  const [attachments, setAttachments] = useState<AiAttachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const attachmentsRef = useRef(attachments);
  const queueRef = useRef(Promise.resolve());

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  function addFiles(files: File[]) {
    const nextTask = queueRef.current.then(async () => {
      setError("");
      setSaving(true);
      try {
        const available = MAX_ASSISTANT_ATTACHMENTS - attachmentsRef.current.length;
        if (available <= 0) {
          setError(`一次最多添加 ${MAX_ASSISTANT_ATTACHMENTS} 个附件。`);
          return;
        }
        const candidates = files.slice(0, available);
        if (files.length > available) setError(`一次最多添加 ${MAX_ASSISTANT_ATTACHMENTS} 个附件。`);
        for (const file of candidates) {
          const validationError = validateAssistantAttachmentFile(file);
          if (validationError) {
            setError(validationError);
            continue;
          }
          try {
            const attachment = await saveAssistantAttachment(file);
            let previewUrl: string | undefined;
            if (attachment.kind === "image") {
              try {
                previewUrl = typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(file) : undefined;
              } catch {
                previewUrl = undefined;
              }
            }
            const attachmentWithPreview = { ...attachment, previewUrl };
            attachmentsRef.current = [...attachmentsRef.current, attachmentWithPreview];
            setAttachments(attachmentsRef.current);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
          }
        }
      } finally {
        setSaving(false);
      }
    });
    queueRef.current = nextTask.catch(() => undefined);
    return nextTask;
  }

  function removeAttachment(id: string) {
    const removed = attachmentsRef.current.find((attachment) => attachment.id === id);
    attachmentsRef.current = attachmentsRef.current.filter((attachment) => attachment.id !== id);
    setAttachments(attachmentsRef.current);
    setError("");
    if (removed) {
      if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      void removeAssistantAttachment(removed.path).catch(() => undefined);
    }
  }

  function clearAttachments() {
    attachmentsRef.current = [];
    setAttachments([]);
    setError("");
  }

  return {
    attachments,
    saving,
    error,
    addFiles,
    removeAttachment,
    clearAttachments,
  };
}
