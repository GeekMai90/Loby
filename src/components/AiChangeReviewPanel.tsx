import clsx from "clsx";
import { Check, Eye, EyeOff, LocateFixed, RotateCcw, X } from "lucide-react";
import type { AiChangeSet } from "../types";

interface AiChangeReviewPanelProps {
  changeSets: AiChangeSet[];
  focusedChangeId: string;
  previewingChangeSetId: string;
  onAcceptChange: (changeSetId: string, changeId: string) => void;
  onRejectChange: (changeSetId: string, changeId: string) => void;
  onAcceptAll: (changeSetId: string) => void;
  onRejectAll: (changeSetId: string) => void;
  onFocusChange: (changeSetId: string, changeId: string) => void;
  onToggleOriginalPreview: (changeSetId: string) => void;
  onRollbackChangeSet: (changeSetId: string) => void;
}

export function AiChangeReviewPanel({
  changeSets,
  focusedChangeId,
  previewingChangeSetId,
  onAcceptChange,
  onRejectChange,
  onAcceptAll,
  onRejectAll,
  onFocusChange,
  onToggleOriginalPreview,
  onRollbackChangeSet,
}: AiChangeReviewPanelProps) {
  if (changeSets.length === 0) return null;

  return (
    <div className="ai-change-review-stack">
      {changeSets.map((changeSet) => {
        const pendingCount = changeSet.changes.filter((change) => change.status === "pending").length;
        const acceptedCount = changeSet.changes.filter((change) => change.status === "accepted").length;
        const rejectedCount = changeSet.changes.filter((change) => change.status === "rejected").length;
        const isPreviewing = previewingChangeSetId === changeSet.id;
        const canRollback = acceptedCount > 0;
        return (
          <section key={changeSet.id} className={clsx("ai-change-review", changeSet.status, isPreviewing && "previewing")}>
            <header className="ai-change-review-header">
              <div>
                <strong>{changeSet.summary}</strong>
                <small>
                  {formatChangeSetStatus(changeSet.status, pendingCount, acceptedCount, rejectedCount)}
                </small>
              </div>
              <div className="ai-change-review-actions">
                {pendingCount > 0 ? (
                  <>
                    <button type="button" onClick={() => onAcceptAll(changeSet.id)}>
                      全部接受
                    </button>
                    <button type="button" className="secondary" onClick={() => onRejectAll(changeSet.id)}>
                      全部拒绝
                    </button>
                  </>
                ) : (
                  <>
                    {canRollback && (
                      <button type="button" className="secondary" onClick={() => onToggleOriginalPreview(changeSet.id)}>
                        {isPreviewing ? <EyeOff size={12} /> : <Eye size={12} />}
                        {isPreviewing ? "退出原稿" : "查看原稿"}
                      </button>
                    )}
                    {canRollback && (
                      <button type="button" className="danger" onClick={() => onRollbackChangeSet(changeSet.id)}>
                        <RotateCcw size={12} />
                        回退
                      </button>
                    )}
                  </>
                )}
              </div>
            </header>
            {isPreviewing && <div className="ai-change-preview-note">正在编辑器中临时查看这次 AI 修改前的正文。</div>}

            <div className="ai-change-block-list">
              {changeSet.changes.map((change, index) => (
                <article
                  key={change.id}
                  className={clsx("ai-change-block", change.status, focusedChangeId === change.id && "focused")}
                >
                  <div className="ai-change-block-title">
                    <span>修改 {index + 1}</span>
                    <small>{formatChangeStatus(change.status)}</small>
                  </div>
                  <div className="ai-change-diff-grid">
                    <div>
                      <span>原文</span>
                      <pre>{change.fromText || "(新增内容)"}</pre>
                    </div>
                    <div>
                      <span>修改后</span>
                      <pre>{change.toText || "(删除内容)"}</pre>
                    </div>
                  </div>
                  {change.reason && <p>{change.reason}</p>}
                  <div className="ai-change-block-actions">
                    <button type="button" className="secondary" onClick={() => onFocusChange(changeSet.id, change.id)}>
                      <LocateFixed size={12} />
                      定位
                    </button>
                    <button type="button" onClick={() => onAcceptChange(changeSet.id, change.id)} disabled={change.status !== "pending"}>
                      <Check size={12} />
                      接受
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => onRejectChange(changeSet.id, change.id)}
                      disabled={change.status !== "pending"}
                    >
                      <X size={12} />
                      拒绝
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function formatChangeStatus(status: string) {
  if (status === "accepted") return "已接受";
  if (status === "rejected") return "已拒绝";
  return "待审定";
}

function formatChangeSetStatus(status: AiChangeSet["status"], pendingCount: number, acceptedCount: number, rejectedCount: number) {
  if (status === "accepted") return `${acceptedCount} 处修改已应用，可查看原稿或回退。`;
  if (status === "rejected") return rejectedCount > 0 ? `${rejectedCount} 处修改已拒绝。` : "这次修改已关闭。";
  if (status === "partiallyAccepted") {
    return `${acceptedCount} 处已应用，${rejectedCount} 处已拒绝${pendingCount > 0 ? `，${pendingCount} 处待审定` : ""}。`;
  }
  return `${pendingCount} 处建议修改待审定。`;
}
