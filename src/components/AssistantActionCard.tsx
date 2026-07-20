import clsx from "clsx";
import { Check, Download, FilePlus2, ImagePlus, LocateFixed, Pencil, RotateCcw, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        "w-full max-w-full min-w-0 overflow-hidden rounded-lg border border-border bg-card p-2.25",
        action.status === "failed" && "border-destructive/25",
        action.status === "applying" && "border-primary/25",
        cardState.invalid && "border-amber-600/25",
      )}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex max-w-full min-w-0 flex-auto items-center gap-1.75">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <ActionIcon size={15} />
            </span>
            <span className="truncate text-[13px] font-semibold">{action.title}</span>
          </div>
          <strong className="max-w-13 shrink-0 truncate rounded-full bg-muted px-1.75 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {aiActionStatusLabel(action.status)}
          </strong>
        </div>
        <p className="mt-0.75 text-xs text-muted-foreground">{action.summary}</p>
        {(action.status === "applied" || action.status === "reverted") && action.result && (
          <div className="mt-1.75 rounded-lg bg-primary/10 px-1.75 py-1.5 text-[11px] leading-[1.45] text-primary">{action.result}</div>
        )}
        {action.error && (
          <div className="mt-1.75 rounded-lg bg-destructive/10 px-1.75 py-1.5 text-[11px] leading-[1.45] text-destructive">
            {action.error}
          </div>
        )}
        {cardState.showTargetWarning && cardState.targetWarning && (
          <div className="mt-1.75 rounded-lg bg-amber-600/10 px-1.75 py-1.5 text-[11px] leading-[1.45] text-amber-700 dark:text-amber-400">
            {cardState.targetWarning}
          </div>
        )}
        {cardState.showValidationWarning && (
          <div className="mt-1.75 rounded-lg bg-amber-600/10 px-1.75 py-1.5 text-[11px] leading-[1.45] text-amber-700 dark:text-amber-400">
            {cardState.validationIssues.join(" ")}
          </div>
        )}
        <AssistantActionPayload action={action} imagePreview={buildInsertImageActionPreview(action, targetContext)} />
        {(cardState.canApply || cardState.canReject || cardState.canRevert || cardState.applying) && (
          <div className="mt-2 flex justify-end gap-1.5">
            {cardState.showTargetWarning && (
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenActionTarget(action.id)}>
                <LocateFixed />
                切回目标
              </Button>
            )}
            {(cardState.canReject || cardState.applying) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!cardState.canReject}
                onClick={() => void onRejectAction(action.id)}
              >
                <X />
                忽略
              </Button>
            )}
            {cardState.canRevert && (
              <Button type="button" variant="outline" size="sm" onClick={() => void onRevertAction(action.id)}>
                <RotateCcw />
                撤销
              </Button>
            )}
            {(cardState.canApply || cardState.applying) && (
              <Button type="button" size="sm" disabled={!cardState.canExecute} onClick={() => void onApplyAction(action.id)}>
                {action.status === "failed" ? <RotateCw /> : <Check />}
                {aiActionApplyLabel(action.status)}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
