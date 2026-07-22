/**
 * [INPUT]: 依赖 React 运行时、clsx、lucide-react、shadcn/ui 基础控件、shared 公共契约
 * [OUTPUT]: 对外提供 HistoryPanel
 * [POS]: 编辑器 feature 的界面组合单元，连接 编辑器 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildLineDiff } from "@/shared/lib/diff";
import { formatDateTime, formatSnapshotTime } from "@/shared/lib/formatters";
import type { ExportHistoryItem, SheetVersion, WritingProject, WritingSheet } from "@/shared/types";

interface HistoryPanelProps {
  project: WritingProject;
  activeSheet: WritingSheet;
  onSaveVersion: () => void;
  onRestoreVersion: (version: SheetVersion) => void;
  onOpenExportHistoryItem: (item: ExportHistoryItem) => void;
}

export function HistoryPanel({ project, activeSheet, onSaveVersion, onRestoreVersion, onOpenExportHistoryItem }: HistoryPanelProps) {
  const versions = activeSheet.versions ?? [];
  const [compareVersionId, setCompareVersionId] = useState("");
  const comparedVersion = versions.find((version) => version.id === compareVersionId) ?? null;
  const versionDiffLines = comparedVersion ? buildLineDiff(comparedVersion.body, activeSheet.body) : [];
  const recentExportHistory = project.exportHistory ?? [];

  useEffect(() => {
    setCompareVersionId("");
  }, [activeSheet.id]);

  return (
    <div className="flex flex-col gap-[var(--panel-gap)] pr-0.5">
      <section className="rounded-lg border border-border bg-card p-3">
        <h2 className="mb-3 text-sm font-semibold">版本快照</h2>
        <Button className="w-full" onClick={onSaveVersion}>
          <Archive /> 保存当前版本
        </Button>
        <div className="mt-2.5 flex flex-col gap-2">
          {versions.map((version) => (
            <article
              key={version.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border bg-muted/40 p-2"
            >
              <div>
                <strong className="block truncate text-xs">{version.title}</strong>
                <small className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  {formatSnapshotTime(version.createdAt)} · {version.wordCount} 字
                  {version.source ? ` · ${formatVersionSource(version.source)}` : ""}
                </small>
                {version.reason && <small className="mt-0.5 block truncate text-[11px] text-muted-foreground">{version.reason}</small>}
              </div>
              <div className="inline-flex items-center gap-1.5">
                <Button
                  variant={compareVersionId === version.id ? "secondary" : "outline"}
                  onClick={() => setCompareVersionId((current) => (current === version.id ? "" : version.id))}
                >
                  对比
                </Button>
                <Button variant="outline" onClick={() => onRestoreVersion(version)}>
                  恢复
                </Button>
              </div>
            </article>
          ))}
          {versions.length === 0 && <p className="text-xs leading-4.5 text-muted-foreground">还没有保存过版本快照。</p>}
        </div>
        {comparedVersion && (
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <strong className="truncate text-xs">对比：{comparedVersion.title}</strong>
              <Button variant="ghost" size="sm" onClick={() => setCompareVersionId("")}>
                关闭
              </Button>
            </div>
            <p className="text-xs leading-4.5 text-muted-foreground">绿色为当前稿件新增内容，红色为相对快照删除的内容。</p>
            <div className="diff-view max-h-65 overflow-auto" aria-label="版本差异">
              {versionDiffLines.map((line) => (
                <div key={line.id} className={clsx("diff-line", `diff-${line.kind}`)}>
                  <span>{line.kind === "added" ? "+" : line.kind === "removed" ? "-" : " "}</span>
                  <code>{line.text || " "}</code>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-3">
        <h2 className="mb-3 text-sm font-semibold">导出历史</h2>
        <div className="flex flex-col gap-2">
          {recentExportHistory.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border bg-card p-2"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <strong className="truncate text-xs">{item.label}</strong>
                <small className="truncate text-[11px] text-muted-foreground">
                  {formatDateTime(item.exportedAt)} · {item.sheetCount} 张 · {item.wordCount} 字
                </small>
                <small className="truncate text-[11px] text-muted-foreground">{item.filename}</small>
              </div>
              <Button variant="outline" size="sm" onClick={() => onOpenExportHistoryItem(item)}>
                打开
              </Button>
            </div>
          ))}
          {recentExportHistory.length === 0 && (
            <p className="text-xs leading-4.5 text-muted-foreground">保存导出文件后，这里会记录历史。</p>
          )}
        </div>
      </section>
    </div>
  );
}

function formatVersionSource(source: SheetVersion["source"]) {
  if (source === "ai") return "AI 修改前";
  if (source === "restore") return "恢复前";
  if (source === "auto") return "自动保存";
  return "手动保存";
}
