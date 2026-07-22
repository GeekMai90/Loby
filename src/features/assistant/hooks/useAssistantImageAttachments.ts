/**
 * [INPUT]: 依赖 React 运行时、AI 助手模块、shared 公共契约
 * [OUTPUT]: 对外提供 useAssistantImageAttachments
 * [POS]: AI 助手 feature 的React 协调边界，封装 AI 助手 状态、副作用与用户动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useRef, useState } from "react";
import {
  MAX_ASSISTANT_IMAGE_ATTACHMENTS,
  removeAssistantImageAttachment,
  saveAssistantImageAttachment,
  validateAssistantImageFile,
} from "@/features/assistant/model/assistantImageAttachments";
import type { AiImageAttachment } from "@/shared/types";

export function useAssistantImageAttachments() {
  const [attachments, setAttachments] = useState<AiImageAttachment[]>([]);
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
        const available = MAX_ASSISTANT_IMAGE_ATTACHMENTS - attachmentsRef.current.length;
        if (available <= 0) {
          setError(`一次最多添加 ${MAX_ASSISTANT_IMAGE_ATTACHMENTS} 张图片。`);
          return;
        }
        const candidates = files.slice(0, available);
        if (files.length > available) setError(`一次最多添加 ${MAX_ASSISTANT_IMAGE_ATTACHMENTS} 张图片。`);
        for (const file of candidates) {
          const validationError = validateAssistantImageFile(file);
          if (validationError) {
            setError(validationError);
            continue;
          }
          try {
            const attachment = await saveAssistantImageAttachment(file);
            let previewUrl: string | undefined;
            try {
              previewUrl = typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(file) : undefined;
            } catch {
              previewUrl = undefined;
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
      void removeAssistantImageAttachment(removed.path).catch(() => undefined);
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
