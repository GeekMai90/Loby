import clsx from "clsx";
import { FilePlus2 } from "lucide-react";
import type { PublishingChecklistItem, WritingSheet } from "../types";
import type { ExportReadinessItem } from "./ExportPanelTypes";

interface ExportPublishingSectionProps {
  selectedSheets: WritingSheet[];
  readinessChecklist: ExportReadinessItem[];
  publishingChecklist: PublishingChecklistItem[];
  finishedPublishingTasks: number;
  onTogglePublishingChecklistItem: (itemId: string) => void;
  onCreatePublishVersion: () => void;
}

export function ExportPublishingSection({
  selectedSheets,
  readinessChecklist,
  publishingChecklist,
  finishedPublishingTasks,
  onTogglePublishingChecklistItem,
  onCreatePublishVersion,
}: ExportPublishingSectionProps) {
  return (
    <section className="panel-section">
      <h2>发布检查</h2>
      <div className="publish-checklist">
        {readinessChecklist.map((item) => (
          <div key={item.label} className={clsx("checklist-row", item.ok && "checked")}>
            <span>{item.ok ? "✓" : "!"}</span>
            <strong>{item.label}</strong>
          </div>
        ))}
      </div>
      <div className="publishing-task-header">
        <strong>发布任务</strong>
        <small>
          {finishedPublishingTasks} / {publishingChecklist.length}
        </small>
      </div>
      <div className="publish-task-list">
        {publishingChecklist.map((item) => (
          <label key={item.id} className={clsx("publish-task-row", item.done && "checked")}>
            <input type="checkbox" checked={item.done} onChange={() => onTogglePublishingChecklistItem(item.id)} />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
      <button className="primary-button full-width" onClick={onCreatePublishVersion} disabled={selectedSheets.length === 0}>
        <FilePlus2 size={16} /> 保存为发布版本
      </button>
    </section>
  );
}
