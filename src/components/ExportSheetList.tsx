import { ChevronDown, ChevronUp } from "lucide-react";
import { countWords } from "../lib/text";
import type { WritingSheet } from "../types";

interface ExportSheetListProps {
  publishableSheets: WritingSheet[];
  selectedSheets: WritingSheet[];
  unselectedSheets: WritingSheet[];
  onToggleSheet: (sheetId: string) => void;
  onMoveSheet: (sheetId: string, direction: -1 | 1) => void;
}

export function ExportSheetList({ publishableSheets, selectedSheets, unselectedSheets, onToggleSheet, onMoveSheet }: ExportSheetListProps) {
  return (
    <div className="export-sheet-list" aria-label="选择并排序要导出的稿件卡片">
      {selectedSheets.map((sheet, index) => (
        <div key={sheet.id} className="export-sheet-row selected">
          <label>
            <input type="checkbox" checked onChange={() => onToggleSheet(sheet.id)} />
            <span>
              <strong>
                {index + 1}. {sheet.title}
              </strong>
              <small>
                {sheet.type} · {countWords(sheet.body)} 字
              </small>
            </span>
          </label>
          <div className="export-order-actions">
            <button className="icon-button" onClick={() => onMoveSheet(sheet.id, -1)} disabled={index === 0} title="上移导出顺序">
              <ChevronUp size={14} />
            </button>
            <button
              className="icon-button"
              onClick={() => onMoveSheet(sheet.id, 1)}
              disabled={index === selectedSheets.length - 1}
              title="下移导出顺序"
            >
              <ChevronDown size={14} />
            </button>
          </div>
        </div>
      ))}
      {unselectedSheets.length > 0 && <p className="export-list-label">未选择</p>}
      {unselectedSheets.map((sheet) => (
        <div key={sheet.id} className="export-sheet-row">
          <label>
            <input type="checkbox" checked={false} onChange={() => onToggleSheet(sheet.id)} />
            <span>
              <strong>{sheet.title}</strong>
              <small>
                {sheet.type} · {countWords(sheet.body)} 字
              </small>
            </span>
          </label>
        </div>
      ))}
      {publishableSheets.length === 0 && <p className="muted-text">当前项目没有可发布卡片。</p>}
    </div>
  );
}
