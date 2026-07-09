import { useContext, useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import clsx from "clsx";
import { Download, FilePlus2, ImagePlus, Pencil } from "lucide-react";
import { buildAiActionCardState } from "../lib/aiActionCardState";
import { buildAiActionPreview } from "../lib/aiActionPreview";
import { aiActionApplyLabel, aiActionStatusLabel } from "../lib/aiActionState";
import { resolveSheetImageSourcePath } from "../lib/imageAssets";
import type { AiAction, WritingProject, WritingSheet } from "../types";
import { AssistantActionActionsContext, AssistantActionTargetContext } from "./AssistantMessageContexts";

export function AssistantActionCards({ actions }: { actions: AiAction[] }) {
  const { onApplyAction, onRejectAction, onRevertAction, onOpenActionTarget } = useContext(AssistantActionActionsContext);
  const actionTargetContext = useContext(AssistantActionTargetContext);
  return (
    <div className="assistant-action-cards">
      {actions.map((action) => {
        const ActionIcon =
          action.type === "createSheet"
            ? FilePlus2
            : action.type === "insertText"
              ? Pencil
              : action.type === "insertImage"
                ? ImagePlus
                : Download;
        const cardState = buildAiActionCardState(action, actionTargetContext);
        return (
          <div
            key={action.id}
            className={clsx(
              "assistant-action-card",
              action.status === "failed" && "failed",
              action.status === "applying" && "applying",
              cardState.invalid && "invalid",
            )}
          >
            <div className="assistant-action-content">
              <div className="assistant-action-title">
                <div className="assistant-action-title-main">
                  <span className="assistant-action-icon">
                    <ActionIcon size={15} />
                  </span>
                  <span>{action.title}</span>
                </div>
                <strong>{aiActionStatusLabel(action.status)}</strong>
              </div>
              <p>{action.summary}</p>
              {(action.status === "applied" || action.status === "reverted") && action.result && (
                <div className="assistant-action-result">{action.result}</div>
              )}
              {action.status === "failed" && action.error && <div className="assistant-action-error">{action.error}</div>}
              {action.status !== "failed" && action.error && <div className="assistant-action-error">{action.error}</div>}
              {cardState.showTargetWarning && cardState.targetWarning && (
                <div className="assistant-action-warning">{cardState.targetWarning}</div>
              )}
              {cardState.showValidationWarning && <div className="assistant-action-warning">{cardState.validationIssues.join(" ")}</div>}
              <AssistantActionPayload action={action} imagePreview={buildInsertImageActionPreview(action, actionTargetContext)} />
              {(cardState.canApply || cardState.canReject || cardState.canRevert || cardState.applying) && (
                <div className="assistant-action-buttons">
                  {cardState.showTargetWarning && (
                    <button type="button" className="secondary" onClick={() => onOpenActionTarget(action.id)}>
                      切回目标
                    </button>
                  )}
                  {(cardState.canReject || cardState.applying) && (
                    <button
                      type="button"
                      className="secondary"
                      disabled={!cardState.canReject}
                      onClick={() => void onRejectAction(action.id)}
                    >
                      忽略
                    </button>
                  )}
                  {cardState.canRevert && (
                    <button type="button" className="secondary" onClick={() => void onRevertAction(action.id)}>
                      撤销
                    </button>
                  )}
                  {(cardState.canApply || cardState.applying) && (
                    <button type="button" disabled={!cardState.canExecute} onClick={() => void onApplyAction(action.id)}>
                      {aiActionApplyLabel(action.status)}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AssistantActionPayload({ action, imagePreview }: { action: AiAction; imagePreview: InsertImageActionPreview | null }) {
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

interface InsertImageActionPreview {
  src: string;
  alt: string;
  label: string;
  sourcePath: string;
}

interface ActionTargetContext {
  libraryPath: string;
  activeProject?: WritingProject;
  activeSheet?: WritingSheet;
}

function AssistantActionImagePreview({ preview }: { preview: InsertImageActionPreview }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setFailed(false);
    setOpen(false);
  }, [preview.src]);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  if (failed) return null;

  return (
    <>
      <figure className="assistant-action-image-preview">
        <img
          src={preview.src}
          alt={preview.alt || "图片预览"}
          title="双击放大查看"
          onDoubleClick={() => setOpen(true)}
          onError={() => setFailed(true)}
        />
        <figcaption>{preview.label}</figcaption>
      </figure>
      {open && (
        <div className="assistant-action-image-lightbox" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <img src={preview.src} alt={preview.alt || "图片预览"} onClick={(event) => event.stopPropagation()} />
          <span>{preview.label}</span>
        </div>
      )}
    </>
  );
}

function buildInsertImageActionPreview(action: AiAction, context: ActionTargetContext): InsertImageActionPreview | null {
  if (action.type !== "insertImage") return null;
  const path = stringValue(action.payload.path);
  if (!path) return null;
  const alt = stringValue(action.payload.alt) || action.title;

  if (/^https?:\/\//i.test(path)) {
    return {
      src: path,
      alt,
      label: path,
      sourcePath: path,
    };
  }

  if (!context.libraryPath.startsWith("/") || !context.activeProject || !context.activeSheet) return null;
  if (action.targetProjectId && context.activeProject.id !== action.targetProjectId) return null;
  if (action.targetSheetId && context.activeSheet.id !== action.targetSheetId) return null;

  const sourcePath = resolveSheetImageSourcePath(context.libraryPath, context.activeProject, context.activeSheet, path);
  if (!sourcePath) return null;

  return {
    src: convertFileSrc(sourcePath),
    alt,
    label: path,
    sourcePath,
  };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
