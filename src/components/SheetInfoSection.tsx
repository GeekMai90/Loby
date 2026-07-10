import { Check, ChevronDown, Download, PenLine } from "lucide-react";
import { PROJECT_STATUS_FLOW } from "../lib/projectModel";
import type { ProjectStatus, SheetType, WritingSheet } from "../types";

interface SheetInfoSectionProps {
  activeSheet: WritingSheet;
  nextSheetStatus: ProjectStatus | null;
  updateSheet: (updater: (sheet: WritingSheet) => WritingSheet) => void;
  getCurrentDate: () => string;
  onSetSheetWorkflowStatus: (status: ProjectStatus) => void;
}

export function SheetInfoSection({
  activeSheet,
  nextSheetStatus,
  updateSheet,
  getCurrentDate,
  onSetSheetWorkflowStatus,
}: SheetInfoSectionProps) {
  return (
    <section className="panel-section">
      <h2>稿件信息</h2>
      <label>
        类型
        <select
          value={activeSheet.type}
          onChange={(event) => updateSheet((sheet) => ({ ...sheet, type: event.target.value as SheetType, updatedAt: getCurrentDate() }))}
        >
          {(["正文", "章节", "提纲", "素材", "发布版本"] as SheetType[]).map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </label>
      <label>
        状态
        <select
          value={activeSheet.status}
          onChange={(event) =>
            updateSheet((sheet) => ({ ...sheet, status: event.target.value as ProjectStatus, updatedAt: getCurrentDate() }))
          }
        >
          {PROJECT_STATUS_FLOW.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
      </label>
      <div className="workflow-actions">
        {nextSheetStatus && (
          <button className="secondary-button" onClick={() => onSetSheetWorkflowStatus(nextSheetStatus)}>
            <ChevronDown size={16} /> 推进到{nextSheetStatus}
          </button>
        )}
        <button className="secondary-button" onClick={() => onSetSheetWorkflowStatus("待发布")} disabled={activeSheet.status === "待发布"}>
          <Download size={16} /> 待发布
        </button>
        <button className="primary-button" onClick={() => onSetSheetWorkflowStatus("已发布")} disabled={activeSheet.status === "已发布"}>
          <Check size={16} /> 已发布
        </button>
        {(activeSheet.status === "已发布" || activeSheet.status === "已归档") && (
          <button className="secondary-button" onClick={() => onSetSheetWorkflowStatus("修改中")}>
            <PenLine size={16} /> 恢复修改
          </button>
        )}
      </div>
      <label>
        目标字数
        <input
          type="number"
          value={activeSheet.targetWords}
          onChange={(event) => updateSheet((sheet) => ({ ...sheet, targetWords: Number(event.target.value), updatedAt: getCurrentDate() }))}
        />
      </label>
      <label>
        摘要
        <textarea
          value={activeSheet.summary}
          onChange={(event) => updateSheet((sheet) => ({ ...sheet, summary: event.target.value, updatedAt: getCurrentDate() }))}
        />
      </label>
    </section>
  );
}
