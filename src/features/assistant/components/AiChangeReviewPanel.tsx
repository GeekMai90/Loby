/**
 * [INPUT]: 依赖 lucide-react、shadcn/ui 基础控件、AssistantStructuredCard、AI 助手模块与 shared 公共契约
 * [OUTPUT]: 对外提供 AiChangeReviewPanel
 * [POS]: AI 助手 feature 的界面组合单元，连接 AI 助手状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { CircleAlert, CircleCheck, CircleHelp, LocateFixed, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssistantStructuredCard } from "@/features/assistant/components/AssistantStructuredCard";
import { aiChangeSetPrimaryAction } from "@/features/assistant/model/aiChangeSets";
import type { AiChangeSet } from "@/shared/types";

interface AiChangeReviewPanelProps {
  changeSets: AiChangeSet[];
  shownChangeSetIds: string[];
  onShowChanges: (changeSetId: string) => void;
  onHideChanges: (changeSetId: string) => void;
  onRollbackChangeSet: (changeSetId: string) => void;
  onRejectChangeSet: (changeSetId: string) => void;
  onOpenChangeSetTarget: (sheetId: string) => void;
  activeSheetId: string;
}

export function AiChangeReviewPanel({
  changeSets,
  shownChangeSetIds,
  onShowChanges,
  onHideChanges,
  onRollbackChangeSet,
  onRejectChangeSet,
  onOpenChangeSetTarget,
  activeSheetId,
}: AiChangeReviewPanelProps) {
  if (changeSets.length === 0) return null;

  return (
    <div className="grid gap-2 pb-2">
      {changeSets.map((changeSet) => {
        const showing = shownChangeSetIds.includes(changeSet.id);
        const primaryAction = aiChangeSetPrimaryAction(changeSet);
        const offActiveSheet = changeSet.sheetId !== activeSheetId;
        return (
          <AssistantStructuredCard
            key={changeSet.id}
            data-change-set-id={changeSet.id}
            data-change-set-status={changeSet.status}
            icon={<ChangeSetStatusIcon changeSet={changeSet} />}
            title={changeSetStatusTitle(changeSet)}
            description={changeSetDescription(changeSet)}
            details={changeSet.error ? <p className="mt-1.5 text-xs leading-[1.35] text-destructive">{changeSet.error}</p> : undefined}
            actions={
              <>
                {offActiveSheet ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => onOpenChangeSetTarget(changeSet.sheetId)}>
                    <LocateFixed />
                    切回文稿
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => (showing ? onHideChanges(changeSet.id) : onShowChanges(changeSet.id))}
                  >
                    {showing ? "隐藏更改" : "显示更改"}
                  </Button>
                )}
                {primaryAction === "dismiss" ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => onRejectChangeSet(changeSet.id)}>
                    <X />
                    忽略
                  </Button>
                ) : (
                  <Button type="button" variant="destructive" size="sm" onClick={() => onRollbackChangeSet(changeSet.id)}>
                    <RotateCcw />
                    撤销
                  </Button>
                )}
              </>
            }
          />
        );
      })}
    </div>
  );
}

function ChangeSetStatusIcon({ changeSet }: { changeSet: AiChangeSet }) {
  const className = "size-[15px] shrink-0";
  if (changeSet.error) return <CircleAlert className={`${className} text-destructive`} />;
  if (changeSet.status === "accepted") return <CircleCheck className={`${className} text-[var(--status-success)]`} />;
  if (changeSet.status === "partiallyAccepted") return <CircleAlert className={`${className} text-[var(--status-warning)]`} />;
  return <CircleHelp className={`${className} text-primary`} />;
}

function changeSetStatusTitle(changeSet: AiChangeSet) {
  if (changeSet.error) return "修改未完成";
  if (changeSet.status === "accepted") return "正文已修改";
  if (changeSet.status === "partiallyAccepted") return "正文已部分修改";
  return "正文修改待处理";
}

function changeSetDescription(changeSet: AiChangeSet) {
  const summary = changeSet.summary.trim();
  if (summary && summary !== "AI 建议修改当前文稿") return summary;
  const reason = changeSet.changes.find((change) => change.reason?.trim())?.reason?.trim();
  if (reason) return reason;
  return changeSet.error ? "这次修改没有写入正文。" : `已完成 ${changeSet.changes.length} 处正文修改。`;
}
