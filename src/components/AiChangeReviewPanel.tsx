import { Eye, EyeOff, LocateFixed, RotateCcw, X } from "lucide-react";
import { aiChangeSetPrimaryAction } from "../lib/aiChangeSets";
import type { AiChangeSet } from "../types";

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
    <div className="ai-change-review-stack">
      {changeSets.map((changeSet) => {
        const showing = shownChangeSetIds.includes(changeSet.id);
        const primaryAction = aiChangeSetPrimaryAction(changeSet);
        const offActiveSheet = changeSet.sheetId !== activeSheetId;
        return (
          <section key={changeSet.id} className="ai-change-review compact">
            <div className="ai-change-review-main">
              <strong>{changeSet.summary}</strong>
              <span>{summarizeChangeSet(changeSet)}</span>
              {changeSet.error && <div className="ai-change-review-error">{changeSet.error}</div>}
            </div>
            <div className="ai-change-review-actions">
              {offActiveSheet ? (
                <button type="button" className="secondary" onClick={() => onOpenChangeSetTarget(changeSet.sheetId)}>
                  <LocateFixed size={13} />
                  切回文稿
                </button>
              ) : (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => (showing ? onHideChanges(changeSet.id) : onShowChanges(changeSet.id))}
                >
                  {showing ? <EyeOff size={13} /> : <Eye size={13} />}
                  {showing ? "隐藏更改" : "显示更改"}
                </button>
              )}
              {primaryAction === "dismiss" ? (
                <button type="button" className="secondary" onClick={() => onRejectChangeSet(changeSet.id)}>
                  <X size={13} />
                  忽略
                </button>
              ) : (
                <button type="button" className="danger" onClick={() => onRollbackChangeSet(changeSet.id)}>
                  <RotateCcw size={13} />
                  撤销
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function summarizeChangeSet(changeSet: AiChangeSet) {
  if (changeSet.error) return "这次 AI 修改没有写入正文，可以查看建议或忽略。";
  const reason = changeSet.changes.find((change) => change.reason?.trim())?.reason?.trim();
  if (reason) return reason;
  return `${changeSet.changes.length} 处修改已应用，可显示更改或撤销。`;
}
