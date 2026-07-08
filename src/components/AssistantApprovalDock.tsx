import { Check, ShieldCheck, X } from "lucide-react";
import type { AgentApprovalDecision, AgentApprovalRequest } from "../types";

interface AssistantApprovalDockProps {
  approvals: AgentApprovalRequest[];
  onRespondApproval: (approvalId: string, decision: AgentApprovalDecision) => Promise<void> | void;
}

export function AssistantApprovalDock({ approvals, onRespondApproval }: AssistantApprovalDockProps) {
  const visibleApprovals = approvals.filter((approval) => approval.status === "pending").slice(-3);
  if (visibleApprovals.length === 0) return null;

  return (
    <div className="assistant-approval-dock">
      {visibleApprovals.map((approval) => (
        <section key={approval.id} className="assistant-approval-card">
          <div className="assistant-approval-icon">
            <ShieldCheck size={15} />
          </div>
          <div className="assistant-approval-main">
            <div className="assistant-approval-title">
              <span>{approval.title || "Codex 请求确认"}</span>
              <small>{formatApprovalStatus(approval.status)}</small>
            </div>
            {approval.command && <code>{approval.command}</code>}
            {approval.reason && <p>{approval.reason}</p>}
          </div>
          <div className="assistant-approval-actions">
            <button type="button" onClick={() => onRespondApproval(approval.id, "accept")} title="允许">
              <Check size={13} />
              <span>允许</span>
            </button>
            <button type="button" onClick={() => onRespondApproval(approval.id, "acceptForSession")} title="本次会话允许">
              <ShieldCheck size={13} />
              <span>本次允许</span>
            </button>
            <button type="button" className="secondary" onClick={() => onRespondApproval(approval.id, "decline")} title="拒绝">
              <X size={13} />
              <span>拒绝</span>
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}

function formatApprovalStatus(status: string) {
  const labels: Record<string, string> = {
    pending: "待确认",
    accept: "已允许",
    acceptForSession: "本次会话允许",
    decline: "已拒绝",
    cancel: "已取消",
  };
  return labels[status] ?? status;
}
