import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
    <div className="my-3 flex flex-col gap-1.5" aria-label="选择并排序要导出的稿件卡片">
      {selectedSheets.map((sheet, index) => (
        <div
          key={sheet.id}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-primary/35 bg-secondary p-2.5"
        >
          <label className="grid min-w-0 grid-cols-[18px_minmax(0,1fr)] items-start gap-2">
            <Checkbox checked onCheckedChange={() => onToggleSheet(sheet.id)} />
            <span className="block min-w-0">
              <strong className="block truncate text-xs">
                {index + 1}. {sheet.title}
              </strong>
              <small className="block text-xs text-muted-foreground">
                {sheet.type} · {countWords(sheet.body)} 字
              </small>
            </span>
          </label>
          <div className="flex gap-0.5">
            <Button variant="ghost" size="icon-xs" onClick={() => onMoveSheet(sheet.id, -1)} disabled={index === 0} title="上移导出顺序">
              <ChevronUp />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onMoveSheet(sheet.id, 1)}
              disabled={index === selectedSheets.length - 1}
              title="下移导出顺序"
            >
              <ChevronDown />
            </Button>
          </div>
        </div>
      ))}
      {unselectedSheets.length > 0 && <p className="mt-1 text-[11px] font-bold text-muted-foreground uppercase">未选择</p>}
      {unselectedSheets.map((sheet) => (
        <div
          key={sheet.id}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border bg-card p-2.5"
        >
          <label className="grid min-w-0 grid-cols-[18px_minmax(0,1fr)] items-start gap-2">
            <Checkbox checked={false} onCheckedChange={() => onToggleSheet(sheet.id)} />
            <span className="block min-w-0">
              <strong className="block truncate text-xs">{sheet.title}</strong>
              <small className="block text-xs text-muted-foreground">
                {sheet.type} · {countWords(sheet.body)} 字
              </small>
            </span>
          </label>
        </div>
      ))}
      {publishableSheets.length === 0 && <p className="text-xs leading-4.5 text-muted-foreground">当前项目没有可发布卡片。</p>}
    </div>
  );
}
