/**
 * [INPUT]: 依赖 clsx、React 运行时、写作库模块、shared 公共契约
 * [OUTPUT]: 对外提供 SheetRow
 * [POS]: 写作库 feature 的界面组合单元，连接 写作库 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import clsx from "clsx";
import type { KeyboardEvent, MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { getSheetDisplayTitle, getSheetMetaText, getSheetPreview, isBlankSheet } from "@/features/library/model/sheetRail";
import type { SheetSelectionModifiers } from "@/features/library/model/sheetSelection";
import type { SheetDropTarget, WritingSheet } from "@/shared/types";

interface SheetRowProps {
  active: boolean;
  sheet: WritingSheet;
  projectTitle?: string;
  selected: boolean;
  nextSelected: boolean;
  selectedBefore: boolean;
  selectedAfter: boolean;
  current: boolean;
  dragging: boolean;
  dropPosition: SheetDropTarget["position"] | null;
  reorderable: boolean;
  movable: boolean;
  onSelectSheet: (sheetId: string, modifiers: SheetSelectionModifiers) => void;
  onContextMenu: (event: MouseEvent<HTMLElement>, sheetId: string) => void;
  onStartPointerDrag: (sheetId: string, event: ReactPointerEvent<HTMLElement>) => void;
  onSuppressClickAfterDrag: (event: MouseEvent<HTMLElement>) => boolean;
}

export function SheetRow({
  active,
  sheet,
  projectTitle,
  selected,
  nextSelected,
  selectedBefore,
  selectedAfter,
  current,
  dragging,
  dropPosition,
  reorderable,
  movable,
  onSelectSheet,
  onContextMenu,
  onStartPointerDrag,
  onSuppressClickAfterDrag,
}: SheetRowProps) {
  function selectSheetFromKeyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelectSheet(sheet.id, event);
  }

  const displayTitle = getSheetDisplayTitle(sheet);
  const preview = getSheetPreview(sheet);
  const isBlank = isBlankSheet(sheet);
  const metaText = getSheetMetaText(sheet, projectTitle);
  const activeSelection = selected && active;

  return (
    <article
      role="button"
      tabIndex={0}
      className={clsx(
        "sheet-row relative flex h-29.5 min-h-29.5 max-h-29.5 flex-none select-none flex-col justify-start gap-0 text-left outline-none transition-[opacity,transform] focus-visible:ring-3 focus-visible:ring-ring/50",
        isBlank && "blank",
        selected
          ? activeSelection
            ? "selected selection-active text-primary-foreground"
            : "selected selection-inactive text-[var(--sheet-selection-inactive-foreground)]"
          : "unselected bg-transparent text-foreground",
        !selected && nextSelected && "before-selected",
        selected && !selectedBefore && "selected-group-start",
        selected && !selectedAfter && "selected-group-end",
        dragging && "dragging",
        dropPosition && `drop-${dropPosition}`,
      )}
      data-sheet-id={sheet.id}
      aria-current={current ? "true" : undefined}
      aria-pressed={selected}
      data-sheet-reorderable={reorderable ? "true" : undefined}
      data-sheet-movable={movable ? "true" : undefined}
      onClick={(event) => {
        if (onSuppressClickAfterDrag(event)) return;
        onSelectSheet(sheet.id, event);
      }}
      onContextMenu={(event) => onContextMenu(event, sheet.id)}
      onKeyDown={selectSheetFromKeyboard}
      onPointerDown={(event) => onStartPointerDrag(sheet.id, event)}
    >
      <span className="sheet-row-divider" aria-hidden="true" />
      <small className="sheet-row-meta truncate text-[11px] leading-tight">{sheet.completedAt ? `已完成 · ${metaText}` : metaText}</small>
      {isBlank ? (
        <div className="sheet-row-preview flex min-h-0 flex-1 items-center justify-center text-[13px] font-medium">空白文稿</div>
      ) : (
        <div className="mt-2 flex min-h-0 flex-col gap-1.25">
          <strong className="truncate text-sm leading-snug font-semibold">{displayTitle}</strong>
          <span className="sheet-row-preview mt-0.25 line-clamp-2 min-h-[calc(1.4em*2)] text-sm leading-[1.4]">{preview}</span>
        </div>
      )}
    </article>
  );
}
