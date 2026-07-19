import type { MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import type { SheetSelectionModifiers } from "../lib/sheetSelection";
import type { SheetDropTarget, WritingSheet } from "../types";
import { SheetRow } from "./SheetRow";

interface SheetListProps {
  active: boolean;
  sheets: WritingSheet[];
  sheetProjectTitleById: Record<string, string>;
  activeSheetId: string;
  selectedSheetIds: string[];
  draggingSheetId: string;
  dropTarget: SheetDropTarget | null;
  canReorderSheets: boolean;
  canMoveSheets: boolean;
  onClearSheetSelection: () => void;
  onSelectSheet: (sheetId: string, modifiers: SheetSelectionModifiers) => void;
  onSheetContextMenu: (event: MouseEvent<HTMLElement>, sheetId: string) => void;
  onStartPointerDrag: (sheetId: string, event: ReactPointerEvent<HTMLElement>) => void;
  onSuppressClickAfterDrag: (event: MouseEvent<HTMLElement>) => boolean;
}

export function SheetList({
  active,
  sheets,
  sheetProjectTitleById,
  activeSheetId,
  selectedSheetIds,
  draggingSheetId,
  dropTarget,
  canReorderSheets,
  canMoveSheets,
  onClearSheetSelection,
  onSelectSheet,
  onSheetContextMenu,
  onStartPointerDrag,
  onSuppressClickAfterDrag,
}: SheetListProps) {
  function clearSelectionFromBlankArea(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (target instanceof Element && target.closest(".sheet-row")) return;
    onClearSheetSelection();
  }

  return (
    <div
      className="-mr-3 flex flex-1 flex-col gap-1.75 overflow-auto pb-13 pr-3 [scrollbar-gutter:stable]"
      onClick={clearSelectionFromBlankArea}
    >
      {sheets.map((sheet) => (
        <SheetRow
          key={sheet.id}
          sheet={sheet}
          projectTitle={sheetProjectTitleById[sheet.id]}
          selected={selectedSheetIds.includes(sheet.id)}
          current={activeSheetId === sheet.id}
          active={active}
          dragging={draggingSheetId === sheet.id}
          dropPosition={dropTarget?.sheetId === sheet.id ? dropTarget.position : null}
          reorderable={canReorderSheets}
          movable={canMoveSheets}
          onSelectSheet={onSelectSheet}
          onContextMenu={onSheetContextMenu}
          onStartPointerDrag={onStartPointerDrag}
          onSuppressClickAfterDrag={onSuppressClickAfterDrag}
        />
      ))}
      {sheets.length === 0 && <p className="m-auto self-center text-center text-xs leading-4.5 text-muted-foreground">没有文稿</p>}
    </div>
  );
}
