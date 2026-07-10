import clsx from "clsx";
import type { KeyboardEvent, MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { getSheetDisplayTitle, getSheetMetaText, getSheetPreview, isBlankSheet } from "../lib/sheetRail";
import type { SheetDropTarget, WritingSheet } from "../types";

interface SheetRowProps {
  sheet: WritingSheet;
  projectTitle?: string;
  selected: boolean;
  dragging: boolean;
  dropPosition: SheetDropTarget["position"] | null;
  reorderable: boolean;
  onSelectSheet: (sheetId: string) => void;
  onContextMenu: (event: MouseEvent<HTMLElement>, sheetId: string) => void;
  onStartPointerDrag: (sheetId: string, event: ReactPointerEvent<HTMLElement>) => void;
  onUpdatePointerDrag: (event: ReactPointerEvent<HTMLElement>) => void;
  onFinishPointerDrag: (event: ReactPointerEvent<HTMLElement>) => void;
  onCancelPointerDrag: () => void;
  onSuppressClickAfterDrag: (event: MouseEvent<HTMLElement>) => boolean;
}

export function SheetRow({
  sheet,
  projectTitle,
  selected,
  dragging,
  dropPosition,
  reorderable,
  onSelectSheet,
  onContextMenu,
  onStartPointerDrag,
  onUpdatePointerDrag,
  onFinishPointerDrag,
  onCancelPointerDrag,
  onSuppressClickAfterDrag,
}: SheetRowProps) {
  function selectSheetFromKeyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelectSheet(sheet.id);
  }

  const displayTitle = getSheetDisplayTitle(sheet);
  const preview = getSheetPreview(sheet);
  const isBlank = isBlankSheet(sheet);
  const metaText = getSheetMetaText(sheet, projectTitle);

  return (
    <article
      role="button"
      tabIndex={0}
      className={clsx(
        "sheet-row",
        isBlank && "blank",
        selected && "selected",
        dragging && "dragging",
        dropPosition && `drop-${dropPosition}`,
      )}
      data-sheet-id={sheet.id}
      data-sheet-reorderable={reorderable ? "true" : undefined}
      onClick={(event) => {
        if (onSuppressClickAfterDrag(event)) return;
        onSelectSheet(sheet.id);
      }}
      onContextMenu={(event) => onContextMenu(event, sheet.id)}
      onKeyDown={selectSheetFromKeyboard}
      onPointerDown={(event) => onStartPointerDrag(sheet.id, event)}
      onPointerMove={onUpdatePointerDrag}
      onPointerUp={onFinishPointerDrag}
      onPointerCancel={onCancelPointerDrag}
    >
      <small className="sheet-row-time">{metaText}</small>
      {isBlank ? (
        <div className="sheet-row-blank">空白文稿</div>
      ) : (
        <div className="sheet-row-main">
          <strong>{displayTitle}</strong>
          <span>{preview}</span>
        </div>
      )}
    </article>
  );
}
