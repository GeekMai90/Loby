import { useEffect, useState } from "react";
import clsx from "clsx";
import { Archive } from "lucide-react";
import { buildLineDiff } from "../lib/diff";
import { formatDateTime, formatSnapshotTime } from "../lib/formatters";
import type { ExportHistoryItem, SheetVersion, WritingProject, WritingSheet } from "../types";

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
    <div className="panel-stack">
      <section className="panel-section">
        <h2>版本快照</h2>
        <button className="primary-button full-width" onClick={onSaveVersion}>
          <Archive size={16} /> 保存当前版本
        </button>
        <div className="version-list">
          {versions.map((version) => (
            <article key={version.id} className="version-row">
              <div>
                <strong>{version.title}</strong>
                <small>
                  {formatSnapshotTime(version.createdAt)} · {version.wordCount} 字
                  {version.source ? ` · ${formatVersionSource(version.source)}` : ""}
                </small>
                {version.reason && <small>{version.reason}</small>}
              </div>
              <div className="version-actions">
                <button
                  className={clsx("secondary-button", compareVersionId === version.id && "active")}
                  onClick={() => setCompareVersionId((current) => (current === version.id ? "" : version.id))}
                >
                  对比
                </button>
                <button className="secondary-button" onClick={() => onRestoreVersion(version)}>
                  恢复
                </button>
              </div>
            </article>
          ))}
          {versions.length === 0 && <p className="muted-text">还没有保存过版本快照。</p>}
        </div>
        {comparedVersion && (
          <div className="version-diff-block">
            <div className="version-diff-header">
              <strong>对比：{comparedVersion.title}</strong>
              <button className="text-button" onClick={() => setCompareVersionId("")}>
                关闭
              </button>
            </div>
            <p className="muted-text">绿色为当前稿件新增内容，红色为相对快照删除的内容。</p>
            <div className="diff-view" aria-label="版本差异">
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

      <section className="panel-section">
        <h2>导出历史</h2>
        <div className="export-history-list">
          {recentExportHistory.map((item) => (
            <div key={item.id} className="export-history-row">
              <div>
                <strong>{item.label}</strong>
                <small>
                  {formatDateTime(item.exportedAt)} · {item.sheetCount} 张 · {item.wordCount} 字
                </small>
                <small>{item.filename}</small>
              </div>
              <button className="secondary-button compact-button" onClick={() => onOpenExportHistoryItem(item)}>
                打开
              </button>
            </div>
          ))}
          {recentExportHistory.length === 0 && <p className="muted-text">保存导出文件后，这里会记录历史。</p>}
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
