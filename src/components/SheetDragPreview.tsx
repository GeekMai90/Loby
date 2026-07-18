import { FileText } from "lucide-react";
import type { SheetDragPreviewState } from "../hooks/useSheetPointerDrag";

export function SheetDragPreview({ preview }: { preview: SheetDragPreviewState }) {
  const previewWidth = 216;
  const iconCenterX = 25;
  const iconCenterY = 27;
  const left = Math.min(Math.max(12, preview.x - iconCenterX), Math.max(12, window.innerWidth - previewWidth - 12));
  const top = Math.min(Math.max(12, preview.y - iconCenterY), Math.max(12, window.innerHeight - 70));

  return (
    <div className="sheet-drag-preview" style={{ left, top }} aria-hidden="true">
      <span className="sheet-drag-preview-icon">
        <FileText size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-[13px] leading-4 font-semibold">{preview.title}</strong>
        <small className="mt-0.5 block truncate text-[10px] leading-3 text-muted-foreground">{preview.meta}</small>
      </span>
    </div>
  );
}
