/**
 * [INPUT]: 依赖 lucide-react、shadcn/ui 基础控件、AI 助手模块、shared 公共契约
 * [OUTPUT]: 对外提供 AiChangeReviewPanel
 * [POS]: AI 助手 feature 的界面组合单元，连接 AI 助手状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Eye, EyeOff, LocateFixed, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
          <section key={changeSet.id} className="grid gap-3 rounded-xl border border-border bg-card/90 p-3">
            <div className="min-w-0">
              <strong className="block truncate text-[13px] font-bold">{changeSet.summary}</strong>
              <span className="mt-0.5 block text-xs leading-[1.35] whitespace-normal text-muted-foreground">
                {summarizeChangeSet(changeSet)}
              </span>
              {changeSet.error && (
                <div className="mt-2 rounded-lg bg-destructive/10 px-2 py-1.75 text-xs leading-[1.35] text-destructive">
                  {changeSet.error}
                </div>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-1.5">
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
                  {showing ? <EyeOff /> : <Eye />}
                  {showing ? "隐藏更改" : "显示更改"}
                </Button>
              )}
              {primaryAction === "dismiss" ? (
                <Button type="button" variant="outline" size="sm" onClick={() => onRejectChangeSet(changeSet.id)}>
                  <X />
                  忽略
                </Button>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => onRollbackChangeSet(changeSet.id)}>
                  <RotateCcw />
                  撤销
                </Button>
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
