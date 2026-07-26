/**
 * [INPUT]: 依赖 lucide-react、shadcn/ui 基础控件、shared 公共契约
 * [OUTPUT]: 对外提供 AssistantApprovalDock
 * [POS]: AI 助手 feature 的界面组合单元，连接 AI 助手状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Check, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentApprovalDecision, AgentApprovalRequest } from "@/shared/types";

interface AssistantApprovalDockProps {
  approvals: AgentApprovalRequest[];
  onRespondApproval: (approvalId: string, decision: AgentApprovalDecision) => Promise<void> | void;
}

export function AssistantApprovalDock({ approvals, onRespondApproval }: AssistantApprovalDockProps) {
  const visibleApprovals = approvals.filter((approval) => approval.status === "pending").slice(-3);
  if (visibleApprovals.length === 0) return null;

  return (
    <div data-slot="assistant-approval-dock" className="grid gap-2 px-[var(--assistant-panel-gutter)] pt-2">
      {visibleApprovals.map((approval) => (
        <section key={approval.id} className="w-full max-w-full min-w-0 overflow-hidden rounded-lg border border-border bg-card p-2.25">
          <header className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex max-w-full min-w-0 flex-auto items-center gap-1.75">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck size={15} />
              </span>
              <h4 className="m-0 min-w-0 truncate text-[13px] font-semibold">{approval.title || "AI 工具请求确认"}</h4>
            </div>
            <strong className="max-w-13 shrink-0 truncate rounded-full bg-muted px-1.75 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {formatApprovalStatus(approval.status)}
            </strong>
          </header>

          <div className="min-w-0">
            {approval.reason && <p className="mt-0.75 text-xs leading-[1.45] text-muted-foreground">{approval.reason}</p>}
            {approval.command && (
              <code className="mt-1.75 block max-w-full truncate rounded-lg border border-foreground/10 bg-muted/40 px-1.75 py-1.5 font-mono text-[11px] text-muted-foreground">
                {approval.command}
              </code>
            )}
          </div>

          <footer className="mt-2 flex flex-nowrap items-center justify-end gap-1.5">
            <Button type="button" size="sm" className="shrink-0 whitespace-nowrap" onClick={() => onRespondApproval(approval.id, "accept")}>
              <Check />
              <span>允许</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 whitespace-nowrap"
              onClick={() => onRespondApproval(approval.id, "acceptForSession")}
            >
              <ShieldCheck />
              <span>本次允许</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 whitespace-nowrap"
              onClick={() => onRespondApproval(approval.id, "decline")}
            >
              <X />
              <span>拒绝</span>
            </Button>
          </footer>
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
