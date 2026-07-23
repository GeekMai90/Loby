/**
 * [INPUT]: 依赖 lucide-react、shadcn/ui 基础控件、AssistantStructuredCard、动作校验/预览模型、状态语义 Token 与公共 action 契约
 * [OUTPUT]: 对外提供 AssistantActionCard，以及三段式写入确认和单行操作回执
 * [POS]: AI 助手消息的写入确认与操作回执层；不展示生成成果，以标题、动作说明和按钮承载用户决策
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { CircleAlert, CircleCheck, CircleHelp, CircleMinus, LoaderCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssistantStructuredCard } from "@/features/assistant/components/AssistantStructuredCard";
import { buildAiActionCardState } from "@/features/assistant/model/aiActionCardState";
import { buildAiActionPreview } from "@/features/assistant/model/aiActionPreview";
import type { AiAction, WritingProject, WritingSheet } from "@/shared/types";

interface AssistantActionCardProps {
  action: AiAction;
  targetContext: {
    libraryPath: string;
    projects?: WritingProject[];
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
  const cardState = buildAiActionCardState(action, targetContext);
  const decisionPending = action.status === "proposed";
  const failed = action.status === "failed";

  if (decisionPending || failed) {
    return (
      <AssistantStructuredCard
        data-action-id={action.id}
        data-action-status={action.status}
        data-action-view="confirmation"
        icon={<ActionStatusIcon action={action} />}
        title={actionRequestTitle(action)}
        description={actionRequestDescription(action)}
        details={
          <>
            {failed && action.error ? <p className="mt-1.5 text-xs leading-[1.35] text-destructive">{action.error}</p> : null}
            {(cardState.showValidationWarning || (cardState.showTargetWarning && cardState.targetWarning)) && (
              <p className="mt-1.5 text-xs leading-[1.35] text-[var(--status-warning)]">
                {cardState.showValidationWarning ? cardState.validationIssues.join(" ") : cardState.targetWarning}
              </p>
            )}
          </>
        }
        actions={
          <>
            {cardState.showTargetWarning && (
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenActionTarget(action.id)}>
                切回目标
              </Button>
            )}
            {cardState.canReject && (
              <Button type="button" variant="outline" size="sm" onClick={() => void onRejectAction(action.id)}>
                取消
              </Button>
            )}
            {cardState.canApply && (
              <Button type="button" size="sm" disabled={!cardState.canExecute} onClick={() => void onApplyAction(action.id)}>
                {failed ? "重试" : "确认"}
              </Button>
            )}
          </>
        }
      />
    );
  }

  return (
    <section
      className="w-full max-w-full min-w-0 overflow-hidden rounded-md border border-border bg-card px-2.5 py-1.5"
      data-action-id={action.id}
      data-action-status={action.status}
      data-action-view="receipt"
    >
      <div className="flex min-h-6 min-w-0 items-center gap-1.5">
        <ActionStatusIcon action={action} />
        <strong className="min-w-0 flex-1 truncate text-xs font-medium">{actionStatusTitle(action)}</strong>
        {cardState.canRevert && (
          <Button type="button" variant="ghost" size="xs" className="-my-1 -mr-1" onClick={() => void onRevertAction(action.id)}>
            <RotateCcw />
            撤销
          </Button>
        )}
      </div>
    </section>
  );
}

function ActionStatusIcon({ action }: { action: AiAction }) {
  const className = "size-[15px] shrink-0";
  if (action.status === "proposed") return <CircleHelp className={`${className} text-primary`} />;
  if (action.status === "applying") return <LoaderCircle className={`${className} animate-spin text-primary`} />;
  if (action.status === "applied") return <CircleCheck className={`${className} text-[var(--status-success)]`} />;
  if (action.status === "failed") return <CircleAlert className={`${className} text-destructive`} />;
  if (action.status === "reverted") return <RotateCcw className={`${className} text-muted-foreground`} />;
  return <CircleMinus className={`${className} text-muted-foreground`} />;
}

function actionStatusTitle(action: AiAction) {
  const label = actionOperationLabel(action);
  if (action.status === "applying") return `正在${label}`;
  if (action.status === "applied") return `已${label}`;
  if (action.status === "failed") return `${label}失败`;
  if (action.status === "rejected") return `已取消：${label}`;
  if (action.status === "reverted") return `已撤销：${label}`;
  const position = actionInsertionPosition(action);
  return position ? `${label} · ${position}` : label;
}

function actionRequestTitle(action: AiAction) {
  if (action.status === "failed") {
    if (action.type === "insertText" || action.type === "insertImage") return "插入失败";
    if (action.type === "createSheet") return "创建失败";
    return "导出失败";
  }
  if (action.type === "insertText" || action.type === "insertImage") return "确认插入";
  if (action.type === "createSheet") return "确认创建";
  return "确认导出";
}

function actionRequestDescription(action: AiAction) {
  if (action.type === "insertText") return insertionDescription("生成的文字", action);
  if (action.type === "insertImage") return insertionDescription("生成的图片", action);
  if (action.type === "createSheet") {
    const title = stringValue(action.payload.title) || actionTitleTarget(action.title);
    return `创建新文稿「${title}」`;
  }
  const filename = stringValue(action.payload.filename) || "文件";
  return `将生成的内容导出为「${filename}」`;
}

function insertionDescription(subject: string, action: AiAction) {
  const position = actionInsertionPosition(action);
  if (position.startsWith("当前选区")) return `使用${subject}替换当前选区`;
  return `将${subject}插入到${position === "当前光标" ? "当前光标位置" : position || "当前光标位置"}`;
}

function actionOperationLabel(action: AiAction) {
  if (action.type === "insertText") return `插入到「${action.targetSheetTitle || "当前文稿"}」`;
  if (action.type === "insertImage") return `插入图片到「${action.targetSheetTitle || "当前文稿"}」`;
  if (action.type === "createSheet") return `创建文稿「${stringValue(action.payload.title) || actionTitleTarget(action.title)}」`;
  return `导出「${stringValue(action.payload.filename) || "文件"}」`;
}

function actionInsertionPosition(action: AiAction) {
  if (action.type !== "insertText" && action.type !== "insertImage") return "";
  return buildAiActionPreview(action).fields.find(([label]) => label === "位置")?.[1] ?? "";
}

function actionTitleTarget(title: string) {
  return title.replace(/^创建文稿：?/, "").trim() || "新文稿";
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
