import { Eye, EyeOff, RotateCcw } from "lucide-react";
import type { AiChangeSet } from "../types";

interface AiChangeReviewPanelProps {
  changeSets: AiChangeSet[];
  shownChangeSetIds: string[];
  onShowChanges: (changeSetId: string) => void;
  onHideChanges: (changeSetId: string) => void;
  onRollbackChangeSet: (changeSetId: string) => void;
}

export function AiChangeReviewPanel({
  changeSets,
  shownChangeSetIds,
  onShowChanges,
  onHideChanges,
  onRollbackChangeSet,
}: AiChangeReviewPanelProps) {
  if (changeSets.length === 0) return null;

  return (
    <div className="ai-change-review-stack">
      {changeSets.map((changeSet) => {
        const showing = shownChangeSetIds.includes(changeSet.id);
        return (
          <section key={changeSet.id} className="ai-change-review compact">
            <div className="ai-change-review-main">
              <strong>{changeSet.summary}</strong>
              <span>{summarizeChangeSet(changeSet)}</span>
            </div>
            <div className="ai-change-review-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => (showing ? onHideChanges(changeSet.id) : onShowChanges(changeSet.id))}
              >
                {showing ? <EyeOff size={13} /> : <Eye size={13} />}
                {showing ? "隐藏更改" : "显示更改"}
              </button>
              <button type="button" className="danger" onClick={() => onRollbackChangeSet(changeSet.id)}>
                <RotateCcw size={13} />
                撤销
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function summarizeChangeSet(changeSet: AiChangeSet) {
  const reason = changeSet.changes.find((change) => change.reason?.trim())?.reason?.trim();
  if (reason) return reason;
  return `${changeSet.changes.length} 处修改已应用，可显示更改或撤销。`;
}
