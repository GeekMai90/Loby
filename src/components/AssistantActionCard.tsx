import clsx from "clsx";
import { Download, FilePlus2, ImagePlus, Pencil } from "lucide-react";
import { buildAiActionCardState } from "../lib/aiActionCardState";
import { buildInsertImageActionPreview } from "../lib/assistantActionImagePreview";
import { aiActionApplyLabel, aiActionStatusLabel } from "../lib/aiActionState";
import type { AiAction, WritingProject, WritingSheet } from "../types";
import { AssistantActionPayload } from "./AssistantActionPayload";

interface AssistantActionCardProps {
  action: AiAction;
  targetContext: {
    libraryPath: string;
    activeProject?: WritingProject;
    activeSheet?: WritingSheet;
  };
  onApplyAction: (actionId: string) => Promise<void> | void;
  onRejectAction: (actionId: string) => Promise<void> | void;
  onRevertAction: (actionId: string) => Promise<void> | void;
  onOpenActionTarget: (actionId: string) => void;
}

export function AssistantActionCard({
  action,
  targetContext,
  onApplyAction,
  onRejectAction,
  onRevertAction,
  onOpenActionTarget,
}: AssistantActionCardProps) {
  const ActionIcon =
    action.type === "createSheet"
      ? FilePlus2
      : action.type === "insertText"
        ? Pencil
        : action.type === "insertImage"
          ? ImagePlus
          : Download;
  const cardState = buildAiActionCardState(action, targetContext);

  return (
    <div
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
        <AssistantActionPayload action={action} imagePreview={buildInsertImageActionPreview(action, targetContext)} />
        {(cardState.canApply || cardState.canReject || cardState.canRevert || cardState.applying) && (
          <div className="assistant-action-buttons">
            {cardState.showTargetWarning && (
              <button type="button" className="secondary" onClick={() => onOpenActionTarget(action.id)}>
                切回目标
              </button>
            )}
            {(cardState.canReject || cardState.applying) && (
              <button type="button" className="secondary" disabled={!cardState.canReject} onClick={() => void onRejectAction(action.id)}>
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
}
