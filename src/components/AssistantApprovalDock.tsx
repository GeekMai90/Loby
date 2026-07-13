import { Check, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentApprovalDecision, AgentApprovalRequest } from "../types";

interface AssistantApprovalDockProps {
  approvals: AgentApprovalRequest[];
  onRespondApproval: (approvalId: string, decision: AgentApprovalDecision) => Promise<void> | void;
}

export function AssistantApprovalDock({ approvals, onRespondApproval }: AssistantApprovalDockProps) {
  const visibleApprovals = approvals.filter((approval) => approval.status === "pending").slice(-3);
  if (visibleApprovals.length === 0) return null;

  return (
    <div className="grid gap-2 px-2.5 pt-2">
      {visibleApprovals.map((approval) => (
        <section
          key={approval.id}
          className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-start gap-2.25 rounded-lg border border-primary/35 bg-primary/5 p-2.25 shadow-[0_1px_2px_rgb(0_0_0_/_3%)]"
        >
          <div className="grid size-6 place-items-center rounded-lg bg-card text-primary">
            <ShieldCheck size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2 text-[13px] font-semibold">
              <span>{approval.title || "Codex 请求确认"}</span>
              <small className="shrink-0 text-[11px] font-semibold text-primary">{formatApprovalStatus(approval.status)}</small>
            </div>
            {approval.command && (
              <code className="mt-1.25 block truncate rounded-md bg-card px-1.5 py-1.25 font-mono text-[11px]">{approval.command}</code>
            )}
            {approval.reason && <p className="mt-1.25 text-xs leading-[1.4] text-muted-foreground">{approval.reason}</p>}
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            <Button type="button" size="sm" onClick={() => onRespondApproval(approval.id, "accept")} title="允许">
              <Check />
              <span>允许</span>
            </Button>
            <Button type="button" size="sm" onClick={() => onRespondApproval(approval.id, "acceptForSession")} title="本次会话允许">
              <ShieldCheck />
              <span>本次允许</span>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onRespondApproval(approval.id, "decline")} title="拒绝">
              <X />
              <span>拒绝</span>
            </Button>
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
